"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, X } from "lucide-react";
import { adminNavigation, employeeNavigation } from "@/lib/navigation";
import { UserAvatar } from "@/components/ui/user-avatar";
import { RoleBadge } from "@/components/ui/role-badge";
import type { EmployeeRole } from "@/types/employee";

export function Sidebar({
  variant,
  workspaceName,
  companyLogoUrl,
  name,
  role,
  mobileOpen,
  onClose,
}: {
  variant: "admin" | "employee";
  workspaceName: string;
  companyLogoUrl: string;
  name: string;
  role: EmployeeRole;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const items = variant === "admin" ? adminNavigation : employeeNavigation;

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-white/[0.07] bg-sidebar/95 shadow-[20px_0_80px_rgba(3,1,7,0.16)] backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label={`${variant === "admin" ? "Admin" : "Employee"} navigation`}
      >
        <div className="flex h-[76px] items-center justify-between border-b border-white/[0.06] px-5">
          <Link href={variant === "admin" ? "/admin/dashboard" : "/employee/dashboard"} className="flex items-center gap-3" onClick={onClose}>
            <span className="flex size-10 items-center justify-center overflow-hidden rounded-[14px] border border-white/10 bg-[#21152f] text-sm font-bold text-white shadow-[0_10px_30px_rgba(169,140,255,0.16)]">
              <img src={companyLogoUrl || "/artwork/arclivo-mark.svg"} alt="" className="size-full object-contain" referrerPolicy="no-referrer" />
            </span>
            <span>
              <span className="block text-[14px] font-semibold uppercase tracking-[0.08em] text-white">{workspaceName}</span>
              <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.22em] text-violet-300/55">Team workspace</span>
            </span>
          </Link>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pb-2 pt-6">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {variant === "admin" ? "Administration" : "Workspace"}
          </p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-5">
          {items.map(({ label, href, icon: Icon, available }) => {
            const active = pathname === href
              || pathname.startsWith(`${href}/`)
              || (variant === "admin" && href === "/admin/activity" && pathname === "/admin/attendance");
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-accent/18 to-fuchsia-400/[0.055] font-medium text-violet-50 shadow-[inset_0_0_0_1px_rgba(169,140,255,0.1)]"
                    : "text-slate-400 hover:translate-x-0.5 hover:bg-white/[0.04] hover:text-slate-100"
                }`}
              >
                {active && <span className="absolute -left-0.5 h-5 w-0.5 rounded-full bg-gradient-to-b from-violet-300 to-fuchsia-300" />}
                <Icon size={17} strokeWidth={1.8} className={active ? "text-violet-300" : "text-slate-500 group-hover:text-slate-300"} />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {!available && <span className="size-1.5 rounded-full bg-slate-600" aria-label="Coming later" title="Coming later" />}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[13px] text-slate-400 transition-colors hover:bg-rose-400/[0.07] hover:text-rose-200"
          >
            <LogOut size={17} strokeWidth={1.8} />
            Sign out
          </button>
        </div>

        <div className="border-t border-white/[0.06] p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.055] bg-white/[0.028] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
            <UserAvatar name={name} className="size-9 text-xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">{name}</p>
              <div className="mt-1"><RoleBadge role={role} /></div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
