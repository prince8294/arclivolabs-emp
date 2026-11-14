import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalImageUrl = z.string().trim().url().max(2048).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Use an HTTP or HTTPS image URL.").optional().or(z.literal(""));
const securePassword = z.string().min(12).max(128).refine(
  (value) => new TextEncoder().encode(value).length <= 72,
  "Password must be no more than 72 UTF-8 bytes.",
);
const skillsSchema = z.array(z.string().trim().min(1).max(40)).max(30).default([]);
const dateSchema = z.coerce.date();

export const createEmployeeSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  role: z.enum(["developer", "designer"]),
  designation: z.string().trim().min(2).max(80),
  joiningDate: dateSchema,
  phoneNumber: optionalText(32),
  profilePicture: optionalImageUrl,
  skills: skillsSchema,
  employmentType: z.enum(["full_time", "part_time", "intern"]).default("full_time"),
  internalNotes: optionalText(2000),
});

export const updateEmployeeSchema = createEmployeeSchema.omit({ email: true }).extend({
  email: z.string().trim().email().max(254),
});

export const employeeProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phoneNumber: optionalText(32),
  profilePicture: optionalImageUrl,
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: securePassword,
});

export const setupPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password: securePassword,
});

export const settingsSchema = z.object({
  workspaceName: z.string().trim().min(2).max(100),
  companyLogoUrl: optionalImageUrl,
  defaultTimeZone: z.enum(["UTC", "Asia/Kolkata", "Europe/London", "America/New_York"]),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
  invitationExpiryHours: z.number().int().min(1).max(720),
  activateOnSetup: z.boolean(),
  employeeIdPrefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,12}$/),
});
