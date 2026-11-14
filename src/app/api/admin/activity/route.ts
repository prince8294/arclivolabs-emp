import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { getRecordedWorkInRange } from "@/lib/activity/summary";
import { sessionDurationMs, todayUtcRange } from "@/lib/activity/time";
import { connectToDatabase } from "@/lib/db/mongodb";
import ActivityCheckIn from "@/models/ActivityCheckIn";
import BreakRecord from "@/models/BreakRecord";
import User from "@/models/User";
import WorkSession from "@/models/WorkSession";
import { workSessionStatuses, type WorkSessionStatus } from "@/types/activity";

function parseDate(value: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : date;
}

export async function GET(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  if (employeeId && !isValidObjectId(employeeId)) return Response.json({ error: "Select a valid employee." }, { status: 400 });
  const statusValue = searchParams.get("status");
  if (statusValue && !workSessionStatuses.includes(statusValue as WorkSessionStatus)) {
    return Response.json({ error: "Select a valid session status." }, { status: 400 });
  }
  const selectedDate = parseDate(searchParams.get("date"));
  if (selectedDate === undefined) return Response.json({ error: "Enter a date in YYYY-MM-DD format." }, { status: 400 });
  const now = new Date();
  const { start: todayStart, end: todayEnd } = todayUtcRange(now);
  const dateStart = selectedDate ?? todayStart;
  const dateEnd = new Date(dateStart);
  dateEnd.setUTCDate(dateEnd.getUTCDate() + 1);
  const page = Math.min(100_000, Math.max(1, Number(searchParams.get("page")) || 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 25));

  await connectToDatabase();
  const filterParts: Record<string, unknown>[] = [
    { startedAt: { $lt: dateEnd } },
    { $or: [{ endedAt: { $gte: dateStart } }, { endedAt: null }] },
  ];
  if (employeeId) filterParts.push({ employee: employeeId });
  if (statusValue) filterParts.push({ status: statusValue });
  const filter = { $and: filterParts };

  const [
    sessions,
    total,
    openSessions,
    employeesOnBreak,
    todayWorkDurationMs,
    pendingCheckIns,
    employees,
  ] = await Promise.all([
    WorkSession.find(filter)
      .select("employee task project startedAt endedAt status recordedWorkDurationMs totalBreakDurationMs lastResumedAt nextCheckInDueAt")
      .populate({ path: "employee", select: "employeeId fullName role" })
      .populate({ path: "task", select: "taskId title" })
      .populate({ path: "project", select: "projectId name" })
      .sort({ startedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    WorkSession.countDocuments(filter),
    WorkSession.countDocuments({ activeEmployeeId: { $exists: true }, status: { $in: ["working", "on_break"] } }),
    WorkSession.countDocuments({ activeEmployeeId: { $exists: true }, status: "on_break" }),
    getRecordedWorkInRange({}, todayStart, todayEnd, now),
    ActivityCheckIn.countDocuments({ recordStatus: "pending" }),
    User.find({ role: { $in: ["developer", "designer"] } })
      .select("employeeId fullName role status")
      .sort({ fullName: 1 })
      .lean(),
  ]);
  const sessionIds = sessions.map((session) => session._id);
  const latestCheckIns = sessionIds.length
    ? await ActivityCheckIn.find({ session: { $in: sessionIds }, recordStatus: "submitted" })
        .select("session submittedAt workStatus")
        .sort({ submittedAt: -1 })
        .lean()
    : [];
  const latestBySession = new Map<string, (typeof latestCheckIns)[number]>();
  for (const checkIn of latestCheckIns) {
    const key = String(checkIn.session);
    if (!latestBySession.has(key)) latestBySession.set(key, checkIn);
  }
  const sessionBreaks = sessionIds.length
    ? await BreakRecord.find({ session: { $in: sessionIds } }).select("session startedAt endedAt").lean()
    : [];
  const openBreakStart = new Map<string, Date>();
  for (const breakRecord of sessionBreaks) {
    if (!breakRecord.endedAt) openBreakStart.set(String(breakRecord.session), breakRecord.startedAt);
  }
  return Response.json({
    serverNow: now,
    overview: {
      openSessions,
      employeesOnBreak,
      todayWorkDurationMs,
      pendingCheckIns,
    },
    employees,
    sessions: sessions.map((session) => ({
      ...session,
      durationMs: sessionDurationMs(session, now),
      latestCheckIn: latestBySession.get(String(session._id)) ?? null,
      currentBreakStartedAt: openBreakStart.get(String(session._id)) ?? null,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
