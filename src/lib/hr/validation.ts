import { z } from "zod";
import { compensationTypes, leaveTypes, paymentMethods } from "@/types/hr";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record ID.");
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid calendar date.");
const money = z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/, "Enter an amount with at most two decimal places.");
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a three-letter currency code.");
const cleanText = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);

export const leaveRequestSchema = z.object({
  leaveType: z.enum(leaveTypes),
  startDate: dateOnly,
  endDate: dateOnly,
  reason: cleanText(5, 2000),
  notes: z.string().trim().max(2000).optional().default(""),
});

export const leaveReviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  adminRemarks: z.string().trim().max(2000).optional().default(""),
});

export const attendanceCorrectionRequestSchema = z.object({
  attendanceDate: dateOnly,
  requestedChanges: cleanText(5, 2000),
  reason: cleanText(5, 2000),
});

export const adminAttendanceCorrectionSchema = z.object({
  employeeId: objectId,
  attendanceDate: dateOnly,
  changes: cleanText(5, 2000),
  minutesAdjustment: z.number().int().min(-1440).max(1440),
  reason: cleanText(5, 2000),
});

export const attendanceCorrectionReviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  approvedChanges: z.string().trim().max(2000).optional().default(""),
  minutesAdjustment: z.number().int().min(-1440).max(1440).optional().default(0),
  reason: z.string().trim().max(2000).optional().default(""),
}).refine((value) => value.decision === "reject" || value.approvedChanges.length >= 5, {
  path: ["approvedChanges"],
  message: "Describe the approved attendance change.",
});

export const compensationSchema = z.object({
  employeeId: objectId,
  compensationType: z.enum(compensationTypes),
  baseAmount: money,
  currency,
  effectiveDate: dateOnly,
  notes: z.string().trim().max(2000).optional().default(""),
});

export const incentiveSchema = z.object({
  employeeId: objectId,
  projectId: objectId.optional().or(z.literal("")),
  taskId: objectId.optional().or(z.literal("")),
  title: cleanText(2, 120),
  amount: money,
  currency,
  reason: cleanText(5, 2000),
  date: dateOnly,
});

export const incentiveReviewSchema = z.object({
  action: z.enum(["approved", "cancelled"]),
  reason: z.string().trim().max(2000).optional().default(""),
});

export const paymentDraftSchema = z.object({
  employeeId: objectId,
  period: z.string().regex(/^\d{4}-\d{2}$/, "Choose a valid payment month."),
  adjustmentAmount: z.string().regex(/^-?\d{1,12}(?:\.\d{1,2})?$/, "Enter a valid adjustment amount."),
  adjustmentReason: z.string().trim().max(1000).optional().default(""),
}).refine((value) => {
  const parsed = Number(value.adjustmentAmount);
  return parsed === 0 || value.adjustmentReason.length >= 3;
}, { path: ["adjustmentReason"], message: "A non-zero adjustment requires a reason." });

export const paymentReviewSchema = z.object({
  decision: z.enum(["approve"]),
});

export const recordPaymentSchema = z.object({
  amountPaid: money,
  paymentDate: dateOnly,
  paymentMethod: z.enum(paymentMethods),
  transactionReference: z.string().trim().max(200).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

export const paymentReversalSchema = z.object({
  amount: money,
  reason: cleanText(5, 2000),
  idempotencyKey: z.string().trim().min(16).max(80),
});
