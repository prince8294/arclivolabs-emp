import { isDuplicateKey } from "@/lib/work/format";
import { requireApiRole } from "@/lib/auth/authorization";
import { calendarDatesInclusive, parseUtcDate } from "@/lib/hr/dates";
import { leaveRequestSchema } from "@/lib/hr/validation";
import { connectToDatabase } from "@/lib/db/mongodb";
import LeaveDayReservation from "@/models/LeaveDayReservation";
import LeaveRequest from "@/models/LeaveRequest";
import { sanitizePlainText } from "@/lib/work/format";
import { notifyActiveAdmins } from "@/lib/notifications/create";

export async function GET() {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  await connectToDatabase();
  const requests = await LeaveRequest.find({ employee: auth.session.user.id })
    .select("leaveType startDate endDate totalDays reason notes status adminRemarks reviewedAt createdAt cancelledAt")
    .sort({ startDate: -1 })
    .limit(100)
    .lean();
  return Response.json({ requests });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = leaveRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please correct the leave request details.", issues: parsed.error.issues }, { status: 400 });
  const startDate = parseUtcDate(parsed.data.startDate);
  const endDate = parseUtcDate(parsed.data.endDate);
  if (!startDate || !endDate || startDate > endDate) {
    return Response.json({ error: "The end date must be on or after the start date." }, { status: 400 });
  }
  const coveredDates = calendarDatesInclusive(startDate, endDate);
  await connectToDatabase();
  const existing = await LeaveRequest.exists({
    employee: auth.session.user.id,
    status: { $in: ["pending", "approved"] },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  });
  if (existing) return Response.json({ error: "This request overlaps leave that is already pending or approved." }, { status: 409 });

  const leave = await LeaveRequest.create({
    employee: auth.session.user.id,
    leaveType: parsed.data.leaveType,
    startDate,
    endDate,
    totalDays: coveredDates.length,
    coveredDates,
    reason: sanitizePlainText(parsed.data.reason),
    notes: sanitizePlainText(parsed.data.notes),
    status: "pending",
  });
  try {
    await LeaveDayReservation.insertMany(
      coveredDates.map((date) => ({ employee: auth.session.user.id, date, leaveRequest: leave._id })),
      { ordered: true },
    );
  } catch (error) {
    await LeaveDayReservation.deleteMany({ leaveRequest: leave._id });
    await LeaveRequest.deleteOne({ _id: leave._id, employee: auth.session.user.id, status: "pending" });
    if (isDuplicateKey(error)) return Response.json({ error: "This request overlaps leave that is already pending or approved." }, { status: 409 });
    console.error("Could not reserve leave dates.", error);
    return Response.json({ error: "The leave request could not be saved." }, { status: 500 });
  }
  let warning: string | undefined;
  try {
    await notifyActiveAdmins({
      title: "New leave request",
      message: `${auth.session.user.name ?? "An employee"} submitted a leave request.`,
      type: "leave_requested",
      resourceType: "leave",
      resourceId: leave.id,
      dedupeKey: `leave-request:${leave.id}`,
    });
  } catch (error) {
    console.error("Leave request was saved but administrator notifications could not be created.", error);
    warning = "Your request was saved, but administrators could not be notified.";
  }
  return Response.json({ request: { id: leave.id, status: leave.status, totalDays: leave.totalDays }, warning }, { status: 201 });
}
