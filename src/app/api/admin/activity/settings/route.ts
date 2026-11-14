import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { activitySettingsSchema } from "@/lib/activity/validation";
import ActivitySettings from "@/models/ActivitySettings";
import WorkSession from "@/models/WorkSession";

export async function GET() {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const settings = await ActivitySettings.findOneAndUpdate(
    { key: "activity" },
    { $setOnInsert: { key: "activity", checkInIntervalMinutes: 60, checkInsEnabled: true, dailyReportRequired: true } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )
    .select("checkInIntervalMinutes checkInsEnabled dailyReportRequired updatedAt")
    .lean();
  return Response.json({ settings });
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = activitySettingsSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Choose a supported interval and valid activity settings.", issues: parsed.error.issues }, { status: 400 });

  await connectToDatabase();
  await ActivitySettings.findOneAndUpdate(
    { key: "activity" },
    { $setOnInsert: { key: "activity" } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  const settings = await ActivitySettings.findOneAndUpdate(
    { key: "activity" },
    { $set: { ...parsed.data, updatedBy: auth.session.user.id } },
    { new: true, runValidators: true },
  )
    .select("checkInIntervalMinutes checkInsEnabled dailyReportRequired updatedAt")
    .lean();

  if (parsed.data.checkInsEnabled) {
    const nextDueAt = new Date(Date.now() + parsed.data.checkInIntervalMinutes * 60_000);
    await WorkSession.updateMany(
      { status: "working", activeEmployeeId: { $exists: true } },
      { $set: { nextCheckInDueAt: nextDueAt } },
    );
    await WorkSession.updateMany({ status: "on_break" }, { $unset: { nextCheckInDueAt: 1 } });
  } else {
    await WorkSession.updateMany(
      { status: { $in: ["working", "on_break"] } },
      { $unset: { nextCheckInDueAt: 1 } },
    );
  }

  return Response.json({ settings });
}
