export type WorkspaceDateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

export function formatWorkspaceDate(date: Date, timeZone: string, format: WorkspaceDateFormat) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = values.year ?? "";
  const month = values.month ?? "";
  const day = values.day ?? "";
  if (format === "YYYY-MM-DD") return `${year}-${month}-${day}`;
  if (format === "MM/DD/YYYY") return `${month}/${day}/${year}`;
  return `${day}/${month}/${year}`;
}
