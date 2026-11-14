import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { employeeProfileSchema } from "@/lib/employees/validation";
import User from "@/models/User";

export async function GET() {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;

  await connectToDatabase();
  const employee = await User.findOne({
    _id: auth.session.user.id,
    role: { $in: ["developer", "designer"] },
    status: "active",
  })
    .select("employeeId fullName email role designation profilePicture phoneNumber skills employmentType joiningDate status createdAt lastLoginAt")
    .lean();
  if (!employee) return Response.json({ error: "Employee profile not found." }, { status: 404 });
  return Response.json({ employee });
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = employeeProfileSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please correct your profile details.", issues: parsed.error.issues }, { status: 400 });

  await connectToDatabase();
  const employee = await User.findOneAndUpdate(
    { _id: auth.session.user.id, role: { $in: ["developer", "designer"] }, status: "active" },
    { $set: parsed.data },
    { new: true, runValidators: true },
  )
    .select("employeeId fullName email role designation profilePicture phoneNumber skills employmentType joiningDate status createdAt lastLoginAt")
    .lean();
  if (!employee) return Response.json({ error: "Employee profile not found." }, { status: 404 });
  return Response.json({ employee });
}
