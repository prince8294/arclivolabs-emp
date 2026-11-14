import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import PaymentRecord from "@/models/PaymentRecord";
import PaymentReversal from "@/models/PaymentReversal";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Payment record not found." }, { status: 404 });
  await connectToDatabase();
  const [payment, reversals] = await Promise.all([
    PaymentRecord.findOne({
      _id: id,
      employee: auth.session.user.id,
      status: { $in: ["approved", "paid"] },
    })
      .populate({ path: "employee", select: "employeeId fullName" })
      .populate({ path: "compensation", select: "compensationType effectiveDate baseAmountPaise currency" })
      .populate({ path: "incentives.incentive", select: "title reason incentiveDate" })
      .select("-auditLog")
      .lean(),
    PaymentReversal.find({ payment: id, employee: auth.session.user.id })
      .select("amountPaise reason createdAt")
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  if (!payment) return Response.json({ error: "Payment record not found." }, { status: 404 });
  return Response.json({ payment, reversals });
}
