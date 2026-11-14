import { requireApiRole } from "@/lib/auth/authorization";
import { settingsSchema } from "@/lib/employees/validation";
import PortalSettings from "@/models/PortalSettings";
import { getEmployeeSettings } from "@/lib/employees/settings";

export async function GET() {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;

  const settings = await getEmployeeSettings();
  return Response.json({
    settings: {
      workspaceName: settings.workspaceName,
      companyLogoUrl: settings.companyLogoUrl,
      defaultTimeZone: settings.defaultTimeZone,
      dateFormat: settings.dateFormat,
      invitationExpiryHours: settings.invitationExpiryHours,
      activateOnSetup: settings.activateOnSetup,
      employeeIdPrefix: settings.employeeIdPrefix,
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (!auth.session) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please correct the employee settings.", issues: parsed.error.issues }, { status: 400 });

  await getEmployeeSettings();
  const settings = await PortalSettings.findOneAndUpdate(
    { key: "employee" },
    { $set: parsed.data },
    { new: true, runValidators: true },
  ).select("workspaceName companyLogoUrl defaultTimeZone dateFormat invitationExpiryHours activateOnSetup employeeIdPrefix").lean();
  return Response.json({ settings });
}
