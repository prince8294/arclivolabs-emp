import { model, models, Schema, type InferSchemaType } from "mongoose";

const activityCorrectionSchema = new Schema(
  {
    session: { type: Schema.Types.ObjectId, ref: "WorkSession", required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, trim: true, required: true, maxlength: 2000 },
    previousStatus: { type: String, required: true },
    correctedEndAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false },
);

activityCorrectionSchema.index({ employee: 1, createdAt: -1 });

export type ActivityCorrectionDocument = InferSchemaType<typeof activityCorrectionSchema>;
const ActivityCorrection = models.ActivityCorrection || model("ActivityCorrection", activityCorrectionSchema);
export default ActivityCorrection;
