import bcrypt from "bcryptjs";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { passwordChangeSchema } from "@/lib/employees/validation";
import User from "@/models/User";

export async function POST(request: Request) {
  const auth = await requireApiRole(["developer", "designer"]);
  if (!auth.session) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = passwordChangeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "New passwords need at least 12 characters and must not exceed 72 UTF-8 bytes." }, { status: 400 });
  }

  await connectToDatabase();
  const employee = await User.findOne({ _id: auth.session.user.id, role: { $in: ["developer", "designer"] }, status: "active" })
    .select("+passwordHash");
  if (!employee?.passwordHash) return Response.json({ error: "Employee account not found." }, { status: 404 });

  if (!(await bcrypt.compare(parsed.data.currentPassword, employee.passwordHash))) {
    return Response.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  employee.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  employee.authVersion += 1;
  await employee.save();
  return Response.json({ message: "Password updated. Sign in again with your new password." });
}
