import { model, models, Schema, type InferSchemaType } from "mongoose";
import {
  announcementAudiences,
  announcementCategories,
  announcementPriorities,
  announcementStatuses,
} from "@/types/announcement";

const announcementHistorySchema = new Schema(
  {
    action: { type: String, enum: ["created", "edited", "published", "archived"], required: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const announcementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
    message: { type: String, required: true, trim: true, minlength: 2, maxlength: 8000 },
    category: { type: String, enum: announcementCategories, required: true },
    priority: { type: String, enum: announcementPriorities, required: true, default: "normal" },
    audience: { type: String, enum: announcementAudiences, required: true },
    selectedEmployees: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    publishAt: { type: Date, required: true, index: true },
    expiresAt: { type: Date },
    status: { type: String, enum: announcementStatuses, required: true, default: "draft", index: true },
    publicationVersion: { type: Number, min: 0, default: 0, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    history: { type: [announcementHistorySchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

announcementSchema.index({ status: 1, publishAt: 1, expiresAt: 1 });
announcementSchema.index({ audience: 1, status: 1, publishAt: -1 });

export type AnnouncementDocument = InferSchemaType<typeof announcementSchema>;
const Announcement = models.Announcement || model("Announcement", announcementSchema);
export default Announcement;
