import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/authorization";
import { PortalShell } from "@/components/layout/portal-shell";
import { getWorkspaceBranding } from "@/lib/employees/settings";

export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  const session = await requireRole(["developer", "designer"]);
  const branding = await getWorkspaceBranding();
  return (
    <PortalShell
      variant="employee"
      branding={branding}
      user={{
        name: session.user.name ?? "Team member",
        email: session.user.email ?? "",
        role: session.user.role,
      }}
    >
      {children}
    </PortalShell>
  );
}
