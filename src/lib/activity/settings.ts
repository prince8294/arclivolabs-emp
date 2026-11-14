import { connectToDatabase } from "@/lib/db/mongodb";
import ActivitySettings from "@/models/ActivitySettings";
import type { CheckInInterval } from "@/types/activity";

export const defaultActivitySettings = {
  checkInIntervalMinutes: 60 as CheckInInterval,
  checkInsEnabled: true,
  dailyReportRequired: true,
};

export async function getActivitySettings() {
  await connectToDatabase();
  return ActivitySettings.findOneAndUpdate(
    { key: "activity" },
    { $setOnInsert: { key: "activity", ...defaultActivitySettings } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )
    .select("checkInIntervalMinutes checkInsEnabled dailyReportRequired")
    .lean();
}
