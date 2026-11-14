import { isDuplicateKey, sanitizePlainText } from "@/lib/work/format";
import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { parseMoneyToPaise } from "@/lib/hr/money";
import { paymentReversalSchema } from "@/lib/hr/validation";
import { connectToDatabase } from "@/lib/db/mongodb";
import PaymentRecord from "@/models/PaymentRecord";
import PaymentReversal from "@/models/PaymentReversal";

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
  const parsed = paymentReversalSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Enter a valid reversal amount and reason.", issues: parsed.error.issues }, { status: 400 });
  const amountPaise = parseMoneyToPaise(parsed.data.amount);
  if (amountPaise === null || amountPaise < 1) return Response.json({ error: "Reversal amount must be greater than zero." }, { status: 400 });
  await connectToDatabase();
  const existing = await PaymentReversal.findOne({ payment: id, idempotencyKey: parsed.data.idempotencyKey }).lean();
  if (existing) return Response.json({ reversal: existing, alreadyRecorded: true });
  const payment = await PaymentRecord.findOne({ _id: id, status: "paid" }).select("employee paidAmountPaise").lean();
  if (!payment || !payment.paidAmountPaise) return Response.json({ error: "Only a recorded paid amount can be reversed." }, { status: 409 });
  const reserved = await PaymentRecord.findOneAndUpdate(
    {
      _id: payment._id,
      status: "paid",
      reversedAmountPaise: { $lte: payment.paidAmountPaise - amountPaise },
    },
    { $inc: { reversedAmountPaise: amountPaise } },
    { new: true },
  ).select("_id");
  if (!reserved) return Response.json({ error: "The reversal cannot exceed the remaining recorded payment amount." }, { status: 400 });
  try {
    const reversal = await PaymentReversal.create({
      payment: payment._id,
      employee: payment.employee,
      idempotencyKey: parsed.data.idempotencyKey,
      amountPaise,
      reason: sanitizePlainText(parsed.data.reason),
      recordedBy: auth.session.user.id,
    });
    return Response.json({ reversal }, { status: 201 });
  } catch (error) {
    await PaymentRecord.updateOne({ _id: payment._id, status: "paid" }, { $inc: { reversedAmountPaise: -amountPaise } });
    if (isDuplicateKey(error)) {
      const duplicate = await PaymentReversal.findOne({ payment: id, idempotencyKey: parsed.data.idempotencyKey }).lean();
      if (duplicate) return Response.json({ reversal: duplicate, alreadyRecorded: true });
    }
    console.error("Could not record payment reversal.", error);
    return Response.json({ error: "The payment reversal could not be recorded." }, { status: 500 });
  }
}
