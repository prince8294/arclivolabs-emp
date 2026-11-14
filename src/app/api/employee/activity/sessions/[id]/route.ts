import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { ensureDueCheckIns } from "@/lib/activity/check-ins";
import { getActivitySettings } from "@/lib/activity/settings";
import { sessionTransitionSchema } from "@/lib/activity/validation";
import { connectToDatabase } from "@/lib/db/mongodb";
import BreakRecord from "@/models/BreakRecord";
import DailyWorkReport from "@/models/DailyWorkReport";
import WorkSession from "@/models/WorkSession";

type RouteContext = { params: Promise<{ id: string }> };

function reportDateFor(startedAt: Date) {
  const date = new Date(startedAt);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

async function getOrCreateDraftReport(sessionId: string, employeeId: string, startedAt: Date) {
  return DailyWorkReport.findOneAndUpdate(
    { session: sessionId, employee: employeeId },
    {
      $setOnInsert: {
        employee: employeeId,
        session: sessionId,
        reportDate: reportDateFor(startedAt),
        status: "draft",
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
}

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Work session not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = sessionTransitionSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Choose a valid work-session action." }, { status: 400 });

  await connectToDatabase();
  const employeeId = auth.session.user.id;
  const now = new Date();
  const settings = await getActivitySettings();

  if (parsed.data.action === "end") {
    let ended = await WorkSession.findOne({ _id: id, employee: employeeId, status: "ended" })
      .select("startedAt endedAt status recordedWorkDurationMs totalBreakDurationMs task project")
      .lean();
    if (ended) {
      const report = await getOrCreateDraftReport(String(ended._id), employeeId, new Date(ended.startedAt));
      return Response.json({ session: ended, report, alreadyEnded: true, settings });
    }
  }

  let session = await WorkSession.findOne({
    _id: id,
    employee: employeeId,
    activeEmployeeId: employeeId,
    status: { $in: ["working", "on_break"] },
  })
    .select("+activeEmployeeId startedAt status recordedWorkDurationMs totalBreakDurationMs lastResumedAt nextCheckInDueAt task project")
    .lean();
  if (!session) return Response.json({ error: "This work session is not open for your account." }, { status: 404 });

  if (parsed.data.action === "break") {
    if (session.status !== "working" || !session.lastResumedAt) {
      return Response.json({ error: "A break can only start during a working session." }, { status: 409 });
    }
    if (settings?.checkInsEnabled) {
      await ensureDueCheckIns(id, employeeId, settings.checkInIntervalMinutes, now);
      session = await WorkSession.findById(id).select("+activeEmployeeId startedAt status recordedWorkDurationMs totalBreakDurationMs lastResumedAt nextCheckInDueAt task project").lean();
      if (!session || session.status !== "working" || !session.lastResumedAt) {
        return Response.json({ error: "The session changed before the break could start." }, { status: 409 });
      }
    }
    const breakRecord = await BreakRecord.create({ session: id, employee: employeeId, startedAt: now });
    const activeDuration = Math.max(0, now.getTime() - new Date(session.lastResumedAt).getTime());
    const changed = await WorkSession.findOneAndUpdate(
      { _id: id, employee: employeeId, activeEmployeeId: employeeId, status: "working", lastResumedAt: session.lastResumedAt },
      {
        $set: { status: "on_break" },
        $inc: { recordedWorkDurationMs: activeDuration },
        $unset: { lastResumedAt: 1 },
      },
      { new: true },
    )
      .select("startedAt status recordedWorkDurationMs totalBreakDurationMs nextCheckInDueAt")
      .lean();
    if (!changed) {
      await BreakRecord.deleteOne({ _id: breakRecord._id, endedAt: null });
      return Response.json({ error: "The session changed before the break could start. Refresh and try again." }, { status: 409 });
    }
    return Response.json({ session: changed, break: { id: breakRecord.id, startedAt: now }, serverNow: now });
  }

  if (parsed.data.action === "resume") {
    if (session.status !== "on_break") return Response.json({ error: "This session is not on a break." }, { status: 409 });
    const openBreak = await BreakRecord.findOne({ session: id, employee: employeeId, endedAt: null }).lean();
    if (!openBreak) return Response.json({ error: "The open break record could not be found." }, { status: 409 });
    const breakDurationMs = Math.max(0, now.getTime() - new Date(openBreak.startedAt).getTime());
    const dueAt = settings?.checkInsEnabled
      ? session.nextCheckInDueAt
        ? new Date(new Date(session.nextCheckInDueAt).getTime() + breakDurationMs)
        : new Date(now.getTime() + (settings.checkInIntervalMinutes ?? 60) * 60_000)
      : undefined;
    const closedBreak = await BreakRecord.findOneAndUpdate(
      { _id: openBreak._id, endedAt: null },
      { $set: { endedAt: now, durationMs: breakDurationMs } },
      { new: true },
    );
    if (!closedBreak) return Response.json({ error: "The break changed while resuming. Refresh and try again." }, { status: 409 });
    const changed = await WorkSession.findOneAndUpdate(
      { _id: id, employee: employeeId, activeEmployeeId: employeeId, status: "on_break" },
      {
        $set: { status: "working", lastResumedAt: now, ...(dueAt ? { nextCheckInDueAt: dueAt } : {}) },
        $inc: { totalBreakDurationMs: breakDurationMs },
        ...(!dueAt ? { $unset: { nextCheckInDueAt: 1 } } : {}),
      },
      { new: true },
    )
      .select("startedAt status recordedWorkDurationMs totalBreakDurationMs lastResumedAt nextCheckInDueAt")
      .lean();
    if (!changed) {
      await BreakRecord.updateOne(
        { _id: openBreak._id, endedAt: now },
        { $set: { endedAt: null, durationMs: 0 } },
      );
      return Response.json({ error: "The session changed while resuming. Refresh and try again." }, { status: 409 });
    }
    return Response.json({ session: changed, break: closedBreak, serverNow: now });
  }

  if (session.status === "working" && settings?.checkInsEnabled) {
    await ensureDueCheckIns(id, employeeId, settings.checkInIntervalMinutes, now);
    session = await WorkSession.findById(id).select("+activeEmployeeId startedAt status recordedWorkDurationMs totalBreakDurationMs lastResumedAt nextCheckInDueAt task project").lean();
    if (!session || !["working", "on_break"].includes(session.status)) {
      return Response.json({ error: "The session changed before it could be ended." }, { status: 409 });
    }
  }

  let closedBreak: Awaited<ReturnType<typeof BreakRecord.findOne>> | null = null;
  let breakDurationMs = 0;
  if (session.status === "on_break") {
    const openBreak = await BreakRecord.findOne({ session: id, employee: employeeId, endedAt: null }).lean();
    if (!openBreak) return Response.json({ error: "The open break record could not be found." }, { status: 409 });
    breakDurationMs = Math.max(0, now.getTime() - new Date(openBreak.startedAt).getTime());
    closedBreak = await BreakRecord.findOneAndUpdate(
      { _id: openBreak._id, endedAt: null },
      { $set: { endedAt: now, durationMs: breakDurationMs } },
      { new: true },
    );
    if (!closedBreak) return Response.json({ error: "The break changed while ending the session." }, { status: 409 });
  }
  const currentWorkDuration = session.status === "working" && session.lastResumedAt
    ? Math.max(0, now.getTime() - new Date(session.lastResumedAt).getTime())
    : 0;
  const recordedWorkDurationMs = session.recordedWorkDurationMs + currentWorkDuration;
  const ended = await WorkSession.findOneAndUpdate(
    { _id: id, employee: employeeId, activeEmployeeId: employeeId, status: session.status },
    {
      $set: {
        status: "ended",
        endedAt: now,
        recordedWorkDurationMs,
        ...(breakDurationMs ? { totalBreakDurationMs: session.totalBreakDurationMs + breakDurationMs } : {}),
      },
      $unset: { activeEmployeeId: 1, lastResumedAt: 1, nextCheckInDueAt: 1 },
    },
    { new: true },
  )
    .select("startedAt endedAt status recordedWorkDurationMs totalBreakDurationMs task project")
    .lean();
  if (!ended) {
    if (closedBreak) {
      await BreakRecord.updateOne(
        { _id: closedBreak._id, endedAt: now },
        { $set: { endedAt: null, durationMs: 0 } },
      );
    }
    return Response.json({ error: "The session changed while ending. Refresh and try again." }, { status: 409 });
  }

  let report;
  let warning: string | undefined;
  try {
    report = await getOrCreateDraftReport(id, employeeId, new Date(session.startedAt));
  } catch (error) {
    console.error("Work session ended but a daily report draft could not be created.", error);
    warning = "Your session ended, but the daily report draft could not be created. Reload and try again.";
  }
  return Response.json({ session: ended, report, serverNow: now, dailyReportRequired: settings?.dailyReportRequired ?? true, warning });
}
