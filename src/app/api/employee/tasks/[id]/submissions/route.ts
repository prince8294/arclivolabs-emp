import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { sanitizePlainText } from "@/lib/work/format";
import { recordTaskActivity } from "@/lib/work/record-activity";
import { notifyActiveAdmins } from "@/lib/notifications/create";
import { taskSubmissionSchema } from "@/lib/work/validation";
import Task from "@/models/Task";
import TaskSubmission from "@/models/TaskSubmission";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
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
  const parsed = taskSubmissionSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Add a deliverable link or a meaningful submission note.", issues: parsed.error.issues }, { status: 400 });
  const submissionNotes = sanitizePlainText(parsed.data.submissionNotes ?? "");
  const hasDeliverable = Boolean(parsed.data.githubUrl || parsed.data.previewUrl || parsed.data.figmaUrl);
  if (!hasDeliverable && submissionNotes.trim().length < 20) {
    return Response.json({ error: "Add a deliverable link or a meaningful explanation of at least 20 readable characters." }, { status: 400 });
  }

  await connectToDatabase();
  const task = await Task.findOne({ _id: id, assignedTo: auth.session.user.id, status: "in_progress", archivedAt: null })
    .select("title status")
    .lean();
  if (!task) return Response.json({ error: "Only an assigned task in progress can be submitted for review." }, { status: 409 });

  const deliverableLinks = [
    parsed.data.githubUrl ? { kind: "github" as const, url: parsed.data.githubUrl } : null,
    parsed.data.previewUrl ? { kind: "preview" as const, url: parsed.data.previewUrl } : null,
    parsed.data.figmaUrl ? { kind: "figma" as const, url: parsed.data.figmaUrl } : null,
  ].filter((link): link is NonNullable<typeof link> => link !== null);
  let submission;
  try {
    submission = await TaskSubmission.create({
      task: id,
      employee: auth.session.user.id,
      deliverableLinks,
      submissionNotes,
    });
  } catch (error) {
    console.error("Unable to save task submission.", error);
    return Response.json({ error: "The submission could not be saved. You can try again." }, { status: 500 });
  }
  const changed = await Task.findOneAndUpdate(
    { _id: id, assignedTo: auth.session.user.id, status: "in_progress", archivedAt: null },
    { $set: { status: "in_review", blockedReason: "" } },
    { new: true },
  ).select("status").lean();
  if (!changed) {
    await TaskSubmission.deleteOne({ _id: submission._id, reviewStatus: "pending" });
    return Response.json({ error: "The task changed while you were submitting it. Reload and try again." }, { status: 409 });
  }

  let warning: string | undefined;
  const effects = await Promise.allSettled([
    recordTaskActivity(id, auth.session.user.id, "submission_added", undefined, submission.id),
    recordTaskActivity(id, auth.session.user.id, "status_changed", "in_progress", "in_review"),
    notifyActiveAdmins({
      title: "Task submitted for review",
      message: `${auth.session.user.name ?? "An employee"} submitted "${task.title}" for review.`,
      type: "task_submitted",
      resourceType: "task",
      resourceId: id,
      task: id,
      dedupeKey: `task-submitted:${String(submission._id)}`,
    }),
  ]);
  if (effects.some((effect) => effect.status === "rejected")) {
    for (const effect of effects) if (effect.status === "rejected") console.error("Task submission was saved but a follow-up record could not be created.", effect.reason);
    warning = "Your submission was saved for review, but its activity history or notification could not be fully recorded.";
  }
  return Response.json({ submission: { id: submission.id, submittedAt: submission.submittedAt }, task: changed, warning }, { status: 201 });
}
