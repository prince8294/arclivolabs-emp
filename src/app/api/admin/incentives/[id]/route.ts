import { isValidObjectId } from "mongoose";
import { isDuplicateKey, sanitizePlainText } from "@/lib/work/format";
import { requireApiRole } from "@/lib/auth/authorization";
import { incentiveReviewSchema } from "@/lib/hr/validation";
import { connectToDatabase } from "@/lib/db/mongodb";
import Incentive from "@/models/Incentive";
import { createNotification } from "@/lib/notifications/create";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Incentive not found." }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = incentiveReviewSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Choose approve or cancel." }, { status: 400 });
  await connectToDatabase();

  const action = parsed.data.action;
  const filter = action === "approved"
    ? { _id: id, status: "pending" }
    : { _id: id, status: { $in: ["pending", "approved"] }, paymentRecord: { $exists: false } };
  try {
    const changedAt = new Date();
    const record = await Incentive.findOneAndUpdate(
      filter,
      {
        $set: action === "approved"
          ? { status: "approved", approvedBy: auth.session.user.id, approvedAt: changedAt }
          : { status: "cancelled", cancelledBy: auth.session.user.id, cancelledAt: changedAt },
        $push: {
          auditLog: {
            action: action === "approved" ? "incentive_approved" : "incentive_cancelled",
            actor: auth.session.user.id,
            reason: sanitizePlainText(parsed.data.reason),
            previousValue: action === "approved" ? "pending" : "pending_or_approved",
            newValue: action,
            createdAt: changedAt,
          },
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!record) return Response.json({ error: "This incentive is not eligible for that change; allocated incentives cannot be cancelled." }, { status: 409 });
    let warning: string | undefined;
    if (action === "approved") {
      try {
        await createNotification({
          recipient: String(record.employee),
          title: "Incentive approved",
          message: `Your incentive "${record.title}" was approved.`,
          type: "incentive_approved",
          resourceType: "incentive",
          resourceId: String(record._id),
          dedupeKey: `incentive-approved:${String(record._id)}`,
        });
      } catch (error) {
        console.error("Incentive was approved but the employee notification could not be created.", error);
        warning = "The incentive was approved, but the employee could not be notified.";
      }
    }
    return Response.json({ incentive: record, warning });
  } catch (error) {
    if (isDuplicateKey(error)) return Response.json({ error: "The incentive was already processed." }, { status: 409 });
    throw error;
  }
}
