import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { createTaskId } from "@/lib/work/ids";
import { isDuplicateKey, startOfUtcDay } from "@/lib/work/format";
import { taskSchema } from "@/lib/work/validation";
import Project from "@/models/Project";
import Task from "@/models/Task";
import User from "@/models/User";
import { recordTaskActivity } from "@/lib/work/record-activity";
import { createNotification } from "@/lib/notifications/create";
import { taskStatuses } from "@/types/work";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function validateAssignee(projectId: string, employeeId: string) {
  const [project, employee] = await Promise.all([
    Project.findOne({ _id: projectId, archivedAt: null }).select("assignedEmployees").lean(),
    User.findOne({ _id: employeeId, role: { $in: ["developer", "designer"] }, status: "active" }).select("_id").lean(),
  ]);
  return Boolean(project && employee && project.assignedEmployees.some((id: unknown) => String(id) === employeeId));
}

async function isOpenProject(projectId: string) {
  return Boolean(await Project.exists({
    _id: projectId,
    archivedAt: null,
    status: { $nin: ["completed", "cancelled"] },
  }));
}

export async function GET(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { searchParams } = new URL(request.url);
  const page = Math.min(100_000, Math.max(1, Number(searchParams.get("page")) || 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));
  const query = searchParams.get("q")?.trim().slice(0, 100);
  const status = searchParams.get("status");
  const archived = searchParams.get("archived") === "true";
  const filter: Record<string, unknown> = { archivedAt: archived ? { $ne: null } : null };
  if (status && taskStatuses.includes(status as (typeof taskStatuses)[number])) filter.status = status;
  if (query) filter.title = new RegExp(escapeRegex(query), "i");

  await connectToDatabase();
  const [tasks, total, pendingReviews, overdueTasks] = await Promise.all([
    Task.find(filter)
      .select("taskId project title assignedTo priority status dueDate updatedAt archivedAt")
      .populate({ path: "project", select: "projectId name status" })
      .populate({ path: "assignedTo", select: "fullName role designation profilePicture" })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Task.countDocuments(filter),
    Task.countDocuments({ archivedAt: null, status: "in_review" }),
    Task.countDocuments({ archivedAt: null, dueDate: { $lt: startOfUtcDay() }, status: { $nin: ["completed"] } }),
  ]);
  return Response.json({
    tasks,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    stats: { pendingReviews, overdueTasks },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = taskSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please correct the task details.", issues: parsed.error.issues }, { status: 400 });

  await connectToDatabase();
  if (!(await validateAssignee(parsed.data.project, parsed.data.assignedTo))) {
    return Response.json({ error: "Assign this task to an active employee on the selected project team." }, { status: 400 });
  }
  if (!(await isOpenProject(parsed.data.project))) {
    return Response.json({ error: "New tasks can only be created on projects that are not completed, cancelled, or archived." }, { status: 400 });
  }
  try {
    const task = await Task.create({
      ...parsed.data,
      taskId: await createTaskId(),
      startDate: parsed.data.startDate || undefined,
      status: "to_do",
      createdBy: auth.session.user.id,
    });
    const activityResults = await Promise.allSettled([
      recordTaskActivity(task.id, auth.session.user.id, "task_created", undefined, task.status),
      recordTaskActivity(task.id, auth.session.user.id, "employee_assigned", undefined, parsed.data.assignedTo),
      createNotification({
        recipient: parsed.data.assignedTo,
        title: "New task assigned",
        message: `You were assigned "${task.title}".`,
        type: "task_assigned",
        resourceType: "task",
        resourceId: task.id,
        task: task.id,
        dedupeKey: `task-assigned:${task.id}`,
      }),
    ]);
    const activityFailed = activityResults.some((result) => result.status === "rejected");
    if (activityFailed) {
      for (const result of activityResults) {
        if (result.status === "rejected") console.error("Task was created but an activity record could not be saved.", result.reason);
      }
    }
    return Response.json({
      task: { id: task.id, taskId: task.taskId },
      warning: activityFailed ? "The task was created, but its activity history or notification could not be fully recorded." : undefined,
    }, { status: 201 });
  } catch (error) {
    if (isDuplicateKey(error)) return Response.json({ error: "A task with this generated ID already exists. Please try again." }, { status: 409 });
    console.error("Unable to create task.", error);
    return Response.json({ error: "The task could not be created." }, { status: 500 });
  }
}
