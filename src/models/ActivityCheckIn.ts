import { model, models, Schema, type InferSchemaType } from "mongoose";
import { activityWorkStatuses, checkInRecordStatuses } from "@/types/activity";

const activityCheckInSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    session: { type: Schema.Types.ObjectId, ref: "WorkSession", required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    workStatus: { type: String, enum: activityWorkStatuses },
    progressUpdate: { type: String, trim: true, maxlength: 3000, default: "" },
    scheduledAt: { type: Date, required: true },
    submittedAt: { type: Date },
    recordStatus: { type: String, enum: checkInRecordStatuses, required: true, default: "pending" },
  },
  { timestamps: true, versionKey: false },
);

activityCheckInSchema.index({ session: 1, scheduledAt: 1 }, { unique: true });
activityCheckInSchema.index({ employee: 1, recordStatus: 1, scheduledAt: -1 });

export type ActivityCheckInDocument = InferSchemaType<typeof activityCheckInSchema>;
const ActivityCheckIn = models.ActivityCheckIn || model("ActivityCheckIn", activityCheckInSchema);
export default ActivityCheckIn;
