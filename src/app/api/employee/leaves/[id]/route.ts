import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import LeaveDayReservation from "@/models/LeaveDayReservation";
import LeaveRequest from "@/models/LeaveRequest";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Leave request not found." }, { status: 404 });
  await connectToDatabase();
  const cancelled = await LeaveRequest.findOneAndUpdate(
    { _id: id, employee: auth.session.user.id, status: "pending" },
    { $set: { status: "cancelled", cancelledAt: new Date() } },
    { new: true },
  ).select("_id status");
  if (!cancelled) return Response.json({ error: "Only your pending leave requests can be cancelled." }, { status: 409 });
  await LeaveDayReservation.deleteMany({ leaveRequest: cancelled._id });
  return Response.json({ request: cancelled });
}
