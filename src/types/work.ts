export const projectStatuses = ["planning", "in_progress", "on_hold", "completed", "cancelled"] as const;
export const projectTypes = ["website", "web_application", "software", "other"] as const;
export const priorities = ["low", "medium", "high", "urgent"] as const;
export const taskStatuses = ["to_do", "in_progress", "blocked", "in_review", "completed"] as const;

export type ProjectStatus = (typeof projectStatuses)[number];
export type ProjectType = (typeof projectTypes)[number];
export type Priority = (typeof priorities)[number];
export type TaskStatus = (typeof taskStatuses)[number];

export const projectStatusLabels: Record<ProjectStatus, string> = {
  planning: "Planning",
  in_progress: "In progress",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  to_do: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  in_review: "In review",
  completed: "Completed",
};

export const priorityLabels: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};
