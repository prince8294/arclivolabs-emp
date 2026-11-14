import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { parseMoneyToPaise } from "@/lib/hr/money";
import { parseUtcDate } from "@/lib/hr/dates";
import { recordPaymentSchema } from "@/lib/hr/validation";
import { connectToDatabase } from "@/lib/db/mongodb";
import PaymentRecord from "@/models/PaymentRecord";
import { createNotification } from "@/lib/notifications/create";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
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
  const parsed = recordPaymentSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Enter a valid payment amount, date, and method.", issues: parsed.error.issues }, { status: 400 });
  const amountPaidPaise = parseMoneyToPaise(parsed.data.amountPaid);
  const paidAt = parseUtcDate(parsed.data.paymentDate);
  if (amountPaidPaise === null || amountPaidPaise < 0 || !paidAt || paidAt > new Date()) {
    return Response.json({ error: "Enter a non-negative amount and a payment date that is not in the future." }, { status: 400 });
  }
  await connectToDatabase();
  const current = await PaymentRecord.findOne({ _id: id, status: { $in: ["approved", "paid"] } }).select("status totalPayablePaise paidAmountPaise").lean();
  if (!current) return Response.json({ error: "Only an approved payment can be marked paid." }, { status: 409 });
  if (current.status === "paid") return Response.json({ payment: current, alreadyPaid: true });
  if (amountPaidPaise !== current.totalPayablePaise) {
    return Response.json({ error: "The paid amount must match the approved payable amount. Record a documented reversal if a paid record needs correction." }, { status: 400 });
  }
  const payment = await PaymentRecord.findOneAndUpdate(
    { _id: id, status: "approved", totalPayablePaise: amountPaidPaise },
    {
      $set: {
        status: "paid",
        paidAmountPaise: amountPaidPaise,
        paidAt,
        paidBy: auth.session.user.id,
        paymentMethod: parsed.data.paymentMethod,
        transactionReference: parsed.data.transactionReference,
        paymentNotes: parsed.data.notes,
      },
      $push: {
        auditLog: {
          action: "payment_marked_paid",
          actor: auth.session.user.id,
          reason: parsed.data.notes,
          previousValue: "approved",
          newValue: "paid",
          createdAt: new Date(),
        },
      },
    },
    { new: true, runValidators: true },
  ).lean();
  if (!payment) {
    const latest = await PaymentRecord.findById(id).lean();
    if (latest?.status === "paid") return Response.json({ payment: latest, alreadyPaid: true });
    return Response.json({ error: "The payment changed while being recorded. Refresh and retry." }, { status: 409 });
  }
  let warning: string | undefined;
  try {
    await createNotification({
      recipient: String(payment.employee),
      title: "Payment recorded",
      message: "An administrator recorded your payment.",
      type: "payment_recorded",
      resourceType: "payment",
      resourceId: String(payment._id),
      dedupeKey: `payment-recorded:${String(payment._id)}`,
    });
  } catch (error) {
    console.error("Payment was recorded but the employee notification could not be created.", error);
    warning = "The payment was recorded, but the employee could not be notified.";
  }
  return Response.json({ payment, warning });
}
