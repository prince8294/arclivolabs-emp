import { z } from "zod";
import { announcementAudiences, announcementCategories, announcementPriorities, announcementStatuses } from "@/types/announcement";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Choose a valid employee.");
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");

export const announcementSchema = z.object({
  title: z.string().trim().min(2).max(160),
  message: z.string().trim().min(2).max(8000),
  category: z.enum(announcementCategories),
  priority: z.enum(announcementPriorities),
  audience: z.enum(announcementAudiences),
  selectedEmployeeIds: z.array(objectId).max(500).default([]),
  publishAt: dateOnly,
  expiresAt: dateOnly.optional().or(z.literal("")),
  status: z.enum(announcementStatuses),
}).superRefine((value, context) => {
  if (value.audience === "selected_employees" && value.selectedEmployeeIds.length === 0) {
    context.addIssue({ code: "custom", path: ["selectedEmployeeIds"], message: "Select at least one active employee." });
  }
  if (value.audience !== "selected_employees" && value.selectedEmployeeIds.length > 0) {
    context.addIssue({ code: "custom", path: ["selectedEmployeeIds"], message: "Only selected-employee announcements can include specific employees." });
  }
});
