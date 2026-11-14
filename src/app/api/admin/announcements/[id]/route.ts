import { isValidObjectId } from "mongoose";
import { isDuplicateKey, sanitizePlainText } from "@/lib/work/format";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { notifyAnnouncementAudience } from "@/lib/announcements/notifications";
import { snapshotAnnouncement } from "@/lib/announcements/snapshot";
import { announcementSchema } from "@/lib/announcements/validation";
import { parseUtcDate } from "@/lib/hr/dates";
import Announcement from "@/models/Announcement";
import User from "@/models/User";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Announcement not found." }, { status: 404 });
  await connectToDatabase();
  const announcement = await Announcement.findById(id)
    .populate({ path: "createdBy", select: "fullName" })
    .populate({ path: "updatedBy", select: "fullName" })
    .populate({ path: "history.actor", select: "fullName" })
    .populate({ path: "selectedEmployees", select: "employeeId fullName role status" })
    .lean();
  if (!announcement) return Response.json({ error: "Announcement not found." }, { status: 404 });
  return Response.json({ announcement });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Announcement not found." }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  await connectToDatabase();
  const current = await Announcement.findById(id).lean();
  if (!current) return Response.json({ error: "Announcement not found." }, { status: 404 });
  const now = new Date();

  if (typeof body === "object" && body !== null && "action" in body && body.action === "archive") {
    const updated = await Announcement.findOneAndUpdate(
      { _id: id, updatedAt: current.updatedAt },
      {
        $set: { status: "archived", updatedBy: auth.session.user.id },
        $push: {
          history: {
            action: "archived",
            actor: auth.session.user.id,
            previousValue: snapshotAnnouncement(current),
            newValue: snapshotAnnouncement({ ...current, status: "archived" }),
            createdAt: now,
          },
        },
      },
      { new: true, runValidators: true },
    ).lean();
    return updated
      ? Response.json({ announcement: { id: updated.id, status: updated.status } })
      : Response.json({ error: "This announcement changed while it was being archived. Refresh and retry." }, { status: 409 });
  }

  const parsed = announcementSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please correct the announcement details.", issues: parsed.error.issues }, { status: 400 });
  const publishAt = parseUtcDate(parsed.data.publishAt);
  const expiresAt = parsed.data.expiresAt ? parseUtcDate(parsed.data.expiresAt) : null;
  if (expiresAt) expiresAt.setUTCHours(23, 59, 59, 999);
  if (!publishAt || (parsed.data.expiresAt && !expiresAt) || (expiresAt && expiresAt <= publishAt)) {
    return Response.json({ error: "Choose valid dates and make the expiration date later than the publish date." }, { status: 400 });
  }
  const selectedIds = [...new Set(parsed.data.selectedEmployeeIds)];
  if (parsed.data.audience === "selected_employees") {
    const activeCount = await User.countDocuments({ _id: { $in: selectedIds }, role: { $in: ["developer", "designer"] }, status: "active" });
    if (activeCount !== selectedIds.length) return Response.json({ error: "Select only active employees." }, { status: 400 });
  }
  const fields = {
    title: sanitizePlainText(parsed.data.title),
    message: sanitizePlainText(parsed.data.message),
    category: parsed.data.category,
    priority: parsed.data.priority,
    audience: parsed.data.audience,
    selectedEmployees: parsed.data.audience === "selected_employees" ? selectedIds : [],
    publishAt,
    ...(expiresAt ? { expiresAt } : {}),
    status: parsed.data.status,
  };
  const previousValue = snapshotAnnouncement(current);
  const nextValue = snapshotAnnouncement({
    ...fields,
    selectedEmployees: fields.selectedEmployees,
    expiresAt,
  });
  const changedPublication = JSON.stringify(previousValue) !== JSON.stringify(nextValue);
  const currentPublicationVersion = current.publicationVersion ?? 0;
  const publicationVersion = currentPublicationVersion + (
    parsed.data.status === "published" && (current.status !== "published" || changedPublication) ? 1 : 0
  );
  const action = parsed.data.status === "archived"
    ? "archived"
    : parsed.data.status === "published" && current.status !== "published"
      ? "published"
      : "edited";
  const updateFields = { ...fields, updatedBy: auth.session.user.id, publicationVersion };
  try {
    const updated = await Announcement.findOneAndUpdate(
      { _id: id, updatedAt: current.updatedAt },
      {
        $set: updateFields,
        ...(!expiresAt ? { $unset: { expiresAt: 1 } } : {}),
        $push: {
          history: {
            action,
            actor: auth.session.user.id,
            previousValue,
            newValue: nextValue,
            createdAt: now,
          },
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) return Response.json({ error: "This announcement changed while it was being edited. Refresh and retry." }, { status: 409 });
    if (updated.status === "published" && updated.publicationVersion !== currentPublicationVersion) {
      try {
        await notifyAnnouncementAudience(updated);
      } catch (error) {
        console.error("Announcement was saved but notifications could not be created.", error);
      }
    }
    return Response.json({ announcement: { id: updated.id, status: updated.status } });
  } catch (error) {
    if (isDuplicateKey(error)) return Response.json({ error: "The announcement could not be updated." }, { status: 409 });
    console.error("Could not update announcement.", error);
    return Response.json({ error: "The announcement could not be updated." }, { status: 500 });
  }
}
