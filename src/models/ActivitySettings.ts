import { model, models, Schema, type InferSchemaType } from "mongoose";
import { checkInIntervals } from "@/types/activity";

const activitySettingsSchema = new Schema(
  {
    key: { type: String, enum: ["activity"], unique: true, required: true },
    checkInIntervalMinutes: { type: Number, enum: checkInIntervals, default: 60, required: true },
    checkInsEnabled: { type: Boolean, default: true, required: true },
    dailyReportRequired: { type: Boolean, default: true, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false },
);

export type ActivitySettingsDocument = InferSchemaType<typeof activitySettingsSchema>;
const ActivitySettings = models.ActivitySettings || model("ActivitySettings", activitySettingsSchema);
export default ActivitySettings;
