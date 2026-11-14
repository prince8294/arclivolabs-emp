import { isDuplicateKey } from "@/lib/work/format";
import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { employeeAnnouncementFilter } from "@/lib/announcements/access";
import { connectToDatabase } from "@/lib/db/mongodb";
import Announcement from "@/models/Announcement";
import AnnouncementRead from "@/models/AnnouncementRead";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Announcement not found." }, { status: 404 });
  await connectToDatabase();
  const [announcement, read] = await Promise.all([
    Announcement.findOne({
      _id: id,
      ...employeeAnnouncementFilter(auth.session.user.id, auth.session.user.role),
    }).select("title message category priority publishAt expiresAt").lean(),
    AnnouncementRead.findOne({ announcement: id, employee: auth.session.user.id }).select("readAt").lean(),
  ]);
  if (!announcement) return Response.json({ error: "Announcement not found." }, { status: 404 });
  return Response.json({ announcement: { ...announcement, readAt: read?.readAt ?? null } });
}

export async function PATCH(_request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Announcement not found." }, { status: 404 });
  await connectToDatabase();
  const visible = await Announcement.exists({
    _id: id,
    ...employeeAnnouncementFilter(auth.session.user.id, auth.session.user.role),
  });
  if (!visible) return Response.json({ error: "Announcement not found." }, { status: 404 });
  const readAt = new Date();
  try {
    await AnnouncementRead.updateOne(
      { announcement: id, employee: auth.session.user.id },
      { $setOnInsert: { announcement: id, employee: auth.session.user.id, readAt } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    return Response.json({ readAt });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const read = await AnnouncementRead.findOne({ announcement: id, employee: auth.session.user.id }).select("readAt").lean();
    return Response.json({ readAt: read?.readAt ?? readAt });
  }
}
