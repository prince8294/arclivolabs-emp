import { requireApiRole } from "@/lib/auth/authorization";
import { getAttendanceDays, attendanceStatusFor } from "@/lib/hr/attendance";
import { formatUtcDate, parseUtcDate, utcMonthRange } from "@/lib/hr/dates";
import { todayUtcRange } from "@/lib/activity/time";
import { connectToDatabase } from "@/lib/db/mongodb";
import AttendanceCorrection from "@/models/AttendanceCorrection";
import LeaveRequest from "@/models/LeaveRequest";
import { attendanceCorrectionRequestSchema } from "@/lib/hr/validation";
import { isDuplicateKey, sanitizePlainText } from "@/lib/work/format";
import { notifyActiveAdmins } from "@/lib/notifications/create";

export async function GET(request: Request) {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const range = utcMonthRange(month);
  if (!range) return Response.json({ error: "Choose a month in YYYY-MM format." }, { status: 400 });
  await connectToDatabase();

  const employeeId = auth.session.user.id;
  const { start: todayStart, end: todayEnd } = todayUtcRange();
  const [dayMap, todayMap, leaves, corrections] = await Promise.all([
    getAttendanceDays([employeeId], range.start, range.end),
    getAttendanceDays([employeeId], todayStart, todayEnd),
    LeaveRequest.find({ employee: employeeId, startDate: { $lt: range.end }, endDate: { $gte: range.start } })
      .select("leaveType startDate endDate totalDays reason notes status adminRemarks reviewedAt createdAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    AttendanceCorrection.find({
      employee: employeeId,
      attendanceDate: { $gte: range.start, $lt: range.end },
    })
      .select("attendanceDate requestedChanges approvedChanges previousValue updatedValue minutesAdjustment reason reviewerRemarks status reviewedAt createdAt")
      .sort({ attendanceDate: -1 })
      .lean(),
  ]);
  const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const approvedLeaveDays = days.filter((day) => day.approvedLeave).length;
  return Response.json({
    month,
    summary: {
      recordedWorkDays: days.filter((day) => day.recordedWorkMs > 0).length,
      recordedWorkMs: days.reduce((total, day) => total + day.recordedWorkMs, 0),
      approvedLeaveDays,
      todayRecordedWorkMs: todayMap.get(`${employeeId}:${formatUtcDate(todayStart)}`)?.recordedWorkMs ?? 0,
    },
    days: days.map((day) => ({ ...day, status: attendanceStatusFor(day) })),
    leaves,
    corrections,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = attendanceCorrectionRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Enter the affected date, requested change, and reason.", issues: parsed.error.issues }, { status: 400 });
  const attendanceDate = parseUtcDate(parsed.data.attendanceDate);
  if (!attendanceDate) return Response.json({ error: "Choose a valid attendance date." }, { status: 400 });
  await connectToDatabase();
  const existing = await AttendanceCorrection.exists({
    employee: auth.session.user.id,
    attendanceDate,
    status: "pending",
  });
  if (existing) return Response.json({ error: "A correction request for this date is already pending review." }, { status: 409 });
  try {
    const correction = await AttendanceCorrection.create({
      employee: auth.session.user.id,
      attendanceDate,
      requestedChanges: sanitizePlainText(parsed.data.requestedChanges),
      reason: sanitizePlainText(parsed.data.reason),
      requestedBy: auth.session.user.id,
      status: "pending",
      minutesAdjustment: 0,
    });
    let warning: string | undefined;
    try {
      await notifyActiveAdmins({
        title: "Attendance correction requested",
        message: `${auth.session.user.name ?? "An employee"} requested an attendance correction for ${formatUtcDate(attendanceDate)}.`,
        type: "attendance_correction_requested",
        resourceType: "attendance",
        resourceId: correction.id,
        dedupeKey: `attendance-correction:${correction.id}`,
      });
    } catch (error) {
      console.error("Attendance correction was saved but administrator notifications could not be created.", error);
      warning = "Your request was saved, but administrators could not be notified.";
    }
    return Response.json({ correction: { id: correction.id, attendanceDate: formatUtcDate(attendanceDate), status: correction.status }, warning }, { status: 201 });
  } catch (error) {
    if (isDuplicateKey(error)) return Response.json({ error: "A correction request for this date is already pending review." }, { status: 409 });
    throw error;
  }
}
