import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { paymentReviewSchema } from "@/lib/hr/validation";
import { connectToDatabase } from "@/lib/db/mongodb";
import PaymentRecord from "@/models/PaymentRecord";
import PaymentReversal from "@/models/PaymentReversal";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Payment record not found." }, { status: 404 });
  await connectToDatabase();
  const [payment, reversals] = await Promise.all([
    PaymentRecord.findById(id)
      .populate({ path: "employee", select: "employeeId fullName email role" })
      .populate({ path: "compensation", select: "compensationType effectiveDate baseAmountPaise currency notes" })
      .populate({ path: "incentives.incentive", select: "title reason incentiveDate" })
      .populate({ path: "approvedBy", select: "fullName" })
      .populate({ path: "paidBy", select: "fullName" })
      .lean(),
    PaymentReversal.find({ payment: id }).populate({ path: "recordedBy", select: "fullName" }).sort({ createdAt: -1 }).lean(),
  ]);
  if (!payment) return Response.json({ error: "Payment record not found." }, { status: 404 });
  return Response.json({ payment, reversals });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Payment record not found." }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = paymentReviewSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Choose a valid payment action." }, { status: 400 });
  await connectToDatabase();
  const now = new Date();
  const payment = await PaymentRecord.findOneAndUpdate(
    { _id: id, status: "draft" },
    {
      $set: { status: "approved", approvedBy: auth.session.user.id, approvedAt: now },
      $push: {
        auditLog: {
          action: "payment_approved",
          actor: auth.session.user.id,
          previousValue: "draft",
          newValue: "approved",
          createdAt: now,
        },
      },
    },
    { new: true, runValidators: true },
  ).lean();
  if (payment) return Response.json({ payment });
  const current = await PaymentRecord.findById(id).lean();
  if (current?.status === "approved" || current?.status === "paid") return Response.json({ payment: current, alreadyApproved: true });
  return Response.json({ error: "This payment is no longer a draft and cannot be approved." }, { status: 409 });
}
