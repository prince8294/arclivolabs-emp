import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { projectSchema } from "@/lib/work/validation";
import Project from "@/models/Project";
import Task from "@/models/Task";
import User from "@/models/User";

type RouteContext = { params: Promise<{ id: string }> };

async function validateTeam(employeeIds: string[]) {
  if (!employeeIds.length) return true;
  const employees = await User.find({
    _id: { $in: employeeIds },
    role: { $in: ["developer", "designer"] },
    status: "active",
  }).select("_id").lean();
  return employees.length === new Set(employeeIds).size;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Project not found." }, { status: 404 });

  await connectToDatabase();
  const [project, tasks] = await Promise.all([
    Project.findById(id)
      .select("projectId name description type priority status assignedEmployees startDate deadline technologies githubUrl figmaUrl notes createdBy createdAt updatedAt archivedAt")
      .populate({ path: "assignedEmployees", select: "fullName email role designation profilePicture status" })
      .lean(),
    Task.find({ project: id, archivedAt: null })
      .select("taskId title assignedTo priority status dueDate updatedAt")
      .populate({ path: "assignedTo", select: "fullName role" })
      .sort({ dueDate: 1 })
      .lean(),
  ]);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const completed = tasks.filter((task) => task.status === "completed").length;
  return Response.json({ project, tasks, progress: { total: tasks.length, completed, percentage: tasks.length ? Math.round((completed / tasks.length) * 100) : 0 } });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Project not found." }, { status: 404 });

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
  const project = await Project.findOneAndUpdate(
    { _id: id, archivedAt: null },
    { $set: parsed.data },
    { new: true, runValidators: true },
  ).select("projectId name status").lean();
  if (!project) return Response.json({ error: "Project not found or archived." }, { status: 404 });
  return Response.json({ project });
}
