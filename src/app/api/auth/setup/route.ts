import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { requireApiRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { setupPasswordSchema } from "@/lib/employees/validation";
import SetupInvitation from "@/models/SetupInvitation";
import User from "@/models/User";
import { getEmployeeSettings } from "@/lib/employees/settings";
import { consumeRateLimit, getRequestAddress } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin", "developer", "designer"]);
  if (auth.session) return Response.json({ error: "Sign out before setting up another account." }, { status: 400 });

  const address = getRequestAddress(request);
  if (!(await consumeRateLimit("setup-address", address, 20))) {
    return Response.json({ error: "Too many setup attempts. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = setupPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Use at least 12 characters and no more than 72 UTF-8 bytes." }, { status: 400 });
  }

  await connectToDatabase();
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  if (!(await consumeRateLimit("setup-token", tokenHash, 5))) {
    return Response.json({ error: "Too many attempts for this setup link." }, { status: 429 });
  }

  const invitation = await SetupInvitation.findOne({
    tokenHash,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).select("_id employee").lean();
  if (!invitation) return Response.json({ error: "This setup link is invalid, expired, or already used." }, { status: 400 });

  const settings = await getEmployeeSettings();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const claimed = await SetupInvitation.findOneAndUpdate(
    { _id: invitation._id, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true },
  ).lean();
  if (!claimed) return Response.json({ error: "This setup link is invalid, expired, or already used." }, { status: 400 });

  const employee = await User.findOneAndUpdate(
    { _id: invitation.employee, role: { $in: ["developer", "designer"] }, status: "pending_setup", accountSetupCompleted: false },
    {
      $set: {
        passwordHash,
        accountSetupCompleted: true,
        status: settings.activateOnSetup ? "active" : "inactive",
      },
      $inc: { authVersion: 1 },
    },
    { new: true },
  ).select("_id");

  if (!employee) {
    return Response.json({ error: "This employee account is no longer awaiting setup." }, { status: 409 });
  }
  return Response.json({ message: "Password set. You can now sign in." });
}
