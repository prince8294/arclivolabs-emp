import { model, models, Schema, type InferSchemaType } from "mongoose";

const taskActivitySchema = new Schema(
  {
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    action: {
      type: String,
      enum: ["task_created", "employee_assigned", "employee_reassigned", "status_changed", "submission_added", "task_approved", "changes_requested", "task_archived"],
      required: true,
    },
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

taskActivitySchema.index({ task: 1, createdAt: -1 });

export type TaskActivityDocument = InferSchemaType<typeof taskActivitySchema>;
const TaskActivity = models.TaskActivity || model("TaskActivity", taskActivitySchema);
export default TaskActivity;
