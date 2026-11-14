import { model, models, Schema, type InferSchemaType } from "mongoose";
import { incentiveStatuses } from "@/types/hr";

const incentiveAuditSchema = new Schema(
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

const incentiveSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "Project" },
    task: { type: Schema.Types.ObjectId, ref: "Task" },
    title: { type: String, trim: true, required: true, minlength: 2, maxlength: 120 },
    amountPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    currency: { type: String, required: true, uppercase: true, default: "INR", match: /^[A-Z]{3}$/ },
    reason: { type: String, trim: true, required: true, maxlength: 2000 },
    incentiveDate: { type: Date, required: true, index: true },
    status: { type: String, enum: incentiveStatuses, required: true, default: "pending" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    paymentRecord: { type: Schema.Types.ObjectId, ref: "PaymentRecord" },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
    auditLog: { type: [incentiveAuditSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

incentiveSchema.index({ employee: 1, createdAt: -1 });
incentiveSchema.index({ status: 1, createdAt: -1 });
incentiveSchema.index({ paymentRecord: 1 });

export type IncentiveDocument = InferSchemaType<typeof incentiveSchema>;
const Incentive = models.Incentive || model("Incentive", incentiveSchema);
export default Incentive;
