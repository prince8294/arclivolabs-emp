import { requireApiRole } from "@/lib/auth/authorization";
import { startWorkSchema } from "@/lib/activity/validation";
import { getActivitySettings } from "@/lib/activity/settings";
import { ensureDueCheckIns } from "@/lib/activity/check-ins";
import { getTodayActivityTotals } from "@/lib/activity/summary";
import { sessionDurationMs, todayUtcRange } from "@/lib/activity/time";
import { connectToDatabase } from "@/lib/db/mongodb";
import ActivityCheckIn from "@/models/ActivityCheckIn";
import BreakRecord from "@/models/BreakRecord";
import DailyWorkReport from "@/models/DailyWorkReport";
import Task from "@/models/Task";
import WorkSession from "@/models/WorkSession";
import { recordTaskActivity } from "@/lib/work/record-activity";

export async function GET() {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  await connectToDatabase();

  const employeeId = auth.session.user.id;
  const now = new Date();
  const settings = await getActivitySettings();
  let activeSession = await WorkSession.findOne({
    employee: employeeId,
    activeEmployeeId: employeeId,
    status: { $in: ["working", "on_break"] },
  })
    .select("+activeEmployeeId")
    .populate({ path: "task", select: "taskId title status" })
    .populate({ path: "project", select: "projectId name status" })
    .lean();

  if (activeSession?.status === "working" && settings?.checkInsEnabled) {
    await ensureDueCheckIns(
      String(activeSession._id),
      employeeId,
      settings.checkInIntervalMinutes,
      now,
    );
    activeSession = await WorkSession.findById(activeSession._id)
      .select("+activeEmployeeId")
      .populate({ path: "task", select: "taskId title status" })
      .populate({ path: "project", select: "projectId name status" })
      .lean();
  }

  const [tasks, rawSessions, summaries, draftReports, pendingCheckInCount, pendingReportCount] = await Promise.all([
    Task.find({
      assignedTo: employeeId,
      archivedAt: null,
      status: { $in: ["to_do", "in_progress"] },
    })
      .select("taskId title project priority status dueDate")
      .populate({ path: "project", select: "projectId name status" })
      .sort({ dueDate: 1 })
      .limit(100)
      .lean(),
    WorkSession.find({ employee: employeeId })
      .select("startedAt endedAt status recordedWorkDurationMs totalBreakDurationMs nextCheckInDueAt lastResumedAt task project")
      .populate({ path: "task", select: "taskId title" })
      .populate({ path: "project", select: "projectId name" })
      .sort({ startedAt: -1 })
      .limit(50)
      .lean(),
    getTodayActivityTotals({ employee: employeeId }, now),
    DailyWorkReport.find({ employee: employeeId, status: "draft" })
      .populate({
        path: "session",
        select: "startedAt endedAt recordedWorkDurationMs task project",
        populate: [
          { path: "task", select: "taskId title" },
          { path: "project", select: "projectId name" },
        ],
      })
      .sort({ reportDate: -1 })
      .limit(20)
      .lean(),
    ActivityCheckIn.countDocuments({ employee: employeeId, recordStatus: "pending" }),
    DailyWorkReport.countDocuments({ employee: employeeId, status: "draft" }),
  ]);
  const sessionIds = rawSessions.map((session) => session._id);
  const [breaks, checkInCounts, currentBreak, pendingCheckIns] = await Promise.all([
    BreakRecord.find({ session: { $in: sessionIds } })
      .select("session startedAt endedAt durationMs")
      .sort({ startedAt: -1 })
      .lean(),
    ActivityCheckIn.aggregate([
      { $match: { session: { $in: sessionIds } } },
      { $group: { _id: "$session", count: { $sum: 1 } } },
    ]),
    activeSession?.status === "on_break"
      ? BreakRecord.findOne({ session: activeSession._id, employee: employeeId, endedAt: null })
          .select("startedAt")
          .lean()
      : null,
    activeSession?.status === "working" && settings?.checkInsEnabled
      ? ActivityCheckIn.find({ session: activeSession._id, recordStatus: "pending" })
          .select("task workStatus progressUpdate scheduledAt submittedAt recordStatus")
          .sort({ scheduledAt: 1 })
          .lean()
      : [],
  ]);
  const countBySession = new Map(checkInCounts.map((entry) => [String(entry._id), entry.count]));
  const sessionBreaks = new Map<string, typeof breaks>();
  for (const breakRecord of breaks) {
    const key = String(breakRecord.session);
    const items = sessionBreaks.get(key) ?? [];
    items.push(breakRecord);
    sessionBreaks.set(key, items);
  }
  const sessions = rawSessions.map((session) => ({
    ...session,
    durationMs: sessionDurationMs(session, now),
    checkInCount: countBySession.get(String(session._id)) ?? 0,
    breaks: sessionBreaks.get(String(session._id)) ?? [],
  }));
  const today = todayUtcRange(now);
  const completedSessions = rawSessions.filter((session) => (
    session.endedAt
    && new Date(session.endedAt) >= today.start
    && new Date(session.endedAt) < today.end
  )).length;

  return Response.json({
    serverNow: now,
    settings: {
      checkInIntervalMinutes: settings?.checkInIntervalMinutes ?? 60,
      checkInsEnabled: settings?.checkInsEnabled ?? true,
      dailyReportRequired: settings?.dailyReportRequired ?? true,
    },
    availableTasks: tasks,
    canStartWork: !settings?.dailyReportRequired || pendingReportCount === 0,
    activeSession: activeSession ? {
      ...activeSession,
      durationMs: sessionDurationMs(activeSession, now),
      currentBreakStartedAt: currentBreak?.startedAt ?? null,
    } : null,
    pendingCheckIns,
    draftReports,
    sessions,
    summary: {
      todayWorkDurationMs: summaries.workDurationMs,
      todayBreakDurationMs: summaries.breakDurationMs,
      completedSessions: summaries.completedSessions ?? completedSessions,
      pendingCheckIns: pendingCheckInCount,
    },
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
  const parsed = startWorkSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Select one of your available tasks to start work." }, { status: 400 });

  await connectToDatabase();
  const employeeId = auth.session.user.id;
  const task = await Task.findOne({
    _id: parsed.data.taskId,
    assignedTo: employeeId,
    archivedAt: null,
    status: { $in: ["to_do", "in_progress"] },
  }).select("project status").lean();
  if (!task) return Response.json({ error: "This task is not available for your account." }, { status: 404 });

  const settings = await getActivitySettings();
  if (settings?.dailyReportRequired && await DailyWorkReport.exists({ employee: employeeId, status: "draft" })) {
    return Response.json({ error: "Complete your pending daily work report before starting another work session." }, { status: 409 });
  }
  const startedAt = new Date();
  let session: { _id: unknown; id: string; status: string };
  try {
    session = await WorkSession.create({
      employee: employeeId,
      task: task._id,
      project: task.project,
      startedAt,
      status: "working",
      activeEmployeeId: employeeId,
      lastResumedAt: startedAt,
      recordedWorkDurationMs: 0,
      totalBreakDurationMs: 0,
      ...(settings?.checkInsEnabled
        ? { nextCheckInDueAt: new Date(startedAt.getTime() + (settings?.checkInIntervalMinutes ?? 60) * 60_000) }
        : {}),
    }) as { _id: unknown; id: string; status: string };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return Response.json({ error: "You already have an open work session. Resume or end it before starting another." }, { status: 409 });
    }
    console.error("Unable to start work session.", error);
    return Response.json({ error: "The work session could not be started." }, { status: 500 });
  }

  let warning: string | undefined;
  if (task.status === "to_do") {
    const updatedTask = await Task.findOneAndUpdate(
      { _id: task._id, assignedTo: employeeId, status: "to_do", archivedAt: null },
      { $set: { status: "in_progress" } },
      { new: true },
    );
    if (!updatedTask) {
      const currentTask = await Task.findOne({ _id: task._id, assignedTo: employeeId, status: "in_progress", archivedAt: null }).select("_id").lean();
      if (!currentTask) {
        await WorkSession.deleteOne({ _id: session._id, activeEmployeeId: employeeId });
        return Response.json({ error: "The task changed before work could start. Refresh and choose an available task." }, { status: 409 });
      }
    } else {
      try {
        await recordTaskActivity(String(task._id), employeeId, "status_changed", "to_do", "in_progress");
      } catch (error) {
        console.error("Work session started, but task status history could not be recorded.", error);
        warning = "Your work session started, but the task status history could not be recorded.";
      }
    }
  }

  return Response.json({ session: { id: session.id, startedAt, status: session.status }, serverNow: new Date(), warning }, { status: 201 });
}
