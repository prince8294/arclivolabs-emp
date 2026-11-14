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
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-white/[0.06] bg-sidebar transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label={`${variant === "admin" ? "Admin" : "Employee"} navigation`}
      >
        <div className="flex h-[76px] items-center justify-between border-b border-white/[0.06] px-6">
          <Link href={variant === "admin" ? "/admin/dashboard" : "/employee/dashboard"} className="flex items-center gap-3" onClick={onClose}>
            <span className="flex size-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-950/50">
              {companyLogoUrl ? <img src={companyLogoUrl} alt="" className="size-full object-contain" referrerPolicy="no-referrer" /> : "A"}
            </span>
            <span>
              <span className="block text-[15px] font-semibold tracking-tight text-white">{workspaceName}</span>
              <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">Workspace</span>
            </span>
          </Link>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pb-2 pt-7">
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
                className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] transition-colors ${
                  active
                    ? "bg-accent/15 font-medium text-violet-100"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                }`}
              >
                <Icon size={17} strokeWidth={1.8} className={active ? "text-accent" : "text-slate-500 group-hover:text-slate-300"} />
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
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.035] p-3">
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
