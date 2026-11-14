import { model, models, Schema, type InferSchemaType } from "mongoose";
import { compensationTypes } from "@/types/hr";

const compensationAuditSchema = new Schema(
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

const compensationSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true },
    compensationType: { type: String, enum: compensationTypes, required: true },
    baseAmountPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    currency: { type: String, required: true, uppercase: true, default: "INR", match: /^[A-Z]{3}$/ },
    effectiveDate: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    auditLog: { type: [compensationAuditSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

compensationSchema.index({ employee: 1, effectiveDate: -1 });
compensationSchema.index({ employee: 1, effectiveDate: 1 }, { unique: true });

export type CompensationDocument = InferSchemaType<typeof compensationSchema>;
const Compensation = models.Compensation || model("Compensation", compensationSchema);
export default Compensation;
