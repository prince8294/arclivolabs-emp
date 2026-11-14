import {
  Activity,
  Banknote,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  available: boolean;
}

export const adminNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, available: true },
  { label: "Employees", href: "/admin/employees", icon: Users, available: true },
  { label: "Projects", href: "/admin/projects", icon: BriefcaseBusiness, available: true },
  { label: "Tasks", href: "/admin/tasks", icon: ClipboardList, available: true },
  { label: "Activity & Attendance", href: "/admin/activity", icon: Activity, available: true },
  { label: "Leave Requests", href: "/admin/leaves", icon: CalendarDays, available: true },
  { label: "Payments & Incentives", href: "/admin/payments", icon: Banknote, available: true },
  { label: "Announcements", href: "/admin/announcements", icon: Megaphone, available: true },
  { label: "Settings", href: "/admin/settings", icon: Settings, available: true },
];

export const employeeNavigation: NavigationItem[] = [
  { label: "Overview", href: "/employee/dashboard", icon: LayoutDashboard, available: true },
  { label: "My Tasks", href: "/employee/tasks", icon: ClipboardList, available: true },
  { label: "My Projects", href: "/employee/projects", icon: BriefcaseBusiness, available: true },
  { label: "Work Activity", href: "/employee/activity", icon: Activity, available: true },
  { label: "Attendance & Leave", href: "/employee/attendance", icon: CalendarDays, available: true },
  { label: "My Earnings", href: "/employee/earnings", icon: Banknote, available: true },
  { label: "Announcements", href: "/employee/announcements", icon: Megaphone, available: true },
  { label: "My Profile", href: "/employee/profile", icon: Users, available: true },
];

export const notificationIcon = Bell;

export function titleForPath(pathname: string, isAdmin: boolean) {
  const items = isAdmin ? adminNavigation : employeeNavigation;
  const exactMatch = items.find((item) => item.href === pathname);
  if (exactMatch) return exactMatch.label;
  if (isAdmin && pathname.startsWith("/admin/employees/")) {
    return pathname.endsWith("/edit") ? "Edit employee" : "Employee details";
  }
  if (isAdmin && (pathname === "/admin/activity" || pathname.startsWith("/admin/activity/") || pathname === "/admin/attendance")) {
    return "Activity & Attendance";
  }
  if (isAdmin && pathname.startsWith("/admin/projects/")) {
    return pathname.endsWith("/edit") ? "Edit project" : "Project details";
  }
  if (isAdmin && pathname.startsWith("/admin/tasks/")) {
    return pathname.endsWith("/edit") ? "Edit task" : "Task details";
  }
  if (isAdmin && pathname.startsWith("/admin/payments/")) return "Payment details";
  if (!isAdmin && pathname.startsWith("/employee/earnings/")) return "Payment details";
  if (!isAdmin && pathname.startsWith("/employee/tasks/")) return "Task details";
  if (!isAdmin && pathname.startsWith("/employee/projects/")) return "Project details";
  return isAdmin ? "Dashboard" : "Overview";
}
