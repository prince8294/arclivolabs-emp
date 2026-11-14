import { requireApiRole } from "@/lib/auth/authorization";
import { employeeAnnouncementFilter } from "@/lib/announcements/access";
import { announcementCategories } from "@/types/announcement";
import { connectToDatabase } from "@/lib/db/mongodb";
import Announcement from "@/models/Announcement";
import AnnouncementRead from "@/models/AnnouncementRead";

export async function GET(request: Request) {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  if (category && !announcementCategories.includes(category as (typeof announcementCategories)[number])) {
    return Response.json({ error: "Choose a valid announcement category." }, { status: 400 });
  }
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
  await connectToDatabase();
  const filter = employeeAnnouncementFilter(auth.session.user.id, auth.session.user.role);
  if (category) Object.assign(filter, { category });
  const [records, total] = await Promise.all([
    Announcement.find(filter)
      .select("title message category priority audience publishAt expiresAt createdAt updatedAt")
      .sort({ publishAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Announcement.countDocuments(filter),
  ]);
  const reads = records.length
    ? await AnnouncementRead.find({ employee: auth.session.user.id, announcement: { $in: records.map((item) => item._id) } })
        .select("announcement readAt")
        .lean()
    : [];
  const readById = new Map(reads.map((item) => [String(item.announcement), item.readAt]));
  return Response.json({
    records: records.map((announcement) => ({ ...announcement, readAt: readById.get(String(announcement._id)) ?? null })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
