import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { dailyWorkReportSchema } from "@/lib/activity/validation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { sanitizePlainText } from "@/lib/work/format";
import DailyWorkReport from "@/models/DailyWorkReport";
import { notifyActiveAdmins } from "@/lib/notifications/create";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Daily report not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = dailyWorkReportSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Add a meaningful summary of completed work before submitting the report.", issues: parsed.error.issues }, { status: 400 });
  const completedWork = sanitizePlainText(parsed.data.completedWork);
  if (completedWork.length < 10) return Response.json({ error: "The completed-work summary must contain at least ten readable characters." }, { status: 400 });

  await connectToDatabase();
  const current = await DailyWorkReport.findOne({ _id: id, employee: auth.session.user.id }).lean();
  if (!current) return Response.json({ error: "Daily report not found." }, { status: 404 });
  if (current.status === "submitted") return Response.json({ report: current, alreadySubmitted: true });

  const submittedAt = new Date();
  const report = await DailyWorkReport.findOneAndUpdate(
    { _id: id, employee: auth.session.user.id, status: "draft" },
    {
      $set: {
        completedWork,
        pendingWork: sanitizePlainText(parsed.data.pendingWork),
        blockers: sanitizePlainText(parsed.data.blockers),
        notes: sanitizePlainText(parsed.data.notes),
        status: "submitted",
        submittedAt,
      },
    },
    { new: true, runValidators: true },
  ).lean();
  if (report) {
    let warning: string | undefined;
    try {
      await notifyActiveAdmins({
        title: "Important work report submitted",
        message: `${auth.session.user.name ?? "An employee"} submitted a daily work report.`,
        type: "work_report_submitted",
        resourceType: "report",
        resourceId: String(report._id),
        dedupeKey: `work-report:${String(report._id)}`,
      });
    } catch (error) {
      console.error("Daily report was submitted but administrator notifications could not be created.", error);
      warning = "Your report was submitted, but administrators could not be notified.";
    }
    return Response.json({ report, warning });
  }

  const latest = await DailyWorkReport.findOne({ _id: id, employee: auth.session.user.id }).lean();
  if (latest?.status === "submitted") return Response.json({ report: latest, alreadySubmitted: true });
  return Response.json({ error: "This report changed while you were submitting it. Refresh and try again." }, { status: 409 });
}
