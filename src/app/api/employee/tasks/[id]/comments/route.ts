import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { sanitizePlainText } from "@/lib/work/format";
import { taskCommentSchema } from "@/lib/work/validation";
import Task from "@/models/Task";
import TaskComment from "@/models/TaskComment";

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
  const parsed = taskCommentSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Comment must contain 1–2,000 characters." }, { status: 400 });
  const message = sanitizePlainText(parsed.data.message);
  if (!message.trim()) return Response.json({ error: "Comment must contain readable text." }, { status: 400 });

  await connectToDatabase();
  if (!(await Task.exists({ _id: id, assignedTo: auth.session.user.id, archivedAt: null }))) {
    return Response.json({ error: "Task not found." }, { status: 404 });
  }
  const comment = await TaskComment.create({
    task: id,
    author: auth.session.user.id,
    message,
  });
  return Response.json({ comment: { id: comment.id, message: comment.message, createdAt: comment.createdAt } }, { status: 201 });
}
