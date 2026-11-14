import { model, models, Schema, type InferSchemaType } from "mongoose";

const breakRecordSchema = new Schema(
  {
    session: { type: Schema.Types.ObjectId, ref: "WorkSession", required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null },
    durationMs: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

breakRecordSchema.index({ session: 1, startedAt: 1 });
breakRecordSchema.index({ employee: 1, startedAt: -1 });

export type BreakRecordDocument = InferSchemaType<typeof breakRecordSchema>;
const BreakRecord = models.BreakRecord || model("BreakRecord", breakRecordSchema);
export default BreakRecord;
