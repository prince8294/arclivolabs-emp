import { model, models, Schema, type InferSchemaType } from "mongoose";
import { workSessionStatuses } from "@/types/activity";

const workSessionSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null },
    status: { type: String, enum: workSessionStatuses, required: true, default: "working" },
    totalBreakDurationMs: { type: Number, min: 0, required: true, default: 0 },
    recordedWorkDurationMs: { type: Number, min: 0, required: true, default: 0 },
    lastResumedAt: { type: Date },
    nextCheckInDueAt: { type: Date },
    activeEmployeeId: { type: Schema.Types.ObjectId, ref: "User", select: false },
  },
  { timestamps: true, versionKey: false },
);

workSessionSchema.index({ activeEmployeeId: 1 }, { unique: true, sparse: true });
workSessionSchema.index({ employee: 1, startedAt: -1 });
workSessionSchema.index({ status: 1, startedAt: -1 });
workSessionSchema.index({ task: 1, startedAt: -1 });

export type WorkSessionDocument = InferSchemaType<typeof workSessionSchema>;
const WorkSession = models.WorkSession || model("WorkSession", workSessionSchema);
export default WorkSession;
