import { model, models, Schema, type InferSchemaType } from "mongoose";
import { employeeRoles } from "../types/employee";
import type { AccountStatus, EmployeeRole, EmploymentType } from "../types/employee";

interface UserFields {
  employeeId: string;
  fullName: string;
  email: string;
  passwordHash?: string;
  role: EmployeeRole;
  department?: string;
  designation?: string;
  profilePicture?: string;
  phoneNumber?: string;
  skills: string[];
  employmentType: EmploymentType;
  internalNotes?: string;
  accountSetupCompleted: boolean;
  authVersion: number;
  lastLoginAt?: Date;
  status: AccountStatus;
  joiningDate: Date;
}

const userSchema = new Schema<UserFields>(
  {
    employeeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      minlength: 3,
      maxlength: 32,
    },
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: { type: String, select: false },
    role: { type: String, enum: employeeRoles, required: true },
    department: { type: String, trim: true, maxlength: 80 },
    designation: { type: String, trim: true, maxlength: 80 },
    profilePicture: { type: String, trim: true, maxlength: 2048 },
    phoneNumber: { type: String, trim: true, maxlength: 32 },
    skills: { type: [String], default: [] },
    employmentType: { type: String, enum: ["full_time", "part_time", "intern"], default: "full_time", required: true },
    internalNotes: { type: String, trim: true, maxlength: 2000 },
    accountSetupCompleted: { type: Boolean, default: true, required: true },
    authVersion: { type: Number, default: 0, required: true },
    lastLoginAt: { type: Date },
    status: {
      type: String,
      enum: ["pending_setup", "active", "inactive"],
      default: "active",
      required: true,
    },
    joiningDate: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ fullName: 1 });
userSchema.index({ joiningDate: -1 });

export type UserDocument = InferSchemaType<typeof userSchema>;

const User = models.User || model("User", userSchema);

export default User;
