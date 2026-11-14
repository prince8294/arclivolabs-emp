import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import { employeeRoles, type EmployeeRole } from "@/types/employee";

export async function getActiveSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  await connectToDatabase();
  const user = await User.findById(session.user.id)
    .select("fullName email role status authVersion")
    .lean();
  if (!user || user.status !== "active") return null;
  if ((user.authVersion ?? 0) !== session.user.authVersion) return null;
  const role = employeeRoles.find((candidate) => candidate === user.role);
  if (!role) return null;

  return {
    ...session,
    user: {
      ...session.user,
      name: user.fullName,
      email: user.email,
      role,
    },
  };
}

export async function requireRole(roles: EmployeeRole[]) {
  const session = await getActiveSession();
  if (!session) redirect("/login");
  if (!roles.includes(session.user.role)) redirect("/forbidden");
  return session;
}

export async function requireApiRole(roles: EmployeeRole[]) {
  const session = await getActiveSession();
  if (!session) {
    return { session: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!roles.includes(session.user.role)) {
    return { session: null, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, response: null };
}
