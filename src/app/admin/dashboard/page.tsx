import type { Metadata } from "next";
import { PageHeading } from "@/components/ui/page-heading";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import Link from "next/link";
import Project from "@/models/Project";
import Task from "@/models/Task";
import { Activity, ArrowRight, Plus, Users, UserRoundCheck, Code2, Palette, BriefcaseBusiness, ClipboardList, CalendarDays, Clock3, Coffee } from "lucide-react";
import { formatWorkDate, startOfUtcDay } from "@/lib/work/format";
import { formatDuration, todayUtcRange } from "@/lib/activity/time";
import { getTodayActivityTotals } from "@/lib/activity/summary";
import ActivityCheckIn from "@/models/ActivityCheckIn";
import WorkSession from "@/models/WorkSession";
import LeaveRequest from "@/models/LeaveRequest";
import PaymentRecord from "@/models/PaymentRecord";
import { getAttendanceDays } from "@/lib/hr/attendance";
import { formatMoney } from "@/lib/hr/money";
import { utcMonthRange } from "@/lib/hr/dates";
import TaskSubmission from "@/models/TaskSubmission";
import Announcement from "@/models/Announcement";
import { announcementCategoryLabels, announcementPriorityLabels } from "@/types/announcement";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboardPage() {
  await connectToDatabase();
  const employeeFilter = { role: { $in: ["developer", "designer"] } };
  const today = startOfUtcDay();
  const paymentMonth = utcMonthRange(today.toISOString().slice(0, 7))!;
  const [totalEmployees, activeEmployees, totalDevelopers, totalDesigners, recentEmployees, activeProjects, pendingReviews, overdueTasks, openWorkSessions, employeesOnBreak, todayActivity, pendingActivityCheckIns, pendingLeaveRequests, approvedMonthlyPayable, pendingPayments, attendanceToday, recentSubmissions, recentEmployeeUpdates, recentAnnouncements] = await Promise.all([
    User.countDocuments(employeeFilter),
    User.countDocuments({ ...employeeFilter, status: "active" }),
    User.countDocuments({ role: "developer" }),
    User.countDocuments({ role: "designer" }),
    User.find(employeeFilter)
      .select("employeeId fullName email role profilePicture joiningDate status")
      .sort({ joiningDate: -1 })
      .limit(5)
      .lean(),
    Project.countDocuments({ archivedAt: null, status: { $in: ["planning", "in_progress"] } }),
    Task.countDocuments({ archivedAt: null, status: "in_review" }),
    Task.countDocuments({ archivedAt: null, dueDate: { $lt: today }, status: { $nin: ["completed"] } }),
    WorkSession.countDocuments({ activeEmployeeId: { $exists: true }, status: { $in: ["working", "on_break"] } }),
    WorkSession.countDocuments({ activeEmployeeId: { $exists: true }, status: "on_break" }),
    getTodayActivityTotals(),
    ActivityCheckIn.countDocuments({ recordStatus: "pending" }),
    LeaveRequest.countDocuments({ status: "pending" }),
    PaymentRecord.aggregate([
      { $match: { status: "approved", periodStart: paymentMonth.start } },
      { $group: { _id: "$currency", total: { $sum: "$totalPayablePaise" } } },
    ]),
    PaymentRecord.countDocuments({ status: { $in: ["draft", "approved"] } }),
    (async () => {
      const employeeIds = await User.distinct("_id", employeeFilter);
      const { end } = todayUtcRange();
      const rows = [...(await getAttendanceDays(employeeIds.map(String), today, end)).values()];
      return { employeesWithWork: rows.filter((row) => row.recordedWorkMs > 0).length, totalEmployees: employeeIds.length };
    })(),
    TaskSubmission.find({})
      .populate({ path: "task", select: "title" })
      .populate({ path: "employee", select: "fullName" })
      .sort({ submittedAt: -1 })
      .limit(4)
      .lean(),
    User.find(employeeFilter)
      .select("employeeId fullName role updatedAt")
      .sort({ updatedAt: -1 })
      .limit(4)
      .lean(),
    Announcement.find({
      status: "published",
      publishAt: { $lte: new Date() },
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    })
      .select("title category priority publishAt")
      .sort({ publishAt: -1 })
      .limit(4)
      .lean(),
  ]);
  const statistics = [
    { label: "Total employees", value: totalEmployees, icon: Users, color: "text-violet-200 bg-violet-400/10" },
    { label: "Active employees", value: activeEmployees, icon: UserRoundCheck, color: "text-emerald-200 bg-emerald-400/10" },
    { label: "Developers", value: totalDevelopers, icon: Code2, color: "text-sky-200 bg-sky-400/10" },
    { label: "Designers", value: totalDesigners, icon: Palette, color: "text-fuchsia-200 bg-fuchsia-400/10" },
  ];

  return (
    <>
      <PageHeading
        title="Admin dashboard"
        description="A live overview of your ArclivoLabs team."
      />
      <div className="mb-7 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {statistics.map(({ label, value, icon: Icon, color }) => (
          <DashboardCard key={label} className="metric-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-slate-400 sm:text-sm">{label}</p>
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${color}`}><Icon size={17} /></span>
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{value}</p>
          </DashboardCard>
        ))}
      </div>
      <div className="mb-7 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active projects", value: activeProjects, icon: BriefcaseBusiness, href: "/admin/projects", color: "text-violet-200 bg-violet-400/10" },
          { label: "Pending task reviews", value: pendingReviews, icon: ClipboardList, href: "/admin/tasks?status=in_review", color: "text-amber-200 bg-amber-400/10" },
          { label: "Overdue tasks", value: overdueTasks, icon: CalendarDays, href: "/admin/tasks", color: "text-rose-200 bg-rose-400/10" },
        ].map(({ label, value, icon: Icon, href, color }) => (
          <Link href={href} key={label} className="metric-card surface-link rounded-[20px] border border-white/[0.07] p-4 shadow-card sm:p-5">
            <div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-slate-400 sm:text-sm">{label}</p><span className={`flex size-9 items-center justify-center rounded-xl ${color}`}><Icon size={17} /></span></div>
            <p className="mt-4 text-2xl font-semibold text-white">{value}</p>
          </Link>
        ))}
      </div>
      <div className="mb-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Open work sessions", value: openWorkSessions, icon: Activity },
          { label: "Employees on break", value: employeesOnBreak, icon: Coffee },
          { label: "Today's recorded work (UTC)", value: formatDuration(todayActivity.workDurationMs), icon: Clock3 },
          { label: "Pending activity check-ins", value: pendingActivityCheckIns, icon: CalendarDays },
        ].map(({ label, value, icon: Icon }) => (
          <Link href="/admin/activity" key={label} className="metric-card surface-link rounded-[20px] border border-white/[0.07] p-4 shadow-card sm:p-5">
            <div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-slate-400 sm:text-sm">{label}</p><Icon size={16} className="text-violet-200" /></div>
            <p className="mt-4 text-xl font-semibold text-white sm:text-2xl">{value}</p>
          </Link>
        ))}
      </div>
      <DashboardCard className="feature-panel mb-7 p-4 sm:p-5">
        <p className="mb-4 text-sm font-semibold text-slate-200">People, attendance & payments</p>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: "Pending leave requests", value: pendingLeaveRequests, href: "/admin/leaves" },
          { label: "Approved payable this month", value: approvedMonthlyPayable.length ? approvedMonthlyPayable.map((row) => formatMoney(row.total, row._id)).join(" · ") : "—", href: "/admin/payments" },
          { label: "Pending payments", value: pendingPayments, href: "/admin/payments" },
          { label: "Employees with recorded work today", value: `${attendanceToday.employeesWithWork} / ${attendanceToday.totalEmployees}`, href: "/admin/attendance" },
        ].map(({ label, value, href }) => <Link href={href} key={label} className="rounded-xl px-2 py-1 transition hover:bg-white/[0.03]"><p className="text-xs font-medium text-slate-400">{label}</p><p className="mt-2 truncate text-lg font-semibold text-white">{value}</p></Link>)}
        </div>
      </DashboardCard>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.8fr)]">
        <DashboardCard className="p-0">
          <div className="flex items-center justify-between border-b border-white/6 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-white">Recent employees</h2>
              <p className="mt-1 text-xs text-slate-500">The latest team members to join</p>
            </div>
            <Link href="/admin/employees" className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-200 hover:text-white">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {recentEmployees.length ? (
            <div className="divide-y divide-white/5">
              {recentEmployees.map((employee) => (
                <Link href={`/admin/employees/${employee._id}`} key={String(employee._id)} className="group flex items-center gap-3 px-5 py-4 transition hover:bg-white/[0.025] sm:px-6">
                  <UserAvatar name={employee.fullName} src={employee.profilePicture} className="size-10 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">{employee.fullName}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{employee.email}</p>
                  </div>
                  <div className="hidden items-center gap-4 sm:flex">
                    <RoleBadge role={employee.role} />
                    <span className="w-24 text-right text-xs text-slate-400">{formatWorkDate(employee.joiningDate)}</span>
                    <StatusBadge status={employee.status} />
                  </div>
                  <div className="sm:hidden"><StatusBadge status={employee.status} /></div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-300">No employees added yet</p>
              <p className="mt-1 text-xs text-slate-500">Create your first employee account to get started.</p>
            </div>
          )}
        </DashboardCard>
        <div className="space-y-6">
          <DashboardCard>
            <h2 className="text-sm font-semibold text-white">Employee distribution</h2>
            <p className="mt-1 text-xs text-slate-500">By role, excluding Super Admins</p>
            <div className="mt-5 space-y-4">
              {[["Developers", totalDevelopers, "bg-sky-400"], ["Designers", totalDesigners, "bg-fuchsia-400"]].map(([label, count, color]) => (
                <div key={String(label)}>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-slate-300">{label}</span>
                    <span className="font-medium text-white">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${totalEmployees ? (Number(count) / totalEmployees) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>
          <DashboardCard>
            <h2 className="text-sm font-semibold text-white">Quick actions</h2>
            <div className="mt-4 space-y-2">
              <Link href="/admin/employees/new" className="flex min-h-11 items-center gap-2.5 rounded-xl border border-violet-300/20 bg-gradient-to-r from-[#8f72eb] to-[#a77ee7] px-4 text-sm font-semibold text-white shadow-lg shadow-violet-950/25 transition hover:-translate-y-0.5 hover:brightness-110">
                <Plus size={16} /> Add new employee
              </Link>
              <Link href="/admin/employees" className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/3 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/7">
                View all employees
              </Link>
              <Link href="/admin/projects/new" className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/3 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/7">
                Create a project
              </Link>
              <Link href="/admin/tasks/new" className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/3 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/7">
                Create a task
              </Link>
            </div>
          </DashboardCard>
        </div>
      </div>
      <DashboardCard className="mt-6">
        <div className="mb-4"><h2 className="text-sm font-semibold text-white">Recent activity</h2><p className="mt-1 text-xs text-slate-500">Task submissions, employee account changes, and published announcements</p></div>
        <div className="grid gap-3 lg:grid-cols-3">
          <section className="activity-column"><h3 className="mb-2 text-xs font-medium text-slate-300">Task submissions</h3>{recentSubmissions.length ? <div className="space-y-1">{recentSubmissions.map((submission) => <Link key={String(submission._id)} href={`/admin/tasks/${submission.task?._id ?? ""}`} className="block rounded-lg px-2 py-2 hover:bg-white/[0.03]"><span className="block truncate text-xs text-slate-200">{submission.task?.title ?? "Task unavailable"}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{submission.employee?.fullName ?? "Employee"} · {formatWorkDate(submission.submittedAt)}</span></Link>)}</div> : <p className="text-xs text-slate-500">No task submissions yet.</p>}</section>
          <section className="activity-column"><h3 className="mb-2 text-xs font-medium text-slate-300">Employee updates</h3>{recentEmployeeUpdates.length ? <div className="space-y-1">{recentEmployeeUpdates.map((employee) => <Link key={String(employee._id)} href={`/admin/employees/${employee._id}`} className="block rounded-lg px-2 py-2 hover:bg-white/[0.03]"><span className="block truncate text-xs text-slate-200">{employee.fullName}</span><span className="mt-1 block truncate text-[10px] capitalize text-slate-500">{employee.role} · Updated {formatWorkDate(employee.updatedAt)}</span></Link>)}</div> : <p className="text-xs text-slate-500">No employee updates yet.</p>}</section>
          <section className="activity-column"><h3 className="mb-2 text-xs font-medium text-slate-300">Published announcements</h3>{recentAnnouncements.length ? <div className="space-y-1">{recentAnnouncements.map((announcement) => <Link key={String(announcement._id)} href="/admin/announcements" className="block rounded-lg px-2 py-2 hover:bg-white/[0.03]"><span className={`block truncate text-xs ${announcement.priority === "urgent" ? "text-rose-200" : "text-slate-200"}`}>{announcement.title}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{announcementCategoryLabels[announcement.category as keyof typeof announcementCategoryLabels]} · {announcementPriorityLabels[announcement.priority as keyof typeof announcementPriorityLabels]}</span></Link>)}</div> : <p className="text-xs text-slate-500">No published announcements.</p>}</section>
        </div>
      </DashboardCard>
    </>
  );
}
