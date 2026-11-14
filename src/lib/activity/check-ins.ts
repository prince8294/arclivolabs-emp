import { isDuplicateKey } from "@/lib/work/format";
import ActivityCheckIn from "@/models/ActivityCheckIn";
import WorkSession from "@/models/WorkSession";

export async function ensureDueCheckIns(
  sessionId: string,
  employeeId: string,
  intervalMinutes: number,
  now = new Date(),
) {
  const intervalMs = intervalMinutes * 60_000;

  for (let index = 0; index < 1000; index += 1) {
    const session = await WorkSession.findOne({
      _id: sessionId,
      employee: employeeId,
      status: "working",
    })
      .select("task nextCheckInDueAt")
      .lean();
    const dueAt = session?.nextCheckInDueAt;
    if (!session || !dueAt || dueAt > now) return;

    try {
      await ActivityCheckIn.updateOne(
        { session: sessionId, scheduledAt: dueAt },
        {
          $setOnInsert: {
            employee: employeeId,
            session: sessionId,
            task: session.task,
            scheduledAt: dueAt,
            recordStatus: "pending",
          },
        },
        { upsert: true },
      );
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }

    const nextDueAt = new Date(dueAt.getTime() + intervalMs);
    const advanced = await WorkSession.updateOne(
      { _id: sessionId, employee: employeeId, status: "working", nextCheckInDueAt: dueAt },
      { $set: { nextCheckInDueAt: nextDueAt } },
    );
    if (advanced.modifiedCount === 0) continue;
  }
}
