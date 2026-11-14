import { model, models, Schema, type InferSchemaType } from "mongoose";

const deliverableLinkSchema = new Schema(
  {
    kind: { type: String, enum: ["github", "preview", "figma"], required: true },
    url: { type: String, required: true, maxlength: 2048 },
  },
  { _id: false },
);

const taskSubmissionSchema = new Schema(
  {
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deliverableLinks: { type: [deliverableLinkSchema], default: [] },
    attachmentReferences: { type: [Schema.Types.ObjectId], default: [] },
    submissionNotes: { type: String, trim: true, maxlength: 4000, default: "" },
    submittedAt: { type: Date, default: Date.now },
    reviewStatus: { type: String, enum: ["pending", "approved", "changes_requested"], default: "pending", required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewFeedback: { type: String, trim: true, maxlength: 4000 },
  },
  { timestamps: true, versionKey: false },
);

taskSubmissionSchema.index({ task: 1, submittedAt: -1 });
taskSubmissionSchema.index({ reviewStatus: 1, submittedAt: -1 });

export type TaskSubmissionDocument = InferSchemaType<typeof taskSubmissionSchema>;
const TaskSubmission = models.TaskSubmission || model("TaskSubmission", taskSubmissionSchema);
export default TaskSubmission;
