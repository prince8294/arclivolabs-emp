import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { leaveReviewSchema } from "@/lib/hr/validation";
import { connectToDatabase } from "@/lib/db/mongodb";
import LeaveDayReservation from "@/models/LeaveDayReservation";
import LeaveRequest from "@/models/LeaveRequest";
import { sanitizePlainText } from "@/lib/work/format";
import { createNotification } from "@/lib/notifications/create";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Leave request not found." }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = leaveReviewSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Choose approve or reject and enter valid remarks.", issues: parsed.error.issues }, { status: 400 });
  await connectToDatabase();
  const status = parsed.data.decision === "approve" ? "approved" : "rejected";
  const updated = await LeaveRequest.findOneAndUpdate(
    { _id: id, status: "pending" },
    {
      $set: {
        status,
        adminRemarks: sanitizePlainText(parsed.data.adminRemarks),
        reviewedBy: auth.session.user.id,
        reviewedAt: new Date(),
      },
    },
    { new: true },
  ).lean();
  if (!updated) return Response.json({ error: "This leave request is no longer pending review." }, { status: 409 });
  if (status === "rejected") await LeaveDayReservation.deleteMany({ leaveRequest: updated._id });
  let warning: string | undefined;
  try {
    await createNotification({
      recipient: String(updated.employee),
      title: status === "approved" ? "Leave request approved" : "Leave request rejected",
      message: status === "approved" ? "Your leave request was approved." : "Your leave request was rejected.",
      type: status === "approved" ? "leave_approved" : "leave_rejected",
      resourceType: "leave",
      resourceId: String(updated._id),
      dedupeKey: `leave-reviewed:${String(updated._id)}:${status}`,
    });
  } catch (error) {
    console.error("Leave decision was saved but the employee notification could not be created.", error);
    warning = "The decision was saved, but the employee could not be notified.";
  }
  return Response.json({ request: updated, warning });
}
