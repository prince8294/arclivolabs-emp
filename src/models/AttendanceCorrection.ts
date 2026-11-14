import { model, models, Schema, type InferSchemaType } from "mongoose";
import { attendanceCorrectionStatuses } from "@/types/hr";

const attendanceCorrectionSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    attendanceDate: { type: Date, required: true },
    requestedChanges: { type: String, trim: true, required: true, maxlength: 2000 },
    approvedChanges: { type: String, trim: true, maxlength: 2000, default: "" },
    previousValue: { type: String, trim: true, maxlength: 2000, default: "" },
    updatedValue: { type: String, trim: true, maxlength: 2000, default: "" },
    minutesAdjustment: { type: Number, required: true, default: 0, min: -1440, max: 1440, validate: Number.isInteger },
    reason: { type: String, trim: true, required: true, maxlength: 2000 },
    reviewerRemarks: { type: String, trim: true, maxlength: 2000, default: "" },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: attendanceCorrectionStatuses, required: true, default: "pending" },
    reviewedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

attendanceCorrectionSchema.index({ employee: 1, attendanceDate: 1, status: 1 });
attendanceCorrectionSchema.index(
  { employee: 1, attendanceDate: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
attendanceCorrectionSchema.index({ status: 1, createdAt: -1 });

export type AttendanceCorrectionDocument = InferSchemaType<typeof attendanceCorrectionSchema>;
const AttendanceCorrection = models.AttendanceCorrection || model("AttendanceCorrection", attendanceCorrectionSchema);
export default AttendanceCorrection;
