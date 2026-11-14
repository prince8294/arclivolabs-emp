import { sessionWorkDurationInRange, overlapDurationInRange } from "@/lib/activity/time";
import AttendanceCorrection from "@/models/AttendanceCorrection";
import BreakRecord from "@/models/BreakRecord";
import LeaveRequest from "@/models/LeaveRequest";
import WorkSession from "@/models/WorkSession";
import { formatUtcDate } from "@/lib/hr/dates";

export interface AttendanceDayRecord {
  employeeId: string;
  date: string;
  recordedWorkMs: number;
  breakMs: number;
  firstStartAt: Date | null;
  lastEndAt: Date | null;
  approvedLeave: boolean;
  leaveTypes: string[];
  pendingCorrections: number;
  approvedAdjustmentMinutes: number;
  sessions: Array<Record<string, unknown> & { _id: unknown; startedAt: Date; endedAt?: Date | null }>;
}

function makeKey(employeeId: string, date: string) {
  return `${employeeId}:${date}`;
}

export async function getAttendanceDays(employeeIds: string[], rangeStart: Date, rangeEnd: Date, now = new Date()) {
  const days = new Map<string, AttendanceDayRecord>();
  const ensureDay = (employeeId: string, date: string) => {
    const key = makeKey(employeeId, date);
    let record = days.get(key);
    if (!record) {
      record = {
        employeeId,
        date,
        recordedWorkMs: 0,
        breakMs: 0,
        firstStartAt: null,
        lastEndAt: null,
        approvedLeave: false,
        leaveTypes: [],
        pendingCorrections: 0,
        approvedAdjustmentMinutes: 0,
        sessions: [],
      };
      days.set(key, record);
    }
    return record;
  };
  if (!employeeIds.length) return days;

  const [sessions, leaveRequests, corrections] = await Promise.all([
    WorkSession.find({
      employee: { $in: employeeIds },
      startedAt: { $lt: rangeEnd },
      $or: [{ endedAt: { $gte: rangeStart } }, { endedAt: null }],
    })
      .select("employee task project startedAt endedAt status recordedWorkDurationMs lastResumedAt")
      .populate({ path: "task", select: "taskId title status" })
      .populate({ path: "project", select: "projectId name status" })
      .sort({ startedAt: 1 })
      .lean(),
    LeaveRequest.find({
      employee: { $in: employeeIds },
      status: "approved",
      startDate: { $lt: rangeEnd },
      endDate: { $gte: rangeStart },
    })
      .select("employee leaveType startDate endDate totalDays status")
      .lean(),
    AttendanceCorrection.find({
      employee: { $in: employeeIds },
      attendanceDate: { $gte: rangeStart, $lt: rangeEnd },
      status: { $in: ["pending", "approved"] },
    })
      .select("employee attendanceDate status minutesAdjustment")
      .lean(),
  ]);
  const sessionIds = sessions.map((session) => session._id);
  const breaks = sessionIds.length
    ? await BreakRecord.find({ session: { $in: sessionIds }, startedAt: { $lt: rangeEnd } })
        .select("session startedAt endedAt")
        .lean()
    : [];
  const breaksBySession = new Map<string, typeof breaks>();
  for (const breakRecord of breaks) {
    const key = String(breakRecord.session);
    const entries = breaksBySession.get(key) ?? [];
    entries.push(breakRecord);
    breaksBySession.set(key, entries);
  }

  const dayCursor = new Date(rangeStart);
  while (dayCursor < rangeEnd) {
    const dayStart = new Date(dayCursor);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const date = formatUtcDate(dayStart);
    for (const employeeId of employeeIds) ensureDay(employeeId, date);
    for (const session of sessions) {
      const employeeId = String(session.employee);
      const day = ensureDay(employeeId, date);
      const sessionBreaks = breaksBySession.get(String(session._id)) ?? [];
      const workMs = sessionWorkDurationInRange(session, sessionBreaks, dayStart, dayEnd, now);
      const breakMs = sessionBreaks.reduce(
        (total, item) => total + overlapDurationInRange(item.startedAt, item.endedAt, dayStart, dayEnd, now),
        0,
      );
      if (workMs <= 0 && breakMs <= 0) continue;
      day.recordedWorkMs += workMs;
      day.breakMs += breakMs;
      day.sessions.push(session);
      if (workMs > 0) {
        const firstStart = new Date(Math.max(new Date(session.startedAt).getTime(), dayStart.getTime()));
        if (!day.firstStartAt || firstStart < day.firstStartAt) day.firstStartAt = firstStart;
      }
      if (session.endedAt && workMs > 0) {
        const lastEnd = new Date(Math.min(new Date(session.endedAt).getTime(), dayEnd.getTime()));
        if (!day.lastEndAt || lastEnd > day.lastEndAt) day.lastEndAt = lastEnd;
      }
    }
    dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
  }

  for (const leave of leaveRequests) {
    const start = new Date(Math.max(new Date(leave.startDate).getTime(), rangeStart.getTime()));
    const end = new Date(Math.min(new Date(leave.endDate).getTime(), rangeEnd.getTime() - 1));
    const cursor = new Date(start);
    cursor.setUTCHours(0, 0, 0, 0);
    while (cursor <= end) {
      const day = ensureDay(String(leave.employee), formatUtcDate(cursor));
      day.approvedLeave = true;
      if (!day.leaveTypes.includes(leave.leaveType)) day.leaveTypes.push(leave.leaveType);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  for (const correction of corrections) {
    const day = ensureDay(String(correction.employee), formatUtcDate(correction.attendanceDate));
    if (correction.status === "pending") day.pendingCorrections += 1;
    else day.approvedAdjustmentMinutes += correction.minutesAdjustment;
  }
  return days;
}

export function attendanceStatusFor(day: AttendanceDayRecord) {
  if (day.pendingCorrections > 0) return "pending_review";
  if (day.recordedWorkMs > 0) return "work_recorded";
  if (day.approvedLeave) return "approved_leave";
  return "no_work_recorded";
}
