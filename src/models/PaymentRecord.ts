import { model, models, Schema, type InferSchemaType } from "mongoose";
import { paymentMethods, paymentStatuses } from "@/types/hr";

const paymentAuditSchema = new Schema(
  {
    action: { type: String, required: true, maxlength: 80 },
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, trim: true, maxlength: 2000, default: "" },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const paymentIncentiveSchema = new Schema(
  {
    incentive: { type: Schema.Types.ObjectId, ref: "Incentive", required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    amountPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  },
  { _id: false },
);

const paymentAdjustmentSchema = new Schema(
  {
    amountPaise: { type: Number, required: true, validate: Number.isSafeInteger },
    reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 1000 },
    authorizedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const paymentRecordSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    compensation: { type: Schema.Types.ObjectId, ref: "Compensation", required: true },
    currency: { type: String, required: true, uppercase: true, match: /^[A-Z]{3}$/ },
    baseAmountPaise: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    incentives: { type: [paymentIncentiveSchema], default: [] },
    incentiveTotalPaise: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    adjustments: { type: [paymentAdjustmentSchema], default: [] },
    totalPayablePaise: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    status: { type: String, enum: paymentStatuses, required: true, default: "draft" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    paidAmountPaise: { type: Number, min: 0, validate: Number.isSafeInteger },
    reversedAmountPaise: { type: Number, min: 0, validate: Number.isSafeInteger, default: 0 },
    paidAt: { type: Date },
    paidBy: { type: Schema.Types.ObjectId, ref: "User" },
    paymentMethod: { type: String, enum: paymentMethods },
    transactionReference: { type: String, trim: true, maxlength: 200 },
    paymentNotes: { type: String, trim: true, maxlength: 2000 },
    auditLog: { type: [paymentAuditSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

paymentRecordSchema.index({ employee: 1, periodStart: 1 }, { unique: true });
paymentRecordSchema.index({ status: 1, periodStart: -1 });
paymentRecordSchema.index({ periodStart: -1, employee: 1 });

export type PaymentRecordDocument = InferSchemaType<typeof paymentRecordSchema>;
const PaymentRecord = models.PaymentRecord || model("PaymentRecord", paymentRecordSchema);
export default PaymentRecord;
