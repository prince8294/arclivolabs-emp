import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { attendanceStatusFor, getAttendanceDays } from "@/lib/hr/attendance";
import { formatUtcDate, parseUtcDate, utcMonthRange } from "@/lib/hr/dates";
import { adminAttendanceCorrectionSchema } from "@/lib/hr/validation";
import { connectToDatabase } from "@/lib/db/mongodb";
import LeaveRequest from "@/models/LeaveRequest";
import User from "@/models/User";
import WorkSession from "@/models/WorkSession";
import { sanitizePlainText } from "@/lib/work/format";
import AttendanceCorrection from "@/models/AttendanceCorrection";
import { todayUtcRange } from "@/lib/activity/time";

export async function GET(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  if (employeeId && !isValidObjectId(employeeId)) return Response.json({ error: "Select a valid employee." }, { status: 400 });
  const status = searchParams.get("status");
  if (status && !["work_recorded", "no_work_recorded", "approved_leave", "pending_review"].includes(status)) {
    return Response.json({ error: "Choose a valid attendance status." }, { status: 400 });
  }
  const month = searchParams.get("month");
  const selectedDate = searchParams.get("date");
  const isCalendar = Boolean(month);
  const range = isCalendar ? utcMonthRange(month!) : null;
  if (isCalendar && !range) return Response.json({ error: "Choose a month in YYYY-MM format." }, { status: 400 });
  if (isCalendar && !employeeId) return Response.json({ error: "Select an employee to view the attendance calendar." }, { status: 400 });
  const date = selectedDate ? parseUtcDate(selectedDate) : null;
  if (selectedDate && !date) return Response.json({ error: "Choose a valid date." }, { status: 400 });
  const now = new Date();
  const { start: todayStart, end: todayEnd } = todayUtcRange(now);
  const rangeStart = range?.start ?? date ?? todayStart;
  const rangeEnd = range?.end ?? new Date(rangeStart.getTime() + 86_400_000);
  const page = Math.min(100_000, Math.max(1, Number(searchParams.get("page")) || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
  await connectToDatabase();

  const [employees, onBreakEmployeeIds, approvedLeaveEmployeeIds] = await Promise.all([
    User.find({ role: { $in: ["developer", "designer"] } })
      .select("employeeId fullName role designation status")
      .sort({ fullName: 1 })
      .lean(),
    WorkSession.distinct("employee", { activeEmployeeId: { $exists: true }, status: "on_break" }),
    LeaveRequest.distinct("employee", {
      status: "approved",
      startDate: { $lt: todayEnd },
      endDate: { $gte: todayStart },
    }),
  ]);
  const [corrections] = await Promise.all([
    AttendanceCorrection.find({
      attendanceDate: { $gte: rangeStart, $lt: rangeEnd },
      ...(employeeId ? { employee: employeeId } : {}),
    })
      .populate({ path: "employee", select: "employeeId fullName role" })
      .populate({ path: "requestedBy", select: "fullName role" })
      .populate({ path: "reviewedBy", select: "fullName" })
      .sort({ status: 1, createdAt: -1 })
      .lean(),
  ]);
  const employeeIds = isCalendar ? [employeeId!] : employeeId ? [employeeId] : employees.map((item) => String(item._id));
  const [daysMap, todayMap] = await Promise.all([
    getAttendanceDays(employeeIds, rangeStart, rangeEnd, now),
    getAttendanceDays(employees.map((item) => String(item._id)), todayStart, todayEnd, now),
  ]);
  const records = [...daysMap.values()].map((day) => ({
    ...day,
    status: attendanceStatusFor(day),
    adjustedWorkMs: Math.max(0, day.recordedWorkMs + day.approvedAdjustmentMinutes * 60_000),
  }));
  const employeeMap = new Map(employees.map((employee) => [String(employee._id), employee]));
  const output = records
    .filter((record) => !status || record.status === status)
    .sort((a, b) => a.date.localeCompare(b.date) || (employeeMap.get(a.employeeId)?.fullName ?? "").localeCompare(employeeMap.get(b.employeeId)?.fullName ?? ""));
  if (isCalendar) {
    return Response.json({
      month,
      employee: employeeMap.get(employeeId!) ?? null,
      days: output,
      corrections,
      overview: {
        employeesWithWorkToday: [...todayMap.values()].filter((day) => day.recordedWorkMs > 0).length,
        employeesOnBreak: onBreakEmployeeIds.length,
        recordedWorkMsToday: [...todayMap.values()].reduce((total, day) => total + day.recordedWorkMs, 0),
        approvedLeavesToday: approvedLeaveEmployeeIds.length,
      },
    });
  }
  const filtered = output.map((record) => ({ ...record, employee: employeeMap.get(record.employeeId) ?? null }));
  const { start: attendanceTodayStart } = todayUtcRange(now);
  const todayRows = [...todayMap.values()];
  return Response.json({
    date: formatUtcDate(rangeStart),
    overview: {
      employeesWithWorkToday: todayRows.filter((day) => day.recordedWorkMs > 0).length,
      employeesOnBreak: onBreakEmployeeIds.length,
      recordedWorkMsToday: todayRows.reduce((total, day) => total + day.recordedWorkMs, 0),
      approvedLeavesToday: approvedLeaveEmployeeIds.length,
    },
    employees,
    corrections,
    records: filtered.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total: filtered.length, pages: Math.ceil(filtered.length / limit) },
    isToday: attendanceTodayStart.getTime() === rangeStart.getTime(),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = adminAttendanceCorrectionSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Enter the employee, date, correction details, and reason.", issues: parsed.error.issues }, { status: 400 });
  const attendanceDate = parseUtcDate(parsed.data.attendanceDate);
  if (!attendanceDate) return Response.json({ error: "Choose a valid attendance date." }, { status: 400 });
  await connectToDatabase();
  const employee = await User.findOne({ _id: parsed.data.employeeId, role: { $in: ["developer", "designer"] } }).select("_id").lean();
  if (!employee) return Response.json({ error: "Employee not found." }, { status: 404 });
  const dateEnd = new Date(attendanceDate.getTime() + 86_400_000);
  const [day] = [...(await getAttendanceDays([parsed.data.employeeId], attendanceDate, dateEnd)).values()];
  const previousValue = `${day?.recordedWorkMs ?? 0} ms recorded work; ${day?.breakMs ?? 0} ms recorded breaks`;
  const changes = sanitizePlainText(parsed.data.changes);
  const correction = await AttendanceCorrection.create({
    employee: parsed.data.employeeId,
    attendanceDate,
    requestedChanges: changes,
    approvedChanges: changes,
    previousValue,
    updatedValue: `${changes}; ${parsed.data.minutesAdjustment} minute adjustment`,
    minutesAdjustment: parsed.data.minutesAdjustment,
    reason: sanitizePlainText(parsed.data.reason),
    requestedBy: auth.session.user.id,
    reviewedBy: auth.session.user.id,
    status: "approved",
    reviewedAt: new Date(),
  });
  return Response.json({ correction }, { status: 201 });
}
