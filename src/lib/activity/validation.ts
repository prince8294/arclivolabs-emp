import { z } from "zod";
import { activityWorkStatuses, checkInIntervals } from "@/types/activity";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record ID.");
const readableText = (min: number, max: number) => z.string().trim().min(min).max(max);

export const startWorkSchema = z.object({ taskId: objectId });

export const sessionTransitionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("break") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("end") }),
]);

export const checkInSubmissionSchema = z.object({
  workStatus: z.enum(activityWorkStatuses),
  progressUpdate: readableText(5, 3000),
});

export const dailyWorkReportSchema = z.object({
  completedWork: readableText(10, 4000),
  pendingWork: z.string().trim().max(4000).optional().default(""),
  blockers: z.string().trim().max(3000).optional().default(""),
  notes: z.string().trim().max(3000).optional().default(""),
});

export const activitySettingsSchema = z.object({
  checkInIntervalMinutes: z.number().refine(
    (value): value is (typeof checkInIntervals)[number] => checkInIntervals.includes(value as (typeof checkInIntervals)[number]),
    "Choose a supported check-in interval.",
  ),
  checkInsEnabled: z.boolean(),
  dailyReportRequired: z.boolean(),
});

export const correctionSchema = z.object({
  endedAt: z.coerce.date(),
  reason: readableText(5, 2000),
});
