import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { recordTaskActivity } from "@/lib/work/record-activity";
import { taskReviewSchema } from "@/lib/work/validation";
import { createNotification } from "@/lib/notifications/create";
import Task from "@/models/Task";
import TaskSubmission from "@/models/TaskSubmission";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
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
  const parsed = taskReviewSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Add review feedback when requesting changes.", issues: parsed.error.issues }, { status: 400 });

  await connectToDatabase();
  const task = await Task.findOne({ _id: id, status: "in_review", archivedAt: null })
    .select("title assignedTo status")
    .lean();
  if (!task) return Response.json({ error: "This task is not awaiting review." }, { status: 409 });
  const submission = await TaskSubmission.findOne({ task: id, reviewStatus: "pending" }).sort({ submittedAt: -1 }).lean();
  if (!submission) return Response.json({ error: "No pending submission was found." }, { status: 404 });

  const now = new Date();
  const reviewStatus = parsed.data.decision === "approve" ? "approved" : "changes_requested";
  const updatedSubmission = await TaskSubmission.findOneAndUpdate(
    { _id: submission._id, reviewStatus: "pending" },
    {
      $set: {
        reviewStatus,
        reviewedBy: auth.session.user.id,
        reviewedAt: now,
        reviewFeedback: parsed.data.feedback ?? "",
      },
    },
    { new: true },
  );
  if (!updatedSubmission) return Response.json({ error: "This submission has already been reviewed." }, { status: 409 });

  const nextStatus = parsed.data.decision === "approve" ? "completed" : "in_progress";
  const updatedTask = await Task.findOneAndUpdate(
    { _id: id, status: "in_review", archivedAt: null },
    {
      $set: { status: nextStatus, completedAt: parsed.data.decision === "approve" ? now : null },
      $unset: parsed.data.decision === "request_changes" ? { blockedReason: 1 } : {},
    },
    { new: true },
  );
  if (!updatedTask) {
    await TaskSubmission.findByIdAndUpdate(submission._id, {
      $set: { reviewStatus: "pending" },
      $unset: { reviewedBy: 1, reviewedAt: 1, reviewFeedback: 1 },
    });
    return Response.json({ error: "The task changed while reviewing. Reload and try again." }, { status: 409 });
  }

  const action = parsed.data.decision === "approve" ? "task_approved" : "changes_requested";
  const sideEffects = await Promise.allSettled([
    recordTaskActivity(id, auth.session.user.id, action, "in_review", nextStatus),
    createNotification({
      recipient: String(submission.employee),
      title: parsed.data.decision === "approve" ? "Task review approved" : "Changes requested",
      task: id,
      resourceType: "task",
      resourceId: id,
      type: parsed.data.decision === "approve" ? "task_approved" : "task_changes_requested",
      message: parsed.data.decision === "approve"
        ? `Your task "${task.title}" was approved.`
        : `Changes were requested for "${task.title}".`,
      dedupeKey: `task-review:${String(submission._id)}:${reviewStatus}`,
    }),
  ]);
  const failedEffects = sideEffects.filter((effect) => effect.status === "rejected");
  let warning: string | undefined;
  if (failedEffects.length) {
    for (const effect of failedEffects) {
      if (effect.status === "rejected") console.error("Task review was saved but a follow-up record could not be created.", effect.reason);
    }
    warning = "The review decision was saved, but an activity or employee notification could not be recorded.";
  }

  return Response.json({ task: { id: updatedTask.id, status: updatedTask.status }, submission: { id: updatedSubmission.id, reviewStatus }, warning });
}
