import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import Task from "@/models/Task";
import TaskActivity from "@/models/TaskActivity";
import TaskComment from "@/models/TaskComment";
import TaskSubmission from "@/models/TaskSubmission";
import { employeeTaskActionSchema } from "@/lib/work/validation";
import { recordTaskActivity } from "@/lib/work/record-activity";
import { notifyActiveAdmins } from "@/lib/notifications/create";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Task not found." }, { status: 404 });
  await connectToDatabase();

  const [task, submissions, comments, activity] = await Promise.all([
    Task.findOne({ _id: id, assignedTo: auth.session.user.id, archivedAt: null })
      .select("-attachments")
      .populate({ path: "project", select: "projectId name description status deadline githubUrl figmaUrl" })
      .lean(),
    TaskSubmission.find({ task: id, employee: auth.session.user.id })
      .select("-attachmentReferences")
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
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Task not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = employeeTaskActionSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Provide a valid task update.", issues: parsed.error.issues }, { status: 400 });

  await connectToDatabase();
  const task = await Task.findOne({ _id: id, assignedTo: auth.session.user.id, archivedAt: null })
    .select("title status")
    .lean();
  if (!task) return Response.json({ error: "Task not found." }, { status: 404 });

  let nextStatus: "in_progress" | "blocked";
  let update: Record<string, unknown>;
  if (parsed.data.action === "start" && task.status === "to_do") {
    nextStatus = "in_progress";
    update = { $set: { status: nextStatus, blockedReason: "" } };
  } else if (parsed.data.action === "block" && ["to_do", "in_progress"].includes(task.status)) {
    nextStatus = "blocked";
    update = { $set: { status: nextStatus, blockedReason: parsed.data.reason } };
  } else if (parsed.data.action === "resume" && task.status === "blocked") {
    nextStatus = "in_progress";
    update = { $set: { status: nextStatus, blockedReason: "" } };
  } else {
    return Response.json({ error: "That update is not allowed for the current task status." }, { status: 409 });
  }

  const changed = await Task.findOneAndUpdate(
    { _id: id, assignedTo: auth.session.user.id, status: task.status, archivedAt: null },
    update,
    { new: true },
  ).select("status blockedReason").lean();
  if (!changed) return Response.json({ error: "The task changed while you were updating it. Reload and try again." }, { status: 409 });
  let warning: string | undefined;
  const effects = await Promise.allSettled([
    recordTaskActivity(id, auth.session.user.id, "status_changed", task.status, nextStatus),
    ...(nextStatus === "blocked" ? [notifyActiveAdmins({
        title: "Task blocked",
        message: `${auth.session.user.name ?? "An employee"} blocked "${task.title}".`,
        type: "task_blocked",
        resourceType: "task",
        resourceId: id,
        task: id,
        dedupeKey: `task-blocked:${id}:${String(changed.updatedAt ?? Date.now())}`,
      })] : []),
  ]);
  if (effects.some((effect) => effect.status === "rejected")) {
    for (const effect of effects) if (effect.status === "rejected") console.error("Task status changed but a follow-up record could not be saved.", effect.reason);
    warning = "Your task status was updated, but its activity history or notification could not be recorded.";
  }
  return Response.json({ task: changed, warning });
}
