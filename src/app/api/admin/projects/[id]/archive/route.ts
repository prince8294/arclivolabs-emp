import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import Project from "@/models/Project";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Project not found." }, { status: 404 });

  await connectToDatabase();
  const project = await Project.findOneAndUpdate(
    { _id: id, status: { $in: ["completed", "cancelled"] }, archivedAt: null },
    { $set: { archivedAt: new Date() } },
    { new: true },
  ).select("projectId status archivedAt").lean();
  if (!project) return Response.json({ error: "Only completed or cancelled projects can be archived." }, { status: 409 });
  return Response.json({ project });
}
