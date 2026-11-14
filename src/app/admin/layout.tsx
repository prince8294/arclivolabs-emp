import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/authorization";
import { PortalShell } from "@/components/layout/portal-shell";
import { getWorkspaceBranding } from "@/lib/employees/settings";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireRole(["admin"]);
  const branding = await getWorkspaceBranding();
  return (
    <PortalShell
      variant="admin"
      branding={branding}
      user={{
        name: session.user.name ?? "Administrator",
        email: session.user.email ?? "",
        role: session.user.role,
      }}
    >
      {children}
    </PortalShell>
  );
}
