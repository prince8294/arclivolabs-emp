"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { titleForPath } from "@/lib/navigation";
import type { EmployeeRole } from "@/types/employee";

export function PortalShell({
  variant,
  user,
  branding,
  children,
}: {
  variant: "admin" | "employee";
  user: { name: string; email: string; role: EmployeeRole };
  branding: { workspaceName: string; companyLogoUrl: string };
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const title = useMemo(() => titleForPath(pathname, variant === "admin"), [pathname, variant]);

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar
        variant={variant}
        workspaceName={branding.workspaceName}
        companyLogoUrl={branding.companyLogoUrl}
        name={user.name}
        role={user.role}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="min-h-screen lg:pl-68">
        <Topbar
          title={title}
          name={user.name}
          email={user.email}
          isAdmin={variant === "admin"}
          profileHref={variant === "employee" ? "/employee/profile" : undefined}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="mx-auto w-full max-w-360 px-4 py-7 sm:px-7 sm:py-9 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
