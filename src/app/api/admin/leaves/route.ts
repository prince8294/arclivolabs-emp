import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import LeaveRequest from "@/models/LeaveRequest";
import User from "@/models/User";
import { leaveStatuses } from "@/types/hr";

export async function GET(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  if (status && !leaveStatuses.includes(status as (typeof leaveStatuses)[number])) {
    return Response.json({ error: "Choose a valid leave status." }, { status: 400 });
  }
  const page = Math.min(100_000, Math.max(1, Number(searchParams.get("page")) || 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 25));
  await connectToDatabase();
  const filter = status ? { status } : {};
  const [requests, total, pending, approved, rejected, employees] = await Promise.all([
    LeaveRequest.find(filter)
      .populate({ path: "employee", select: "employeeId fullName role designation" })
      .populate({ path: "reviewedBy", select: "fullName" })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    LeaveRequest.countDocuments(filter),
    LeaveRequest.countDocuments({ status: "pending" }),
    LeaveRequest.countDocuments({ status: "approved" }),
    LeaveRequest.countDocuments({ status: "rejected" }),
    User.find({ role: { $in: ["developer", "designer"] } })
      .select("employeeId fullName role")
      .sort({ fullName: 1 })
      .lean(),
  ]);
  return Response.json({
    requests,
    employees,
    summary: { pending, approved, rejected },
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
