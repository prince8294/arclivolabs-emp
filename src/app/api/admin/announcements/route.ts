import { isDuplicateKey, sanitizePlainText } from "@/lib/work/format";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { parseUtcDate } from "@/lib/hr/dates";
import { announcementSchema } from "@/lib/announcements/validation";
import { notifyAnnouncementAudience } from "@/lib/announcements/notifications";
import { snapshotAnnouncement } from "@/lib/announcements/snapshot";
import Announcement from "@/models/Announcement";
import User from "@/models/User";
import { announcementCategories, announcementStatuses } from "@/types/announcement";

export async function GET(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const query = searchParams.get("q")?.trim().slice(0, 100);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
  if (status && !announcementStatuses.includes(status as (typeof announcementStatuses)[number])) {
    return Response.json({ error: "Choose a valid announcement status." }, { status: 400 });
  }
  if (category && !announcementCategories.includes(category as (typeof announcementCategories)[number])) {
    return Response.json({ error: "Choose a valid announcement category." }, { status: 400 });
  }
  await connectToDatabase();
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (query) filter.title = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const [records, total, employees] = await Promise.all([
    Announcement.find(filter)
      .select("-history")
      .populate({ path: "createdBy", select: "fullName" })
      .populate({ path: "updatedBy", select: "fullName" })
      .populate({ path: "selectedEmployees", select: "employeeId fullName role status" })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Announcement.countDocuments(filter),
    User.find({ role: { $in: ["developer", "designer"] }, status: "active" })
      .select("employeeId fullName role")
      .sort({ fullName: 1 })
      .lean(),
  ]);
  return Response.json({ records, employees, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = announcementSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please correct the announcement details.", issues: parsed.error.issues }, { status: 400 });
  const publishAt = parseUtcDate(parsed.data.publishAt);
  const expiresAt = parsed.data.expiresAt ? parseUtcDate(parsed.data.expiresAt) : null;
  if (expiresAt) expiresAt.setUTCHours(23, 59, 59, 999);
  if (!publishAt || (parsed.data.expiresAt && !expiresAt) || (expiresAt && expiresAt <= publishAt)) {
    return Response.json({ error: "Choose valid dates and make the expiration date later than the publish date." }, { status: 400 });
  }
  await connectToDatabase();
  const selectedIds = [...new Set(parsed.data.selectedEmployeeIds)];
  if (parsed.data.audience === "selected_employees") {
    const activeCount = await User.countDocuments({ _id: { $in: selectedIds }, role: { $in: ["developer", "designer"] }, status: "active" });
    if (activeCount !== selectedIds.length) return Response.json({ error: "Select only active employees." }, { status: 400 });
  }
  const createdAt = new Date();
  const announcementFields = {
    title: sanitizePlainText(parsed.data.title),
    message: sanitizePlainText(parsed.data.message),
    category: parsed.data.category,
    priority: parsed.data.priority,
    audience: parsed.data.audience,
    selectedEmployees: parsed.data.audience === "selected_employees" ? selectedIds : [],
    publishAt,
    ...(expiresAt ? { expiresAt } : {}),
    status: parsed.data.status,
    publicationVersion: parsed.data.status === "published" ? 1 : 0,
    createdBy: auth.session.user.id,
    updatedBy: auth.session.user.id,
  };
  const announcementValues = {
    ...announcementFields,
    history: [{
      action: parsed.data.status === "published" ? "published" : "created",
      actor: auth.session.user.id,
      newValue: snapshotAnnouncement(announcementFields),
      createdAt,
    }],
  };
  try {
    const announcement = await Announcement.create(announcementValues);
    if (announcement.status === "published") {
      try {
        await notifyAnnouncementAudience(announcement);
      } catch (error) {
        console.error("Announcement was saved but notifications could not be created.", error);
      }
    }
    return Response.json({ announcement: { id: announcement.id } }, { status: 201 });
  } catch (error) {
    if (isDuplicateKey(error)) return Response.json({ error: "This announcement could not be saved because of a conflicting record." }, { status: 409 });
    console.error("Could not create announcement.", error);
    return Response.json({ error: "The announcement could not be saved." }, { status: 500 });
  }
}
