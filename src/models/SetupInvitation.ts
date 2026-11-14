import { model, models, Schema, type InferSchemaType } from "mongoose";

const setupInvitationSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

setupInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SetupInvitationDocument = InferSchemaType<typeof setupInvitationSchema>;
const SetupInvitation = models.SetupInvitation || model("SetupInvitation", setupInvitationSchema);
export default SetupInvitation;
