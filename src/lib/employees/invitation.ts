import { createHash, randomBytes } from "node:crypto";
import SetupInvitation from "@/models/SetupInvitation";
import { getEmployeeSettings } from "@/lib/employees/settings";

export async function createSetupInvitation(employeeId: string) {
  const baseUrl = process.env.NEXTAUTH_URL;
  if (!baseUrl) throw new Error("Missing NEXTAUTH_URL environment variable.");
  const settings = await getEmployeeSettings();

  await SetupInvitation.updateMany(
    { employee: employeeId, usedAt: null },
    { $set: { usedAt: new Date() } },
  );

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + settings.invitationExpiryHours * 60 * 60 * 1000);
  await SetupInvitation.create({ employee: employeeId, tokenHash, expiresAt });

  return { invitationUrl: new URL(`/setup/${token}`, baseUrl).toString(), expiresAt };
}
