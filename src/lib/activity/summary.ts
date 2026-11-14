import { sessionWorkDurationInRange, todayUtcRange } from "@/lib/activity/time";
import BreakRecord from "@/models/BreakRecord";
import WorkSession from "@/models/WorkSession";

export async function getRecordedWorkInRange(
  filter: Record<string, unknown>,
  rangeStart: Date,
  rangeEnd: Date,
  now = new Date(),
) {
  const sessions = await WorkSession.find({
    $and: [
      filter,
      { startedAt: { $lt: rangeEnd } },
      { $or: [{ endedAt: { $gte: rangeStart } }, { endedAt: null }] },
    ],
  })
    .select("startedAt endedAt status recordedWorkDurationMs lastResumedAt")
    .lean();
  const breaks = await BreakRecord.find({
    session: { $in: sessions.map((session) => session._id) },
    startedAt: { $lt: rangeEnd },
  })
    .select("session startedAt endedAt")
    .lean();
  const breaksBySession = new Map<string, typeof breaks>();
  for (const breakRecord of breaks) {
    const key = String(breakRecord.session);
    const items = breaksBySession.get(key) ?? [];
    items.push(breakRecord);
    breaksBySession.set(key, items);
  }
  return sessions.reduce(
    (total, session) => total + sessionWorkDurationInRange(
      session,
      breaksBySession.get(String(session._id)) ?? [],
      rangeStart,
      rangeEnd,
      now,
    ),
    0,
  );
}

export async function getRecordedBreakInRange(
  filter: Record<string, unknown>,
  rangeStart: Date,
  rangeEnd: Date,
  now = new Date(),
) {
  const sessions = await WorkSession.find({
    $and: [
      filter,
      { startedAt: { $lt: rangeEnd } },
      { $or: [{ endedAt: { $gte: rangeStart } }, { endedAt: null }] },
    ],
  }).select("_id").lean();
  if (!sessions.length) return 0;
  const breaks = await BreakRecord.find({
    session: { $in: sessions.map((session) => session._id) },
    startedAt: { $lt: rangeEnd },
  })
    .select("startedAt endedAt")
    .lean();
  return breaks.reduce((total, item) => {
    const start = Math.max(new Date(item.startedAt).getTime(), rangeStart.getTime());
    const end = Math.min(item.endedAt ? new Date(item.endedAt).getTime() : now.getTime(), rangeEnd.getTime());
    return total + Math.max(0, end - start);
  }, 0);
}

export async function getTodayActivityTotals(filter: Record<string, unknown> = {}, now = new Date()) {
  const { start, end } = todayUtcRange(now);
  const [workDurationMs, breakDurationMs, completedSessions] = await Promise.all([
    getRecordedWorkInRange(filter, start, end, now),
    getRecordedBreakInRange(filter, start, end, now),
    WorkSession.countDocuments({
      ...filter,
      endedAt: { $gte: start, $lt: end },
    }),
  ]);
  return { workDurationMs, breakDurationMs, completedSessions };
}
