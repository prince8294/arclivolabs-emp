import { isValidObjectId } from "mongoose";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { updateEmployeeSchema } from "@/lib/employees/validation";
import User from "@/models/User";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Employee not found." }, { status: 404 });

  await connectToDatabase();
  const employee = await User.findOne({ _id: id, role: { $in: ["developer", "designer"] } })
    .select("employeeId fullName email role designation profilePicture phoneNumber skills employmentType joiningDate status createdAt lastLoginAt internalNotes accountSetupCompleted")
    .lean();
  if (!employee) return Response.json({ error: "Employee not found." }, { status: 404 });
  return Response.json({ employee });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json({ error: "Employee not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = updateEmployeeSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please correct the employee details.", issues: parsed.error.issues }, { status: 400 });

  await connectToDatabase();
  try {
    const employee = await User.findOneAndUpdate(
      { _id: id, role: { $in: ["developer", "designer"] } },
      {
        $set: { ...parsed.data, email: parsed.data.email.toLowerCase() },
      },
      { new: true, runValidators: true },
    )
      .select("employeeId fullName email role designation profilePicture phoneNumber skills employmentType joiningDate status createdAt lastLoginAt internalNotes accountSetupCompleted")
      .lean();
    if (!employee) return Response.json({ error: "Employee not found." }, { status: 404 });
    return Response.json({ employee });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return Response.json({ error: "An account already uses this email address." }, { status: 409 });
    }
    console.error("Unable to update employee.", error);
    return Response.json({ error: "The employee could not be updated." }, { status: 500 });
  }
}
