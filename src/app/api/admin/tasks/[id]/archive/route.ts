import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { recordTaskActivity } from "@/lib/work/record-activity";
import Task from "@/models/Task";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Task not found." }, { status: 404 });

  await connectToDatabase();
  const task = await Task.findOneAndUpdate(
    { _id: id, archivedAt: null },
    { $set: { archivedAt: new Date() } },
    { new: true },
  ).select("taskId status assignedTo").lean();
  if (!task) return Response.json({ error: "Task not found or already archived." }, { status: 404 });
  let warning: string | undefined;
  try {
    await recordTaskActivity(id, auth.session.user.id, "task_archived");
  } catch (error) {
    console.error("Task was archived but its activity record could not be saved.", error);
    warning = "The task was archived, but its activity history could not be recorded.";
  }
  return Response.json({ task, warning });
}
