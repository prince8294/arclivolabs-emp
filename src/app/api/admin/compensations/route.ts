import { isDuplicateKey, sanitizePlainText } from "@/lib/work/format";
import { requireApiRole } from "@/lib/auth/authorization";
import { parseUtcDate } from "@/lib/hr/dates";
import { parseMoneyToPaise } from "@/lib/hr/money";
import { compensationSchema } from "@/lib/hr/validation";
import { connectToDatabase } from "@/lib/db/mongodb";
import Compensation from "@/models/Compensation";
import User from "@/models/User";

export async function GET() {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  await connectToDatabase();
  const [employees, records] = await Promise.all([
    User.find({ role: { $in: ["developer", "designer"] } })
      .select("employeeId fullName role designation status")
      .sort({ fullName: 1 })
      .lean(),
    Compensation.find({})
      .populate({ path: "employee", select: "employeeId fullName role designation status" })
      .populate({ path: "createdBy", select: "fullName" })
      .sort({ effectiveDate: -1 })
      .limit(500)
      .lean(),
  ]);
  return Response.json({ employees, records });
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
  const parsed = compensationSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please correct the compensation details.", issues: parsed.error.issues }, { status: 400 });
  const baseAmountPaise = parseMoneyToPaise(parsed.data.baseAmount);
  const effectiveDate = parseUtcDate(parsed.data.effectiveDate);
  if (!baseAmountPaise || baseAmountPaise < 1 || !effectiveDate) {
    return Response.json({ error: "Enter a positive amount and a valid effective date." }, { status: 400 });
  }
  await connectToDatabase();
  const employee = await User.findOne({ _id: parsed.data.employeeId, role: { $in: ["developer", "designer"] } }).select("_id").lean();
  if (!employee) return Response.json({ error: "Employee not found." }, { status: 404 });
  try {
    const record = await Compensation.create({
      employee: employee._id,
      compensationType: parsed.data.compensationType,
      baseAmountPaise,
      currency: parsed.data.currency,
      effectiveDate,
      notes: sanitizePlainText(parsed.data.notes),
      createdBy: auth.session.user.id,
      auditLog: [{
        action: "compensation_configured",
        actor: auth.session.user.id,
        reason: sanitizePlainText(parsed.data.notes),
        newValue: { compensationType: parsed.data.compensationType, baseAmountPaise, currency: parsed.data.currency, effectiveDate },
      }],
    });
    return Response.json({ record: { id: record.id } }, { status: 201 });
  } catch (error) {
    if (isDuplicateKey(error)) return Response.json({ error: "A compensation record already exists for this employee and effective date." }, { status: 409 });
    console.error("Could not save employee compensation.", error);
    return Response.json({ error: "Compensation could not be saved." }, { status: 500 });
  }
}
