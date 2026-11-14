import { model, models, Schema, type InferSchemaType } from "mongoose";
import { dailyReportStatuses } from "@/types/activity";

const dailyWorkReportSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    session: { type: Schema.Types.ObjectId, ref: "WorkSession", required: true, unique: true },
    reportDate: { type: Date, required: true, index: true },
    completedWork: { type: String, trim: true, maxlength: 4000, default: "" },
    pendingWork: { type: String, trim: true, maxlength: 4000, default: "" },
    blockers: { type: String, trim: true, maxlength: 3000, default: "" },
    notes: { type: String, trim: true, maxlength: 3000, default: "" },
    status: { type: String, enum: dailyReportStatuses, required: true, default: "draft" },
    submittedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

dailyWorkReportSchema.index({ employee: 1, reportDate: -1 });

export type DailyWorkReportDocument = InferSchemaType<typeof dailyWorkReportSchema>;
const DailyWorkReport = models.DailyWorkReport || model("DailyWorkReport", dailyWorkReportSchema);
export default DailyWorkReport;
