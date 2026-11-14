import { createNotification } from "@/lib/notifications/create";
import Announcement from "@/models/Announcement";
import User from "@/models/User";

export async function notifyAnnouncementAudience(announcement: {
  _id: unknown;
  title: string;
  audience: string;
  selectedEmployees?: unknown[];
  publicationVersion: number;
  publishAt: Date;
  expiresAt?: Date | null;
}) {
  const now = new Date();
  if (announcement.publishAt > now || (announcement.expiresAt && announcement.expiresAt <= now)) return;
  const employeeFilter = announcement.audience === "all_employees"
    ? { role: { $in: ["developer", "designer"] } }
    : announcement.audience === "developers"
      ? { role: "developer" }
      : announcement.audience === "designers"
        ? { role: "designer" }
        : { _id: { $in: announcement.selectedEmployees ?? [] }, role: { $in: ["developer", "designer"] } };
  const employees = await User.find({ ...employeeFilter, status: "active" }).select("_id").lean();
  await Promise.all(employees.map((employee) => createNotification({
    recipient: String(employee._id),
    title: announcement.title,
    message: "A new announcement is available.",
    type: "announcement_published",
    resourceType: "announcement",
    resourceId: String(announcement._id),
    dedupeKey: `announcement:${String(announcement._id)}:${announcement.publicationVersion}:${String(employee._id)}`,
  })));
}

export async function notifyCurrentAnnouncements(employeeId: string, role: "developer" | "designer") {
  const now = new Date();
  const audience = role === "developer" ? "developers" : "designers";
  const announcements = await Announcement.find({
    status: "published",
    publishAt: { $lte: now },
    $and: [
      { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $or: [{ audience: "all_employees" }, { audience }, { audience: "selected_employees", selectedEmployees: employeeId }] },
    ],
  }).select("_id title publicationVersion publishAt expiresAt").sort({ publishAt: -1 }).limit(50).lean();
  await Promise.all(announcements.map((announcement) => createNotification({
    recipient: employeeId,
    title: announcement.title,
    message: "A new announcement is available.",
    type: "announcement_published",
    resourceType: "announcement",
    resourceId: String(announcement._id),
    dedupeKey: `announcement:${String(announcement._id)}:${announcement.publicationVersion}:${employeeId}`,
  })));
}
