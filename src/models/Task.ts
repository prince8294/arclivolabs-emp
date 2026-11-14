import { model, models, Schema, type InferSchemaType } from "mongoose";
import { priorities, taskStatuses } from "@/types/work";

const attachmentSchema = new Schema(
  {
    fileName: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true, maxlength: 100 },
    size: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
    storageKey: { type: String, required: true, select: false },
  },
  { _id: false },
);

const taskSchema = new Schema(
  {
    taskId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 6000, default: "" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    priority: { type: String, enum: priorities, default: "medium", required: true },
    status: { type: String, enum: taskStatuses, default: "to_do", required: true },
    startDate: { type: Date },
    dueDate: { type: Date, required: true },
    instructions: { type: String, trim: true, maxlength: 6000, default: "" },
    acceptanceCriteria: { type: String, trim: true, maxlength: 4000, default: "" },
    attachments: { type: [attachmentSchema], default: [] },
    blockedReason: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    completedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

taskSchema.index({ project: 1, archivedAt: 1, status: 1 });
taskSchema.index({ assignedTo: 1, archivedAt: 1, status: 1, dueDate: 1 });
taskSchema.index({ status: 1, updatedAt: -1 });

export type TaskDocument = InferSchemaType<typeof taskSchema>;
const Task = models.Task || model("Task", taskSchema);
export default Task;
