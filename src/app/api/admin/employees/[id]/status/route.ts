import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Employee not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("status" in body) || !["active", "inactive"].includes(String(body.status))) {
    return Response.json({ error: "Status must be active or inactive." }, { status: 400 });
  }
  const status = body.status as "active" | "inactive";

  await connectToDatabase();
  const employee = await User.findOneAndUpdate(
    {
      _id: id,
      role: { $in: ["developer", "designer"] },
      $or: [{ accountSetupCompleted: true }, { accountSetupCompleted: { $exists: false } }],
    },
    { $set: { status }, $inc: { authVersion: 1 } },
    { new: true, runValidators: true },
  ).select("employeeId fullName status").lean();
  if (!employee) return Response.json({ error: "Employee not found or account setup is incomplete." }, { status: 404 });
  return Response.json({ employee });
}
