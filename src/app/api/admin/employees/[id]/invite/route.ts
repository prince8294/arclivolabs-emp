import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { createSetupInvitation } from "@/lib/employees/invitation";
import User from "@/models/User";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Employee not found." }, { status: 404 });

  await connectToDatabase();
  const employee = await User.findOne({
    _id: id,
    role: { $in: ["developer", "designer"] },
    status: "pending_setup",
    accountSetupCompleted: false,
  }).select("_id").lean();
  if (!employee) return Response.json({ error: "No pending employee setup was found." }, { status: 404 });

  try {
    const invitation = await createSetupInvitation(id);
    return Response.json(invitation);
  } catch (error) {
    console.error("Unable to generate employee invitation.", error);
    return Response.json({ error: "The invitation could not be generated." }, { status: 500 });
  }
}
