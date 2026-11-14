import { model, models, Schema, type InferSchemaType } from "mongoose";
import { leaveStatuses, leaveTypes } from "@/types/hr";

const leaveRequestSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    leaveType: { type: String, enum: leaveTypes, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalDays: { type: Number, required: true, min: 1, validate: Number.isInteger },
    coveredDates: { type: [Date], required: true, select: false },
    reason: { type: String, trim: true, required: true, maxlength: 2000 },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    status: { type: String, enum: leaveStatuses, required: true, default: "pending" },
    adminRemarks: { type: String, trim: true, maxlength: 2000, default: "" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

leaveRequestSchema.index({ employee: 1, createdAt: -1 });
leaveRequestSchema.index({ status: 1, startDate: 1 });
leaveRequestSchema.index({ employee: 1, startDate: 1, endDate: 1, status: 1 });

export type LeaveRequestDocument = InferSchemaType<typeof leaveRequestSchema>;
const LeaveRequest = models.LeaveRequest || model("LeaveRequest", leaveRequestSchema);
export default LeaveRequest;
