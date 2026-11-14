export const workSessionStatuses = ["working", "on_break", "ended"] as const;
export const activityWorkStatuses = ["working", "task_completed", "facing_issue"] as const;
export const checkInRecordStatuses = ["pending", "submitted", "missed"] as const;
export const dailyReportStatuses = ["draft", "submitted"] as const;
export const checkInIntervals = [30, 60, 90, 120] as const;

export type WorkSessionStatus = (typeof workSessionStatuses)[number];
export type ActivityWorkStatus = (typeof activityWorkStatuses)[number];
export type CheckInRecordStatus = (typeof checkInRecordStatuses)[number];
export type DailyReportStatus = (typeof dailyReportStatuses)[number];
export type CheckInInterval = (typeof checkInIntervals)[number];

export const workSessionStatusLabels: Record<WorkSessionStatus, string> = {
  working: "Working session open",
  on_break: "On break",
  ended: "Session ended",
};

export const activityWorkStatusLabels: Record<ActivityWorkStatus, string> = {
  working: "Working",
  task_completed: "Task completed",
  facing_issue: "Facing an issue",
};
