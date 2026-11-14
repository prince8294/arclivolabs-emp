import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { createSetupInvitation } from "@/lib/employees/invitation";
import { generateEmployeeId } from "@/lib/employees/employee-id";
import { createEmployeeSchema } from "@/lib/employees/validation";
import User from "@/models/User";

export async function GET(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;

  const { searchParams } = new URL(request.url);
  const page = Math.min(100_000, Math.max(1, Number(searchParams.get("page")) || 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));
  const query = searchParams.get("q")?.trim().slice(0, 100);
  const role = searchParams.get("role");
  const status = searchParams.get("status");
  const sort = searchParams.get("sort") === "oldest" ? 1 : -1;
  const filter: Record<string, unknown> = { role: { $in: ["developer", "designer"] } };

  if (role === "developer" || role === "designer") filter.role = role;
  if (status === "pending_setup" || status === "active" || status === "inactive") filter.status = status;
  if (query) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$or = [{ fullName: regex }, { email: regex }, { employeeId: regex }];
  }

  await connectToDatabase();
  const [employees, total] = await Promise.all([
    User.find(filter)
      .select("employeeId fullName email role designation profilePicture phoneNumber skills employmentType joiningDate status createdAt lastLoginAt internalNotes accountSetupCompleted")
      .sort({ joiningDate: sort, _id: sort })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return Response.json({
    employees,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  if (!process.env.NEXTAUTH_URL) {
    return Response.json({ error: "The invitation URL is not configured on the server." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Please correct the employee details.", issues: parsed.error.issues }, { status: 400 });
  }

  await connectToDatabase();
  const email = parsed.data.email.toLowerCase();
  if (await User.exists({ email })) {
    return Response.json({ error: "An account already uses this email address." }, { status: 409 });
  }

  try {
    const employee = await User.create({
      ...parsed.data,
      email,
      employeeId: await generateEmployeeId(),
      department: parsed.data.role === "developer" ? "Engineering" : "Design",
      status: "pending_setup",
      accountSetupCompleted: false,
    });
    let invitation: Awaited<ReturnType<typeof createSetupInvitation>>;
    try {
      invitation = await createSetupInvitation(employee.id);
    } catch (error) {
      console.error("Employee created, but invitation creation failed.", error);
      return Response.json(
        {
          error: "Employee created, but the setup invitation could not be generated. Open the employee record and regenerate it.",
          employee: { id: employee.id, employeeId: employee.employeeId },
        },
        { status: 503 },
      );
    }
    return Response.json(
      { employee: { id: employee.id, employeeId: employee.employeeId }, ...invitation },
      { status: 201 },
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return Response.json({ error: "An account already uses this email address or employee ID." }, { status: 409 });
    }
    console.error("Unable to create employee invitation.", error);
    return Response.json({ error: "The employee could not be created. Please try again." }, { status: 500 });
  }
}
