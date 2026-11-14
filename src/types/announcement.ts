export const announcementCategories = [
  "general",
  "important_update",
  "meeting",
  "project_update",
  "company_notice",
] as const;
export const announcementPriorities = ["normal", "important", "urgent"] as const;
export const announcementAudiences = ["all_employees", "developers", "designers", "selected_employees"] as const;
export const announcementStatuses = ["draft", "published", "archived"] as const;

export type AnnouncementCategory = (typeof announcementCategories)[number];
export type AnnouncementPriority = (typeof announcementPriorities)[number];
export type AnnouncementAudience = (typeof announcementAudiences)[number];
export type AnnouncementStatus = (typeof announcementStatuses)[number];

export const announcementCategoryLabels: Record<AnnouncementCategory, string> = {
  general: "General",
  important_update: "Important Update",
  meeting: "Meeting",
  project_update: "Project Update",
  company_notice: "Company Notice",
};

export const announcementPriorityLabels: Record<AnnouncementPriority, string> = {
  normal: "Normal",
  important: "Important",
  urgent: "Urgent",
};

export const announcementAudienceLabels: Record<AnnouncementAudience, string> = {
  all_employees: "All Employees",
  developers: "Developers Only",
  designers: "Designers Only",
  selected_employees: "Selected Employees",
};
