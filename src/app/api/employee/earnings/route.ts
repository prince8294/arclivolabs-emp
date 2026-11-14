import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import Compensation from "@/models/Compensation";
import Incentive from "@/models/Incentive";
import PaymentRecord from "@/models/PaymentRecord";
import PaymentReversal from "@/models/PaymentReversal";

export async function GET() {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  await connectToDatabase();
  const employeeId = auth.session.user.id;
  const now = new Date();
  const [compensation, payments, incentives, reversals] = await Promise.all([
    Compensation.findOne({ employee: employeeId, effectiveDate: { $lte: now } })
      .sort({ effectiveDate: -1 })
      .select("compensationType baseAmountPaise currency effectiveDate notes")
      .lean(),
    PaymentRecord.find({ employee: employeeId, status: { $in: ["approved", "paid"] } })
      .select("periodStart periodEnd currency baseAmountPaise incentiveTotalPaise adjustments totalPayablePaise status paidAmountPaise paidAt paymentMethod transactionReference")
      .sort({ periodStart: -1 })
      .limit(100)
      .lean(),
    Incentive.find({ employee: employeeId })
      .populate({ path: "project", select: "name" })
      .populate({ path: "task", select: "title" })
      .select("title amountPaise currency reason incentiveDate status")
      .sort({ incentiveDate: -1 })
      .limit(100)
      .lean(),
    PaymentReversal.find({ employee: employeeId })
      .populate({ path: "payment", select: "periodStart currency" })
      .select("payment amountPaise reason createdAt")
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  const outstandingByCurrency: Record<string, number> = {};
  for (const payment of payments) {
    if (payment.status === "approved") outstandingByCurrency[payment.currency] = (outstandingByCurrency[payment.currency] ?? 0) + payment.totalPayablePaise;
  }
  const paidByCurrency: Record<string, number> = {};
  for (const payment of payments) {
    if (payment.status === "paid") paidByCurrency[payment.currency] = (paidByCurrency[payment.currency] ?? 0) + (payment.paidAmountPaise ?? 0);
  }
  for (const reversal of reversals) {
    const payment = reversal.payment;
    const currency = typeof payment === "object" && payment !== null && "currency" in payment && typeof payment.currency === "string"
      ? payment.currency
      : undefined;
    if (currency) paidByCurrency[currency] = (paidByCurrency[currency] ?? 0) - reversal.amountPaise;
  }
  return Response.json({
    compensation,
    payments,
    incentives,
    reversals,
    summary: {
      outstandingByCurrency,
      receivedByCurrency: paidByCurrency,
      approvedIncentivesByCurrency: incentives.reduce<Record<string, number>>((result, incentive) => {
        if (incentive.status === "approved") {
          result[incentive.currency] = (result[incentive.currency] ?? 0) + incentive.amountPaise;
        }
        return result;
      }, {}),
    },
  });
}
