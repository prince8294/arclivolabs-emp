import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import Project from "@/models/Project";
import Task from "@/models/Task";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Project not found." }, { status: 404 });

  await connectToDatabase();
  const project = await Project.findOne({
    _id: id,
    assignedEmployees: auth.session.user.id,
    archivedAt: null,
  })
    .select("projectId name description type priority status startDate deadline technologies githubUrl figmaUrl")
    .lean();
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

  const [tasks, counts] = await Promise.all([
    Task.find({ project: id, assignedTo: auth.session.user.id, archivedAt: null })
      .select("taskId title priority status dueDate updatedAt")
      .sort({ dueDate: 1 })
      .lean(),
    Task.aggregate([
      { $match: { project: project._id, archivedAt: null } },
      { $group: { _id: null, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } } } },
    ]),
  ]);
  const progress = counts[0] ?? { total: 0, completed: 0 };
  return Response.json({
    project,
    tasks,
    progress: {
      total: progress.total,
      completed: progress.completed,
      percentage: progress.total ? Math.round((progress.completed / progress.total) * 100) : 0,
    },
  });
}
