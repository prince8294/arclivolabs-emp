import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import Notification from "@/models/Notification";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin", "developer", "designer"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Notification not found." }, { status: 404 });
  await connectToDatabase();
  const notification = await Notification.findOneAndUpdate(
    { _id: id, recipient: auth.session.user.id, readAt: null },
    { $set: { readAt: new Date() } },
    { new: true },
  ).select("_id readAt").lean();
  if (notification) return Response.json({ notification });
  const existing = await Notification.findOne({ _id: id, recipient: auth.session.user.id }).select("_id readAt").lean();
  if (!existing) return Response.json({ error: "Notification not found." }, { status: 404 });
  return Response.json({ notification: existing, alreadyRead: true });
}
