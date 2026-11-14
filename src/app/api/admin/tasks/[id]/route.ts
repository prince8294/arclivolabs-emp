import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { recordTaskActivity } from "@/lib/work/record-activity";
import { createNotification } from "@/lib/notifications/create";
import { taskSchema } from "@/lib/work/validation";
import Project from "@/models/Project";
import Task from "@/models/Task";
import TaskActivity from "@/models/TaskActivity";
import TaskComment from "@/models/TaskComment";
import TaskSubmission from "@/models/TaskSubmission";
import User from "@/models/User";

type RouteContext = { params: Promise<{ id: string }> };

async function validateAssignee(projectId: string, employeeId: string) {
  const [project, employee] = await Promise.all([
    Project.findOne({ _id: projectId, archivedAt: null }).select("assignedEmployees").lean(),
    User.findOne({ _id: employeeId, role: { $in: ["developer", "designer"] }, status: "active" }).select("_id").lean(),
  ]);
  return Boolean(project && employee && project.assignedEmployees.some((id: unknown) => String(id) === employeeId));
}

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Task not found." }, { status: 404 });

  await connectToDatabase();
  const [task, submissions, comments, activity] = await Promise.all([
    Task.findById(id)
      .select("-attachments")
      .populate({ path: "project", select: "projectId name status" })
      .populate({ path: "assignedTo", select: "fullName role designation profilePicture employeeId" })
      .lean(),
    TaskSubmission.find({ task: id })
      .populate({ path: "employee", select: "fullName role" })
      .populate({ path: "reviewedBy", select: "fullName role" })
      .sort({ submittedAt: -1 })
      .lean(),
    TaskComment.find({ task: id })
      .populate({ path: "author", select: "fullName role profilePicture" })
      .sort({ createdAt: 1 })
      .lean(),
    TaskActivity.find({ task: id })
      .populate({ path: "actor", select: "fullName role" })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
  ]);
  if (!task) return Response.json({ error: "Task not found." }, { status: 404 });
  return Response.json({ task, submissions, comments, activity });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Task not found." }, { status: 404 });
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
  const existing = await Task.findOne({ _id: id, archivedAt: null }).select("project assignedTo status").lean();
  if (!existing) return Response.json({ error: "Task not found or archived." }, { status: 404 });
  if (
    (
      String(existing.assignedTo) !== parsed.data.assignedTo
      || String(existing.project) !== parsed.data.project
    )
    && ["in_review", "completed"].includes(existing.status)
  ) {
    return Response.json({ error: "A task in review or completed cannot change its project or assignee." }, { status: 409 });
  }
  const task = await Task.findOneAndUpdate(
    { _id: id, archivedAt: null },
    { $set: { ...parsed.data, startDate: parsed.data.startDate || undefined } },
    { new: true, runValidators: true },
  ).select("taskId title project assignedTo priority status dueDate").lean();
  if (!task) return Response.json({ error: "Task changed while it was being edited. Reload and try again." }, { status: 409 });

  let warning: string | undefined;
  if (String(existing.assignedTo) !== parsed.data.assignedTo) {
    try {
      await Promise.all([
        recordTaskActivity(
          id,
          auth.session.user.id,
          "employee_reassigned",
          String(existing.assignedTo),
          parsed.data.assignedTo,
        ),
        createNotification({
          recipient: parsed.data.assignedTo,
          title: "New task assigned",
          message: `You were assigned "${task.title}".`,
          type: "task_assigned",
          resourceType: "task",
          resourceId: id,
          task: id,
          dedupeKey: `task-reassigned:${id}:${String(task.updatedAt ?? Date.now())}`,
        }),
      ]);
    } catch (error) {
      console.error("Task changes were saved but reassignment history or notification could not be recorded.", error);
      warning = "Task changes were saved, but its reassignment history or notification could not be recorded.";
    }
  }
  return Response.json({ task, warning });
}
