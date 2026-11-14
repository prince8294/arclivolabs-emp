export function snapshotAnnouncement(value: {
  title: string;
  message: string;
  category: string;
  priority: string;
  audience: string;
  selectedEmployees?: unknown[];
  publishAt: Date;
  expiresAt?: Date | null;
  status: string;
}) {
  return {
    title: value.title,
    message: value.message,
    category: value.category,
    priority: value.priority,
    audience: value.audience,
    selectedEmployees: (value.selectedEmployees ?? []).map(String),
    publishAt: value.publishAt,
    expiresAt: value.expiresAt ?? null,
    status: value.status,
  };
}
