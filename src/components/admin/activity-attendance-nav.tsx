"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const views = [
  { label: "Work activity", href: "/admin/activity" },
  { label: "Attendance", href: "/admin/attendance" },
];

export function ActivityAttendanceNav() {
  const pathname = usePathname();
  return <nav aria-label="Activity and attendance views" className="mb-5 flex gap-2 border-b border-white/[0.06]">
    {views.map((view) => {
      const active = pathname === view.href;
      return <Link key={view.href} href={view.href} aria-current={active ? "page" : undefined} className={`border-b-2 px-3 py-2.5 text-xs font-medium transition ${active ? "border-accent text-violet-100" : "border-transparent text-slate-500 hover:text-slate-200"}`}>{view.label}</Link>;
    })}
  </nav>;
}
