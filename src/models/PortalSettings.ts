import { model, models, Schema, type InferSchemaType } from "mongoose";

const portalSettingsSchema = new Schema(
  {
    key: { type: String, enum: ["employee"], required: true, unique: true },
    workspaceName: { type: String, trim: true, maxlength: 100, default: "ArclivoLabs" },
    companyLogoUrl: { type: String, trim: true, maxlength: 2048, default: "" },
    defaultTimeZone: { type: String, enum: ["UTC", "Asia/Kolkata", "Europe/London", "America/New_York"], default: "Asia/Kolkata" },
    dateFormat: { type: String, enum: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"], default: "DD/MM/YYYY" },
    invitationExpiryHours: { type: Number, min: 1, max: 720, default: 72 },
    activateOnSetup: { type: Boolean, default: true },
    employeeIdPrefix: { type: String, trim: true, uppercase: true, minlength: 2, maxlength: 12, default: "ARL" },
    nextEmployeeNumber: { type: Number, min: 1, default: 1 },
  },
  { timestamps: true, versionKey: false },
);

export type PortalSettingsDocument = InferSchemaType<typeof portalSettingsSchema>;
const PortalSettings = models.PortalSettings || model("PortalSettings", portalSettingsSchema);
export default PortalSettings;
