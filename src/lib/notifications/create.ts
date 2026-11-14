import { isDuplicateKey } from "@/lib/work/format";
import { connectToDatabase } from "@/lib/db/mongodb";
import Notification from "@/models/Notification";
import User from "@/models/User";
import type { NotificationType } from "@/types/notification";

type NotificationInput = {
  recipient: string;
  title: string;
  message: string;
  type: NotificationType;
  dedupeKey: string;
  resourceType?: "task" | "announcement" | "leave" | "attendance" | "report" | "incentive" | "payment";
  resourceId?: string;
  task?: string;
};

export async function createNotification(input: NotificationInput) {
  await connectToDatabase();
  try {
    await Notification.updateOne(
      { dedupeKey: input.dedupeKey },
      { $setOnInsert: { ...input, readAt: null } },
      { upsert: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }
}

export async function notifyActiveAdmins(
  notification: Omit<NotificationInput, "recipient" | "dedupeKey"> & { dedupeKey: string },
) {
  await connectToDatabase();
  const admins = await User.find({ role: "admin", status: "active" }).select("_id").lean();
  await Promise.all(admins.map((admin) => createNotification({
    ...notification,
    recipient: String(admin._id),
    dedupeKey: `${notification.dedupeKey}:${String(admin._id)}`,
  })));
}
