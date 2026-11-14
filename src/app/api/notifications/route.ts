import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { notifyCurrentAnnouncements } from "@/lib/announcements/notifications";
import { connectToDatabase } from "@/lib/db/mongodb";
import { createNotification } from "@/lib/notifications/create";
import Notification from "@/models/Notification";
import Task from "@/models/Task";

function notificationHref(notification: {
  type: string;
  resourceType?: string;
  resourceId?: unknown;
}, isAdmin: boolean) {
  const id = notification.resourceId && isValidObjectId(String(notification.resourceId))
    ? String(notification.resourceId)
    : null;
  if (notification.resourceType === "task" && id) return `${isAdmin ? "/admin" : "/employee"}/tasks/${id}`;
  if (notification.resourceType === "announcement" && id && !isAdmin) return `/employee/announcements/${id}`;
  if (notification.resourceType === "announcement") return "/admin/announcements";
  if (notification.resourceType === "leave") return isAdmin ? "/admin/leaves" : "/employee/attendance";
  if (notification.resourceType === "attendance") return isAdmin ? "/admin/attendance" : "/employee/attendance";
  if (notification.resourceType === "report") return isAdmin ? "/admin/activity" : "/employee/activity";
  if (notification.resourceType === "incentive") return isAdmin ? "/admin/payments" : "/employee/earnings";
  if (notification.resourceType === "payment" && id) return isAdmin ? `/admin/payments/${id}` : `/employee/earnings/${id}`;
  if (notification.type === "task_approved" || notification.type === "task_changes_requested") return "/employee/tasks";
  return isAdmin ? "/admin/dashboard" : "/employee/dashboard";
}

export async function GET(request: Request) {
  const auth = await requireApiRole(["admin", "developer", "designer"]);
  if (!auth.session) return auth.response;
  await connectToDatabase();
  const isAdmin = auth.session.user.role === "admin";

  if (auth.session.user.role === "developer" || auth.session.user.role === "designer") {
    const employeeRole = auth.session.user.role;
    await notifyCurrentAnnouncements(auth.session.user.id, employeeRole);
    const now = new Date();
    const approaching = await Task.find({
      assignedTo: auth.session.user.id,
      archivedAt: null,
      status: { $in: ["to_do", "in_progress", "blocked", "in_review"] },
      dueDate: { $gte: now, $lte: new Date(now.getTime() + 48 * 60 * 60 * 1000) },
    }).select("_id title dueDate").limit(100).lean();
    await Promise.all(approaching.map((task) => createNotification({
      recipient: auth.session.user.id,
      title: "Task deadline approaching",
      message: `"${task.title}" is due soon.`,
      type: "task_deadline_approaching",
      resourceType: "task",
      resourceId: String(task._id),
      task: String(task._id),
      dedupeKey: `task-deadline:${String(task._id)}`,
    })));
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const [records, unreadCount, total] = await Promise.all([
    Notification.find({ recipient: auth.session.user.id })
      .select("title message type resourceType resourceId task readAt createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ recipient: auth.session.user.id, readAt: null }),
    Notification.countDocuments({ recipient: auth.session.user.id }),
  ]);
  return Response.json({
    records: records.map((notification) => ({
      ...notification,
      resourceId: notification.resourceId ? String(notification.resourceId) : notification.task ? String(notification.task) : null,
      href: notificationHref(notification, isAdmin),
    })),
    unreadCount,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole(["admin", "developer", "designer"]);
  if (!auth.session) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || !("action" in body) || body.action !== "mark_all_read") {
    return Response.json({ error: "Choose a valid notification action." }, { status: 400 });
  }
  await connectToDatabase();
  await Notification.updateMany(
    { recipient: auth.session.user.id, readAt: null },
    { $set: { readAt: new Date() } },
  );
  return Response.json({ success: true });
}
