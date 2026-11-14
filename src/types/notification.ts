export const notificationTypes = [
  "task_assigned",
  "task_deadline_approaching",
  "task_approved",
  "task_changes_requested",
  "task_submitted",
  "task_blocked",
  "announcement_published",
  "leave_requested",
  "leave_approved",
  "leave_rejected",
  "attendance_correction_requested",
  "incentive_approved",
  "payment_recorded",
  "work_report_submitted",
] as const;

export type NotificationType = (typeof notificationTypes)[number];
