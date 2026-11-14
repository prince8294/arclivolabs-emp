export function sanitizePlainText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

export function formatWorkDate(value: string | Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function startOfUtcDay(value = new Date()) {
  const day = new Date(value);
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

export function isWorkDateOverdue(value: string | Date, now = new Date()) {
  return new Date(value).toISOString().slice(0, 10) < startOfUtcDay(now).toISOString().slice(0, 10);
}

export function isDuplicateKey(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && error.code === 11000,
  );
}
