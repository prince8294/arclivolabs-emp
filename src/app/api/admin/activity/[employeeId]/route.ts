import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { sessionDurationMs } from "@/lib/activity/time";
import { connectToDatabase } from "@/lib/db/mongodb";
import ActivityCheckIn from "@/models/ActivityCheckIn";
import ActivityCorrection from "@/models/ActivityCorrection";
import BreakRecord from "@/models/BreakRecord";
import DailyWorkReport from "@/models/DailyWorkReport";
import User from "@/models/User";
import WorkSession from "@/models/WorkSession";

type RouteContext = { params: Promise<{ employeeId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { employeeId } = await params;
  if (!isValidObjectId(employeeId)) return Response.json({ error: "Employee not found." }, { status: 404 });
  await connectToDatabase();

  const employee = await User.findOne({
    _id: employeeId,
    role: { $in: ["developer", "designer"] },
  })
    .select("employeeId fullName email role designation profilePicture status")
    .lean();
  if (!employee) return Response.json({ error: "Employee not found." }, { status: 404 });

  const [sessions, reports, corrections] = await Promise.all([
    WorkSession.find({ employee: employeeId })
      .select("+activeEmployeeId employee task project startedAt endedAt status recordedWorkDurationMs totalBreakDurationMs lastResumedAt nextCheckInDueAt")
      .populate({ path: "task", select: "taskId title status" })
      .populate({ path: "project", select: "projectId name" })
      .sort({ startedAt: -1 })
      .limit(100)
      .lean(),
    DailyWorkReport.find({ employee: employeeId })
      .populate({
        path: "session",
        select: "startedAt endedAt recordedWorkDurationMs task project",
        populate: [
          { path: "task", select: "taskId title" },
          { path: "project", select: "projectId name" },
        ],
      })
      .sort({ reportDate: -1 })
      .limit(100)
      .lean(),
    ActivityCorrection.find({ employee: employeeId })
      .populate({ path: "reviewedBy", select: "fullName email" })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ]);
  const sessionIds = sessions.map((session) => session._id);
  const [breaks, checkIns] = await Promise.all([
    BreakRecord.find({ session: { $in: sessionIds } })
      .select("session employee startedAt endedAt durationMs")
      .sort({ startedAt: -1 })
      .lean(),
    ActivityCheckIn.find({ session: { $in: sessionIds } })
      .populate({ path: "task", select: "taskId title" })
      .sort({ scheduledAt: -1 })
      .lean(),
  ]);
  const serverNow = new Date();
  return Response.json({
    employee,
    serverNow,
    sessions: sessions.map((session) => ({ ...session, durationMs: sessionDurationMs(session, serverNow) })),
    breaks: breaks.map((item) => ({
      ...item,
      currentDurationMs: item.endedAt ? item.durationMs : Math.max(0, serverNow.getTime() - new Date(item.startedAt).getTime()),
    })),
    checkIns,
    reports,
    corrections,
  });
}
