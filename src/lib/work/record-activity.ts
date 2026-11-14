import TaskActivity from "@/models/TaskActivity";

type ActivityAction =
  | "task_created"
  | "employee_assigned"
  | "employee_reassigned"
  | "status_changed"
  | "submission_added"
  | "task_approved"
  | "changes_requested"
  | "task_archived";

export async function recordTaskActivity(
  task: string,
  actor: string,
  action: ActivityAction,
  previousValue?: unknown,
  newValue?: unknown,
) {
  await TaskActivity.create({ task, actor, action, previousValue, newValue });
}
