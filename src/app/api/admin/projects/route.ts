import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { createProjectId } from "@/lib/work/ids";
import { isDuplicateKey, startOfUtcDay } from "@/lib/work/format";
import { projectSchema } from "@/lib/work/validation";
import Project from "@/models/Project";
import Task from "@/models/Task";
import User from "@/models/User";
import { projectStatuses } from "@/types/work";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function validateTeam(employeeIds: string[]) {
  if (!employeeIds.length) return true;
  const employees = await User.find({
    _id: { $in: employeeIds },
    role: { $in: ["developer", "designer"] },
    status: "active",
  }).select("_id").lean();
  return employees.length === new Set(employeeIds).size;
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
  if (status && projectStatuses.includes(status as (typeof projectStatuses)[number])) filter.status = status;
  if (query) filter.name = new RegExp(escapeRegex(query), "i");

  await connectToDatabase();
  const base = { archivedAt: null };
  const now = startOfUtcDay();
  const [projects, total, totalProjects, activeProjects, completedProjects, overdueProjects] = await Promise.all([
    Project.find(filter)
      .select("projectId name description type priority status assignedEmployees startDate deadline githubUrl figmaUrl archivedAt createdAt")
      .populate({ path: "assignedEmployees", select: "fullName role designation profilePicture status" })
      .sort({ deadline: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Project.countDocuments(filter),
    Project.countDocuments(base),
    Project.countDocuments({ ...base, status: { $in: ["planning", "in_progress", "on_hold"] } }),
    Project.countDocuments({ ...base, status: "completed" }),
    Project.countDocuments({ ...base, deadline: { $lt: now }, status: { $nin: ["completed", "cancelled"] } }),
  ]);
  const ids = projects.map((project) => project._id);
  const progress = ids.length
    ? await Task.aggregate([
        { $match: { project: { $in: ids }, archivedAt: null } },
        { $group: { _id: "$project", total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } } } },
      ])
    : [];
  const progressByProject = new Map(progress.map((entry) => [String(entry._id), { total: entry.total, completed: entry.completed }]));

  return Response.json({
    projects: projects.map((project) => ({
      ...project,
      progress: progressByProject.get(String(project._id)) ?? { total: 0, completed: 0 },
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    stats: { totalProjects, activeProjects, completedProjects, overdueProjects },
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
  const parsed = projectSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please correct the project details.", issues: parsed.error.issues }, { status: 400 });

  await connectToDatabase();
  if (!(await validateTeam(parsed.data.assignedEmployees))) {
    return Response.json({ error: "Only active Developers and Designers can be assigned." }, { status: 400 });
  }
  try {
    const project = await Project.create({
      ...parsed.data,
      projectId: await createProjectId(),
      createdBy: auth.session.user.id,
    });
    return Response.json({ project: { id: project.id, projectId: project.projectId } }, { status: 201 });
  } catch (error) {
    if (isDuplicateKey(error)) return Response.json({ error: "A project with this generated ID already exists. Please try again." }, { status: 409 });
    console.error("Unable to create project.", error);
    return Response.json({ error: "The project could not be created." }, { status: 500 });
  }
}
