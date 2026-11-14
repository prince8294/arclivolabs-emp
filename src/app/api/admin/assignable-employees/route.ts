import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";

export async function GET() {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;

  await connectToDatabase();
  const employees = await User.find({ role: { $in: ["developer", "designer"] }, status: "active" })
    .select("fullName role designation profilePicture employeeId")
    .sort({ fullName: 1 })
    .lean();
  return Response.json({ employees });
}
