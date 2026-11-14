import { model, models, Schema, type InferSchemaType } from "mongoose";

const announcementReadSchema = new Schema(
  {
    announcement: { type: Schema.Types.ObjectId, ref: "Announcement", required: true },
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true },
    readAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

announcementReadSchema.index({ announcement: 1, employee: 1 }, { unique: true });
announcementReadSchema.index({ employee: 1, readAt: -1 });

export type AnnouncementReadDocument = InferSchemaType<typeof announcementReadSchema>;
const AnnouncementRead = models.AnnouncementRead || model("AnnouncementRead", announcementReadSchema);
export default AnnouncementRead;
