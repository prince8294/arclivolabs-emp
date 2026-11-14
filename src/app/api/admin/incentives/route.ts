import { isDuplicateKey, sanitizePlainText } from "@/lib/work/format";
import { requireApiRole } from "@/lib/auth/authorization";
import { parseMoneyToPaise } from "@/lib/hr/money";
import { parseUtcDate } from "@/lib/hr/dates";
import { incentiveSchema } from "@/lib/hr/validation";
import { connectToDatabase } from "@/lib/db/mongodb";
import Incentive from "@/models/Incentive";
import Project from "@/models/Project";
import Task from "@/models/Task";
import User from "@/models/User";
import { incentiveStatuses } from "@/types/hr";

export async function GET(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  if (status && !incentiveStatuses.includes(status as (typeof incentiveStatuses)[number])) {
    return Response.json({ error: "Choose a valid incentive status." }, { status: 400 });
  }
  await connectToDatabase();
  const [records, employees, projects, tasks] = await Promise.all([
    Incentive.find(status ? { status } : {})
      .populate({ path: "employee", select: "employeeId fullName role" })
      .populate({ path: "project", select: "projectId name" })
      .populate({ path: "task", select: "taskId title" })
      .populate({ path: "approvedBy", select: "fullName" })
      .sort({ incentiveDate: -1 })
      .limit(500)
      .lean(),
    User.find({ role: { $in: ["developer", "designer"] } }).select("employeeId fullName role status").sort({ fullName: 1 }).lean(),
    Project.find({ archivedAt: null }).select("projectId name").sort({ name: 1 }).lean(),
    Task.find({ archivedAt: null }).select("taskId title project assignedTo").sort({ title: 1 }).limit(1000).lean(),
  ]);
  return Response.json({ records, employees, projects, tasks });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = incentiveSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please correct the incentive details.", issues: parsed.error.issues }, { status: 400 });
  const amountPaise = parseMoneyToPaise(parsed.data.amount);
  const incentiveDate = parseUtcDate(parsed.data.date);
  if (!amountPaise || amountPaise < 1 || !incentiveDate) return Response.json({ error: "Enter a positive incentive amount and valid date." }, { status: 400 });

  await connectToDatabase();
  const employee = await User.findOne({ _id: parsed.data.employeeId, role: { $in: ["developer", "designer"] } }).select("_id").lean();
  if (!employee) return Response.json({ error: "Employee not found." }, { status: 404 });
  if (parsed.data.projectId && !(await Project.exists({ _id: parsed.data.projectId }))) return Response.json({ error: "Project not found." }, { status: 404 });
  if (parsed.data.taskId && !(await Task.exists({ _id: parsed.data.taskId }))) return Response.json({ error: "Task not found." }, { status: 404 });
  if (parsed.data.taskId && parsed.data.projectId) {
    if (!(await Task.exists({ _id: parsed.data.taskId, project: parsed.data.projectId }))) {
      return Response.json({ error: "The selected task does not belong to the selected project." }, { status: 400 });
    }
  }
  try {
    const incentive = await Incentive.create({
      employee: employee._id,
      project: parsed.data.projectId || undefined,
      task: parsed.data.taskId || undefined,
      title: sanitizePlainText(parsed.data.title),
      amountPaise,
      currency: parsed.data.currency,
      reason: sanitizePlainText(parsed.data.reason),
      incentiveDate,
      status: "pending",
      createdBy: auth.session.user.id,
      auditLog: [{
        action: "incentive_created",
        actor: auth.session.user.id,
        reason: sanitizePlainText(parsed.data.reason),
        newValue: { amountPaise, currency: parsed.data.currency, incentiveDate },
      }],
    });
    return Response.json({ incentive: { id: incentive.id, status: incentive.status } }, { status: 201 });
  } catch (error) {
    if (isDuplicateKey(error)) return Response.json({ error: "This incentive already exists." }, { status: 409 });
    console.error("Could not create employee incentive.", error);
    return Response.json({ error: "The incentive could not be created." }, { status: 500 });
  }
}
