import { isDuplicateKey, sanitizePlainText } from "@/lib/work/format";
import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { parseMoneyToPaise } from "@/lib/hr/money";
import { utcMonthRange } from "@/lib/hr/dates";
import { paymentDraftSchema } from "@/lib/hr/validation";
import { connectToDatabase } from "@/lib/db/mongodb";
import Compensation from "@/models/Compensation";
import Incentive from "@/models/Incentive";
import PaymentRecord from "@/models/PaymentRecord";
import PaymentReversal from "@/models/PaymentReversal";
import User from "@/models/User";

function sumByCurrency(rows: Array<{ currency: string; amount: number }>) {
  const totals: Record<string, number> = {};
  for (const row of rows) totals[row.currency] = (totals[row.currency] ?? 0) + row.amount;
  return totals;
}

export async function GET(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? new Date().toISOString().slice(0, 7);
  const range = utcMonthRange(period);
  if (!range) return Response.json({ error: "Choose a month in YYYY-MM format." }, { status: 400 });
  const employeeId = searchParams.get("employeeId");
  const status = searchParams.get("status");
  if (employeeId && !isValidObjectId(employeeId)) return Response.json({ error: "Select a valid employee." }, { status: 400 });
  if (status && !["draft", "approved", "paid"].includes(status)) return Response.json({ error: "Choose a valid payment status." }, { status: 400 });
  const page = Math.min(100_000, Math.max(1, Number(searchParams.get("page")) || 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 25));
  await connectToDatabase();
  const filter: Record<string, unknown> = { periodStart: range.start };
  if (employeeId) filter.employee = employeeId;
  if (status) filter.status = status;
  const currentRange = utcMonthRange(new Date().toISOString().slice(0, 7))!;
  const [records, total, approvedRows, pendingCount, paidRows, reversals, approvedIncentiveRows, employees, compensations] = await Promise.all([
    PaymentRecord.find(filter)
      .populate({ path: "employee", select: "employeeId fullName role designation" })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PaymentRecord.countDocuments(filter),
    PaymentRecord.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: "$currency", total: { $sum: "$totalPayablePaise" } } },
    ]),
    PaymentRecord.countDocuments({ status: { $in: ["draft", "approved"] } }),
    PaymentRecord.find({ status: "paid", paidAt: { $gte: currentRange.start, $lt: currentRange.end } })
      .select("currency paidAmountPaise")
      .lean(),
    PaymentReversal.find({ createdAt: { $gte: currentRange.start, $lt: currentRange.end } })
      .populate({ path: "payment", select: "currency" })
      .select("amountPaise payment")
      .lean(),
    Incentive.aggregate([
      { $match: { status: "approved", paymentRecord: { $exists: false } } },
      { $group: { _id: "$currency", total: { $sum: "$amountPaise" } } },
    ]),
    User.find({ role: { $in: ["developer", "designer"] } })
      .select("employeeId fullName role designation status")
      .sort({ fullName: 1 })
      .lean(),
    Compensation.find({ effectiveDate: { $lte: range.start } })
      .sort({ effectiveDate: -1 })
      .select("employee compensationType baseAmountPaise currency effectiveDate")
      .lean(),
  ]);
  const paidAmounts = paidRows.map((item) => ({ currency: item.currency, amount: item.paidAmountPaise ?? 0 }));
  const reversedAmounts = reversals.map((item) => {
    const payment = item.payment;
    const currency = typeof payment === "object" && payment !== null && "currency" in payment && typeof payment.currency === "string"
      ? payment.currency
      : "INR";
    return { currency, amount: item.amountPaise };
  });
  const paidTotals: Record<string, number> = sumByCurrency(paidAmounts);
  for (const reversed of reversedAmounts) paidTotals[reversed.currency] = (paidTotals[reversed.currency] ?? 0) - reversed.amount;
  const compensationByEmployee = new Map<string, (typeof compensations)[number]>();
  for (const item of compensations) {
    const key = String(item.employee);
    if (!compensationByEmployee.has(key)) compensationByEmployee.set(key, item);
  }
  const payableTotals: Record<string, number> = {};
  for (const row of approvedRows) payableTotals[row._id] = row.total;
  const incentiveTotals: Record<string, number> = {};
  for (const row of approvedIncentiveRows) incentiveTotals[row._id] = row.total;
  return Response.json({
    period,
    records,
    employees: employees.map((employee) => ({
      ...employee,
      compensation: compensationByEmployee.get(String(employee._id)) ?? null,
    })),
    summary: {
      approvedPayableByCurrency: payableTotals,
      pendingPayments: pendingCount,
      paidThisMonthByCurrency: paidTotals,
      approvedIncentivesByCurrency: incentiveTotals,
    },
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = paymentDraftSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please choose an employee and payment month and document any adjustment.", issues: parsed.error.issues }, { status: 400 });
  const range = utcMonthRange(parsed.data.period);
  const adjustmentPaise = parseMoneyToPaise(parsed.data.adjustmentAmount);
  if (!range || adjustmentPaise === null) return Response.json({ error: "Enter a valid payment period and adjustment." }, { status: 400 });
  await connectToDatabase();
  const employee = await User.findOne({ _id: parsed.data.employeeId, role: { $in: ["developer", "designer"] } }).select("fullName").lean();
  if (!employee) return Response.json({ error: "Employee not found." }, { status: 404 });
  const compensation = await Compensation.findOne({ employee: employee._id, effectiveDate: { $lte: range.start } })
    .sort({ effectiveDate: -1 })
    .lean();
  if (!compensation) return Response.json({ error: "No compensation is effective on the first day of this payment month." }, { status: 409 });

  const incentives = await Incentive.find({
    employee: employee._id,
    status: "approved",
    paymentRecord: { $exists: false },
    incentiveDate: { $gte: range.start, $lt: range.end },
  }).select("_id title amountPaise currency").lean();
  if (incentives.some((item) => item.currency !== compensation.currency)) {
    return Response.json({ error: "Approved incentives in a different currency must be resolved before creating this payment." }, { status: 409 });
  }
  const incentiveTotalPaise = incentives.reduce((total, item) => total + item.amountPaise, 0);
  const totalPayablePaise = compensation.baseAmountPaise + incentiveTotalPaise + adjustmentPaise;
  if (!Number.isSafeInteger(totalPayablePaise) || totalPayablePaise < 0) {
    return Response.json({ error: "The documented adjustment cannot make the total payable negative or exceed the supported amount." }, { status: 400 });
  }
  const createdAt = new Date();
  let payment;
  try {
    payment = await PaymentRecord.create({
      employee: employee._id,
      periodStart: range.start,
      periodEnd: new Date(range.end.getTime() - 1),
      compensation: compensation._id,
      currency: compensation.currency,
      baseAmountPaise: compensation.baseAmountPaise,
      incentives: incentives.map((item) => ({ incentive: item._id, title: item.title, amountPaise: item.amountPaise })),
      incentiveTotalPaise,
      adjustments: adjustmentPaise === 0 ? [] : [{
        amountPaise: adjustmentPaise,
        reason: sanitizePlainText(parsed.data.adjustmentReason),
        authorizedBy: auth.session.user.id,
        createdAt,
      }],
      totalPayablePaise,
      status: "draft",
      createdBy: auth.session.user.id,
      auditLog: [{
        action: "payment_draft_created",
        actor: auth.session.user.id,
        reason: sanitizePlainText(parsed.data.adjustmentReason),
        newValue: { baseAmountPaise: compensation.baseAmountPaise, incentiveTotalPaise, adjustmentsPaise: adjustmentPaise, totalPayablePaise },
        createdAt,
      }],
    });
  } catch (error) {
    if (isDuplicateKey(error)) return Response.json({ error: "A payment record already exists for this employee and month." }, { status: 409 });
    console.error("Could not create monthly payment record.", error);
    return Response.json({ error: "The payment draft could not be created." }, { status: 500 });
  }

  try {
    if (incentives.length) {
      const allocated = await Incentive.updateMany(
        { _id: { $in: incentives.map((item) => item._id) }, status: "approved", paymentRecord: { $exists: false } },
        { $set: { paymentRecord: payment._id } },
      );
      if (allocated.modifiedCount !== incentives.length) throw new Error("One or more incentives were allocated concurrently.");
    }
  } catch (error) {
    await Incentive.updateMany({ paymentRecord: payment._id }, { $unset: { paymentRecord: 1 } });
    await PaymentRecord.deleteOne({ _id: payment._id, status: "draft" });
    if (error instanceof Error && error.message.includes("allocated concurrently")) {
      return Response.json({ error: "An approved incentive was allocated to another payment. Refresh and retry." }, { status: 409 });
    }
    console.error("Could not allocate approved incentives to the payment draft.", error);
    return Response.json({ error: "The payment draft was rolled back because incentives could not be allocated." }, { status: 500 });
  }
  return Response.json({ payment: { id: payment.id, totalPayablePaise: payment.totalPayablePaise, currency: payment.currency } }, { status: 201 });
}
