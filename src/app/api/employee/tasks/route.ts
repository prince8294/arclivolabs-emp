import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import Task from "@/models/Task";
import { startOfUtcDay } from "@/lib/work/format";

export async function GET() {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  await connectToDatabase();

  const scope = { assignedTo: auth.session.user.id, archivedAt: null };
  const [tasks, totalAssigned, inProgress, inReview, completed, overdue] = await Promise.all([
    Task.find(scope)
      .select("taskId title project priority status dueDate updatedAt")
      .populate({ path: "project", select: "projectId name status" })
      .sort({ dueDate: 1, updatedAt: -1 })
      .limit(50)
      .lean(),
    Task.countDocuments(scope),
    Task.countDocuments({ ...scope, status: "in_progress" }),
    Task.countDocuments({ ...scope, status: "in_review" }),
    Task.countDocuments({ ...scope, status: "completed" }),
    Task.countDocuments({ ...scope, dueDate: { $lt: startOfUtcDay() }, status: { $nin: ["completed"] } }),
  ]);
  return Response.json({ tasks, stats: { totalAssigned, inProgress, inReview, completed, overdue } });
}
