import type { WorkSessionStatus } from "@/types/activity";

export interface TimedSession {
  startedAt: string | Date;
  endedAt?: string | Date | null;
  status: WorkSessionStatus;
  recordedWorkDurationMs: number;
  lastResumedAt?: string | Date | null;
}

export interface TimedBreak {
  startedAt: string | Date;
  endedAt?: string | Date | null;
}

export function sessionDurationMs(session: TimedSession, now = new Date()) {
  if (session.status !== "working" || !session.lastResumedAt) {
    return session.recordedWorkDurationMs;
  }
  return session.recordedWorkDurationMs + Math.max(0, now.getTime() - new Date(session.lastResumedAt).getTime());
}

export function sessionWorkDurationInRange(
  session: TimedSession,
  breaks: TimedBreak[],
  rangeStart: Date,
  rangeEnd: Date,
  now = new Date(),
) {
  const start = Math.max(new Date(session.startedAt).getTime(), rangeStart.getTime());
  const actualEnd = session.endedAt ? new Date(session.endedAt).getTime() : now.getTime();
  const end = Math.min(actualEnd, rangeEnd.getTime());
  if (end <= start) return 0;

  const breakMs = breaks.reduce((total, item) => {
    const breakStart = Math.max(new Date(item.startedAt).getTime(), start);
    const breakEnd = Math.min(item.endedAt ? new Date(item.endedAt).getTime() : actualEnd, end);
    return total + Math.max(0, breakEnd - breakStart);
  }, 0);
  return Math.max(0, end - start - breakMs);
}

export function overlapDurationInRange(
  startAt: string | Date,
  endAt: string | Date | null | undefined,
  rangeStart: Date,
  rangeEnd: Date,
  now = new Date(),
) {
  const start = Math.max(new Date(startAt).getTime(), rangeStart.getTime());
  const end = Math.min(endAt ? new Date(endAt).getTime() : now.getTime(), rangeEnd.getTime());
  return Math.max(0, end - start);
}

export function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function todayUtcRange(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
