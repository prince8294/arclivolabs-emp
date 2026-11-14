import { model, models, Schema, type InferSchemaType } from "mongoose";
import { priorities, projectStatuses, projectTypes } from "@/types/work";

const projectSchema = new Schema(
  {
    projectId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 6000 },
    type: { type: String, enum: projectTypes, required: true },
    priority: { type: String, enum: priorities, required: true, default: "medium" },
    status: { type: String, enum: projectStatuses, required: true, default: "planning" },
    assignedEmployees: [{ type: Schema.Types.ObjectId, ref: "User" }],
    startDate: { type: Date, required: true },
    deadline: { type: Date, required: true },
    technologies: [{ type: String, trim: true, maxlength: 40 }],
    githubUrl: { type: String, trim: true, maxlength: 2048 },
    figmaUrl: { type: String, trim: true, maxlength: 2048 },
    notes: { type: String, trim: true, maxlength: 4000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

projectSchema.index({ status: 1, deadline: 1, archivedAt: 1 });
projectSchema.index({ assignedEmployees: 1, archivedAt: 1 });
projectSchema.index({ name: 1 });

export type ProjectDocument = InferSchemaType<typeof projectSchema>;
const Project = models.Project || model("Project", projectSchema);
export default Project;
