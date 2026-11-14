import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { attendanceCorrectionReviewSchema } from "@/lib/hr/validation";
import { getAttendanceDays } from "@/lib/hr/attendance";
import { connectToDatabase } from "@/lib/db/mongodb";
import AttendanceCorrection from "@/models/AttendanceCorrection";
import { sanitizePlainText } from "@/lib/work/format";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Attendance correction not found." }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = attendanceCorrectionReviewSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Describe the approved change or choose to reject the request.", issues: parsed.error.issues }, { status: 400 });
  await connectToDatabase();
  const pending = await AttendanceCorrection.findOne({ _id: id, status: "pending" }).select("employee attendanceDate requestedChanges").lean();
  if (!pending) return Response.json({ error: "This correction is no longer pending review." }, { status: 409 });
  const status = parsed.data.decision === "approve" ? "approved" : "rejected";
  const start = new Date(pending.attendanceDate);
  const end = new Date(start.getTime() + 86_400_000);
  const [day] = [...(await getAttendanceDays([String(pending.employee)], start, end)).values()];
  const updatedValue = status === "approved"
    ? `${sanitizePlainText(parsed.data.approvedChanges)}; ${parsed.data.minutesAdjustment} minute adjustment`
    : "Request rejected";
  const correction = await AttendanceCorrection.findOneAndUpdate(
    { _id: id, status: "pending" },
    {
      $set: {
        status,
        previousValue: `${day?.recordedWorkMs ?? 0} ms recorded work; ${day?.breakMs ?? 0} ms recorded breaks`,
        approvedChanges: status === "approved" ? sanitizePlainText(parsed.data.approvedChanges) : "",
        updatedValue,
        minutesAdjustment: status === "approved" ? parsed.data.minutesAdjustment : 0,
        reviewedBy: auth.session.user.id,
        reviewedAt: new Date(),
        reviewerRemarks: sanitizePlainText(parsed.data.reason),
      },
    },
    { new: true },
  ).lean();
  if (!correction) return Response.json({ error: "This correction changed while it was being reviewed." }, { status: 409 });
  return Response.json({ correction });
}
