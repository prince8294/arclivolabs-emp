import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import Project from "@/models/Project";
import Task from "@/models/Task";

export async function GET() {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  await connectToDatabase();

  const projects = await Project.find({
    assignedEmployees: auth.session.user.id,
    archivedAt: null,
  })
    .select("projectId name description type priority status startDate deadline technologies githubUrl figmaUrl")
    .sort({ deadline: 1, updatedAt: -1 })
    .lean();
  const ids = projects.map((project) => project._id);
  const [tasks, progress] = await Promise.all([
    Task.find({ project: { $in: ids }, assignedTo: auth.session.user.id, archivedAt: null })
      .select("taskId project title priority status dueDate")
      .sort({ dueDate: 1 })
      .lean(),
    Task.aggregate([
      { $match: { project: { $in: ids }, archivedAt: null } },
      { $group: { _id: "$project", total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } } } },
    ]),
  ]);
  const byProject = new Map(progress.map((entry) => [String(entry._id), { total: entry.total, completed: entry.completed }]));
  const tasksByProject = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const key = String(task.project);
    const current = tasksByProject.get(key) ?? [];
    current.push(task);
    tasksByProject.set(key, current);
  }
  return Response.json({
    projects: projects.map((project) => ({
      ...project,
      progress: byProject.get(String(project._id)) ?? { total: 0, completed: 0 },
      tasks: tasksByProject.get(String(project._id)) ?? [],
    })),
  });
}
