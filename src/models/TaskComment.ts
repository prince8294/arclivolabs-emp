import { model, models, Schema, type InferSchemaType } from "mongoose";

const taskCommentSchema = new Schema(
  {
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

taskCommentSchema.index({ task: 1, createdAt: 1 });

export type TaskCommentDocument = InferSchemaType<typeof taskCommentSchema>;
const TaskComment = models.TaskComment || model("TaskComment", taskCommentSchema);
export default TaskComment;
