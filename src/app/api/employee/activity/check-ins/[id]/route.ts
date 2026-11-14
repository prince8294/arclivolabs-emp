import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { getActivitySettings } from "@/lib/activity/settings";
import { checkInSubmissionSchema } from "@/lib/activity/validation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { sanitizePlainText } from "@/lib/work/format";
import ActivityCheckIn from "@/models/ActivityCheckIn";
import WorkSession from "@/models/WorkSession";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Check-in not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = checkInSubmissionSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Choose a work status and enter a progress update of at least five characters.", issues: parsed.error.issues }, { status: 400 });
  const progressUpdate = sanitizePlainText(parsed.data.progressUpdate);
  if (progressUpdate.length < 5) return Response.json({ error: "Please enter a readable progress update of at least five characters." }, { status: 400 });

  await connectToDatabase();
  const checkIn = await ActivityCheckIn.findOne({ _id: id, employee: auth.session.user.id }).lean();
  if (!checkIn) return Response.json({ error: "Check-in not found." }, { status: 404 });
  if (checkIn.recordStatus === "submitted") return Response.json({ checkIn, alreadySubmitted: true });

  const settings = await getActivitySettings();
  if (!settings?.checkInsEnabled) return Response.json({ error: "Activity check-ins are currently disabled." }, { status: 409 });
  if (!(await WorkSession.exists({
    _id: checkIn.session,
    employee: auth.session.user.id,
    status: "working",
    activeEmployeeId: auth.session.user.id,
  }))) {
    return Response.json({ error: "Check-ins can only be submitted during an active working session." }, { status: 409 });
  }

  const submittedAt = new Date();
  const changed = await ActivityCheckIn.findOneAndUpdate(
    { _id: id, employee: auth.session.user.id, recordStatus: "pending" },
    {
      $set: {
        workStatus: parsed.data.workStatus,
        progressUpdate,
        submittedAt,
        recordStatus: "submitted",
      },
    },
    { new: true, runValidators: true },
  ).lean();
  if (changed) return Response.json({ checkIn: changed });

  const latest = await ActivityCheckIn.findOne({ _id: id, employee: auth.session.user.id }).lean();
  if (latest?.recordStatus === "submitted") return Response.json({ checkIn: latest, alreadySubmitted: true });
  return Response.json({ error: "This check-in changed while you were submitting it. Refresh and try again." }, { status: 409 });
}
