import { model, models, Schema, type InferSchemaType } from "mongoose";
import { notificationTypes } from "@/types/notification";

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: notificationTypes, required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 500 },
    resourceType: { type: String, enum: ["task", "announcement", "leave", "attendance", "report", "incentive", "payment"] },
    resourceId: { type: Schema.Types.ObjectId },
    task: { type: Schema.Types.ObjectId, ref: "Task" },
    dedupeKey: { type: String, trim: true, maxlength: 240 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

notificationSchema.index({ recipient: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

export type NotificationDocument = InferSchemaType<typeof notificationSchema>;
const Notification = models.Notification || model("Notification", notificationSchema);
export default Notification;
