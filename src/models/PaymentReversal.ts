import { model, models, Schema, type InferSchemaType } from "mongoose";

const paymentReversalSchema = new Schema(
  {
    payment: { type: Schema.Types.ObjectId, ref: "PaymentRecord", required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    idempotencyKey: { type: String, required: true, maxlength: 80 },
    amountPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    reason: { type: String, required: true, trim: true, minlength: 5, maxlength: 2000 },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, required: true, default: Date.now, immutable: true },
  },
  { versionKey: false },
);

paymentReversalSchema.index({ employee: 1, createdAt: -1 });
paymentReversalSchema.index({ payment: 1, idempotencyKey: 1 }, { unique: true });

export type PaymentReversalDocument = InferSchemaType<typeof paymentReversalSchema>;
const PaymentReversal = models.PaymentReversal || model("PaymentReversal", paymentReversalSchema);
export default PaymentReversal;
