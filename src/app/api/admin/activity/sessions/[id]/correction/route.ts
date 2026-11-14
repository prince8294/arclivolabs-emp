import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { correctionSchema } from "@/lib/activity/validation";
import { connectToDatabase } from "@/lib/db/mongodb";
import ActivityCorrection from "@/models/ActivityCorrection";
import BreakRecord from "@/models/BreakRecord";
import DailyWorkReport from "@/models/DailyWorkReport";
import WorkSession from "@/models/WorkSession";

type RouteContext = { params: Promise<{ id: string }> };

function reportDateFor(startedAt: Date) {
  const date = new Date(startedAt);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Work session not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = correctionSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Provide a valid correction end time and reason.", issues: parsed.error.issues }, { status: 400 });

  await connectToDatabase();
  const session = await WorkSession.findOne({
    _id: id,
    activeEmployeeId: { $exists: true },
    status: { $in: ["working", "on_break"] },
  })
    .select("+activeEmployeeId employee startedAt status recordedWorkDurationMs totalBreakDurationMs lastResumedAt")
    .lean();
  if (!session) return Response.json({ error: "Only an open work session can be corrected." }, { status: 409 });

  const now = new Date();
  const endedAt = parsed.data.endedAt;
  if (endedAt < session.startedAt || endedAt > now) {
    return Response.json({ error: "The corrected end time must be after the session started and cannot be in the future." }, { status: 400 });
  }

  let openBreak: Awaited<ReturnType<typeof BreakRecord.findOne>> | null = null;
  let breakDurationMs = 0;
  if (session.status === "working") {
    if (!session.lastResumedAt || endedAt < session.lastResumedAt) {
      return Response.json({ error: "The corrected end time cannot be before the current work segment began." }, { status: 400 });
    }
  } else {
    openBreak = await BreakRecord.findOne({ session: id, employee: session.employee, endedAt: null }).lean();
    if (!openBreak) return Response.json({ error: "The open break record could not be found." }, { status: 409 });
    if (endedAt < openBreak.startedAt) return Response.json({ error: "The corrected end time cannot be before the current break began." }, { status: 400 });
    breakDurationMs = endedAt.getTime() - new Date(openBreak.startedAt).getTime();
  }

  const correction = await ActivityCorrection.create({
    session: id,
    employee: session.employee,
    reviewedBy: auth.session.user.id,
    reason: parsed.data.reason,
    previousStatus: session.status,
    correctedEndAt: endedAt,
  });
  if (openBreak) {
    const closedBreak = await BreakRecord.findOneAndUpdate(
      { _id: openBreak._id, endedAt: null },
      { $set: { endedAt, durationMs: breakDurationMs } },
      { new: true },
    );
    if (!closedBreak) {
      await ActivityCorrection.deleteOne({ _id: correction._id });
      return Response.json({ error: "The break changed while the correction was being applied. Refresh and retry." }, { status: 409 });
    }
  }

  const activeWorkMs = session.status === "working"
    ? endedAt.getTime() - new Date(session.lastResumedAt!).getTime()
    : 0;
  const updated = await WorkSession.findOneAndUpdate(
    { _id: id, activeEmployeeId: session.employee, status: session.status },
    {
      $set: {
        status: "ended",
        endedAt,
        recordedWorkDurationMs: session.recordedWorkDurationMs + Math.max(0, activeWorkMs),
        totalBreakDurationMs: session.totalBreakDurationMs + breakDurationMs,
      },
      $unset: { activeEmployeeId: 1, lastResumedAt: 1, nextCheckInDueAt: 1 },
    },
    { new: true },
  )
    .select("startedAt endedAt status recordedWorkDurationMs totalBreakDurationMs")
    .lean();
  if (!updated) {
    if (openBreak) {
      await BreakRecord.updateOne(
        { _id: openBreak._id, endedAt },
        { $set: { endedAt: null, durationMs: 0 } },
      );
    }
    await ActivityCorrection.deleteOne({ _id: correction._id });
    return Response.json({ error: "The session changed while the correction was being applied. Refresh and retry." }, { status: 409 });
  }

  let warning: string | undefined;
  try {
    await DailyWorkReport.updateOne(
      { session: id },
      {
        $setOnInsert: {
          employee: session.employee,
          session: id,
          reportDate: reportDateFor(new Date(session.startedAt)),
          status: "draft",
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    console.error("Corrected session ended but a daily report draft could not be created.", error);
    warning = "The session was corrected, but its daily report draft could not be created.";
  }
  return Response.json({ session: updated, correction, warning });
}
