import { z } from "zod";
import { priorities, projectStatuses, projectTypes, taskStatuses } from "@/types/work";

const httpUrl = z.string().trim().url().max(2048).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Only HTTP and HTTPS links are allowed.");
const optionalUrl = httpUrl.optional().or(z.literal(""));
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record ID.");
const cleanText = (max: number) => z.string().trim().max(max);

export const projectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(6000),
  type: z.enum(projectTypes),
  priority: z.enum(priorities),
  status: z.enum(projectStatuses),
  assignedEmployees: z.array(objectId).max(100).default([]),
  startDate: z.coerce.date(),
  deadline: z.coerce.date(),
  technologies: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  githubUrl: optionalUrl,
  figmaUrl: optionalUrl,
  notes: cleanText(4000).optional().or(z.literal("")),
}).refine((project) => project.startDate <= project.deadline, {
  path: ["deadline"],
  message: "Deadline must be on or after the project start date.",
});

export const taskSchema = z.object({
  project: objectId,
  title: z.string().trim().min(2).max(160),
  description: cleanText(6000).optional().or(z.literal("")),
  assignedTo: objectId,
  priority: z.enum(priorities),
  startDate: z.coerce.date().optional().or(z.literal("")),
  dueDate: z.coerce.date(),
  instructions: cleanText(6000).optional().or(z.literal("")),
  acceptanceCriteria: cleanText(4000).optional().or(z.literal("")),
}).refine((task) => !task.startDate || task.startDate <= task.dueDate, {
  path: ["dueDate"],
  message: "Due date must be on or after the task start date.",
});

export const employeeTaskActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("block"), reason: z.string().trim().min(3).max(2000) }),
  z.object({ action: z.literal("resume") }),
]);

export const taskCommentSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export const taskSubmissionSchema = z.object({
  githubUrl: optionalUrl,
  previewUrl: optionalUrl,
  figmaUrl: optionalUrl,
  submissionNotes: z.string().trim().max(4000).optional().or(z.literal("")),
}).refine((submission) => Boolean(
  submission.githubUrl
  || submission.previewUrl
  || submission.figmaUrl
  || (submission.submissionNotes && submission.submissionNotes.trim().length >= 20),
), {
  message: "Add at least one deliverable link or an explanation of 20 or more characters.",
});

export const taskReviewSchema = z.object({
  decision: z.enum(["approve", "request_changes"]),
  feedback: z.string().trim().max(4000).optional().or(z.literal("")),
}).refine((review) => review.decision !== "request_changes" || (review.feedback?.length ?? 0) >= 3, {
  path: ["feedback"],
  message: "Add feedback when requesting changes.",
});

export const archiveSchema = z.object({ archived: z.boolean().optional() });
