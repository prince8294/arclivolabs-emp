import { connectToDatabase } from "@/lib/db/mongodb";
import PortalSettings from "@/models/PortalSettings";
import { cache } from "react";

export async function getEmployeeSettings() {
  await connectToDatabase();
  try {
    const settings = await PortalSettings.findOneAndUpdate(
      { key: "employee" },
      { $setOnInsert: { key: "employee" } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    if (settings) return settings;
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== 11000) throw error;
  }

  const settings = await PortalSettings.findOne({ key: "employee" }).lean();
  if (!settings) throw new Error("Unable to load employee settings.");
  return settings;
}

export const getWorkspaceBranding = cache(async () => {
  await connectToDatabase();
  const settings = await PortalSettings.findOne({ key: "employee" })
    .select("workspaceName companyLogoUrl defaultTimeZone dateFormat")
    .lean();
  return {
    workspaceName: settings?.workspaceName ?? "ArclivoLabs",
    companyLogoUrl: settings?.companyLogoUrl ?? "",
    defaultTimeZone: settings?.defaultTimeZone ?? "Asia/Kolkata",
    dateFormat: settings?.dateFormat ?? "DD/MM/YYYY",
  };
});
