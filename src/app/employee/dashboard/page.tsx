import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Activity, ClipboardList, ArrowRight, Clock3, Coffee, Play } from "lucide-react";
import { requireRole } from "@/lib/auth/authorization";
import { PageHeading } from "@/components/ui/page-heading";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import Task from "@/models/Task";
import { TaskStatusBadge } from "@/components/ui/work-badges";
import { formatWorkDate, startOfUtcDay } from "@/lib/work/format";
import { formatDuration } from "@/lib/activity/time";
import { getTodayActivityTotals } from "@/lib/activity/summary";
import WorkSession from "@/models/WorkSession";
import DailyWorkReport from "@/models/DailyWorkReport";
import LeaveRequest from "@/models/LeaveRequest";
import Incentive from "@/models/Incentive";
import PaymentRecord from "@/models/PaymentRecord";
import { getAttendanceDays } from "@/lib/hr/attendance";
import { formatMoney } from "@/lib/hr/money";
import { utcMonthRange } from "@/lib/hr/dates";
import { getWorkspaceBranding } from "@/lib/employees/settings";
import { formatWorkspaceDate } from "@/lib/employees/format-date";
import Announcement from "@/models/Announcement";
import Notification from "@/models/Notification";
import { employeeAnnouncementFilter } from "@/lib/announcements/access";
import { announcementCategoryLabels, announcementPriorityLabels } from "@/types/announcement";

export const metadata: Metadata = { title: "Employee overview" };

export default async function EmployeeDashboardPage() {
  const session = await requireRole(["developer", "designer"]);
  const firstName = session.user.name?.trim().split(/\s+/)[0] ?? "there";
  await connectToDatabase();
  const branding = await getWorkspaceBranding();
  const employee = await User.findOne({
    _id: session.user.id,
    role: { $in: ["developer", "designer"] },
    status: "active",
  })
    .select("fullName email role designation profilePicture joiningDate status")
    .lean();
  if (!employee) {
    redirect("/login");
  }
  const today = startOfUtcDay();
  const monthRange = utcMonthRange(today.toISOString().slice(0, 7))!;
  const assignedScope = { assignedTo: employee._id, archivedAt: null };
  const [pendingTasks, activeTasks, completedTasks, pendingReviews, upcomingDeadlines, recentlyAssigned, activityTotals, activeSession, latestReport, attendanceDays, latestLeave, approvedIncentives, latestPayment, recentNotifications, latestAnnouncements] = await Promise.all([
    Task.countDocuments({ ...assignedScope, status: "to_do" }),
    Task.countDocuments({ ...assignedScope, status: { $in: ["in_progress", "blocked"] } }),
    Task.countDocuments({ ...assignedScope, status: "completed" }),
    Task.countDocuments({ ...assignedScope, status: "in_review" }),
    Task.find({ ...assignedScope, status: { $nin: ["completed"] }, dueDate: { $gte: today } })
      .select("taskId title project status dueDate")
      .populate({ path: "project", select: "name" })
      .sort({ dueDate: 1 })
      .limit(4)
      .lean(),
    Task.find(assignedScope)
      .select("taskId title project status dueDate createdAt")
      .populate({ path: "project", select: "name" })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean(),
    getTodayActivityTotals({ employee: employee._id }),
    WorkSession.findOne({
      employee: employee._id,
      activeEmployeeId: employee._id,
      status: { $in: ["working", "on_break"] },
    })
      .select("+activeEmployeeId startedAt status nextCheckInDueAt task project")
      .populate({ path: "task", select: "title" })
      .populate({ path: "project", select: "name" })
      .lean(),
    DailyWorkReport.findOne({ employee: employee._id })
      .select("status reportDate updatedAt session")
      .populate({ path: "session", select: "task", populate: { path: "task", select: "title" } })
      .sort({ updatedAt: -1 })
      .lean(),
    getAttendanceDays([String(employee._id)], monthRange.start, monthRange.end),
    LeaveRequest.findOne({ employee: employee._id })
      .select("leaveType startDate endDate status createdAt")
      .sort({ createdAt: -1 })
      .lean(),
    Incentive.aggregate([
      { $match: { employee: employee._id, status: "approved" } },
      { $group: { _id: "$currency", total: { $sum: "$amountPaise" } } },
    ]),
    PaymentRecord.findOne({ employee: employee._id, status: { $in: ["approved", "paid"] } })
      .select("periodStart status totalPayablePaise currency paidAt")
      .sort({ periodStart: -1 })
      .lean(),
    Notification.find({ recipient: employee._id })
      .select("title message readAt createdAt")
      .sort({ createdAt: -1 })
      .limit(4)
      .lean(),
    Announcement.find(employeeAnnouncementFilter(String(employee._id), employee.role))
      .select("title category priority publishAt")
      .sort({ publishAt: -1 })
      .limit(4)
      .lean(),
  ]);
  const monthlyAttendanceDays = [...attendanceDays.values()].filter((day) => day.recordedWorkMs > 0).length;
  const statistics = [
    { label: "My pending tasks", count: pendingTasks, icon: ClipboardList, href: "/employee/tasks" },
    { label: "My active tasks", count: activeTasks, icon: ClipboardList, href: "/employee/tasks" },
    { label: "My completed tasks", count: completedTasks, icon: ClipboardList, href: "/employee/tasks" },
    { label: "Today's recorded work (UTC)", count: formatDuration(activityTotals.workDurationMs), icon: Clock3, href: "/employee/activity" },
  ];

  return (
    <>
      <PageHeading title={`Welcome, ${firstName}`} description={`Your personal workspace at ${branding.workspaceName} · ${formatWorkspaceDate(new Date(), branding.defaultTimeZone, branding.dateFormat)}`} />
      <DashboardCard className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <UserAvatar name={employee.fullName} src={employee.profilePicture} className="size-12 text-sm" />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Your profile</p>
            <p className="mt-2 text-lg font-semibold text-white">{employee.fullName}</p>
            <p className="mt-1 text-sm text-slate-400">{employee.designation || employee.email}</p>
            <p className="mt-1 text-xs capitalize text-slate-500">{formatWorkDate(employee.joiningDate)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2"><RoleBadge role={employee.role} /><StatusBadge status={employee.status} /></div>
      </DashboardCard>
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {statistics.map(({ label, count, icon: StatisticIcon, href }) => {
          return <Link key={label} href={href} className="rounded-2xl border border-white/[0.06] bg-panel p-4 shadow-card transition hover:border-white/10 sm:p-5">
            <div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-slate-400">{label}</p><span className="flex size-8 items-center justify-center rounded-lg bg-accent/10 text-violet-200"><StatisticIcon size={15} /></span></div>
            <p className="mt-3 text-2xl font-semibold text-white">{count}</p>
          </Link>;
        })}
      </div>
      <DashboardCard className="mb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><Activity size={16} className="text-violet-200" /><h2 className="text-sm font-semibold text-white">Today's work activity (UTC)</h2></div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div><p className="text-xs text-slate-500">Current session</p><p className="mt-1 text-sm text-white">{activeSession ? activeSession.status === "on_break" ? "On break" : "Session open" : "None"}</p></div>
              <div><p className="text-xs text-slate-500">Current task</p><p className="mt-1 truncate text-sm text-white">{activeSession?.task?.title ?? "—"}</p></div>
              <div><p className="text-xs text-slate-500">Next check-in (UTC)</p><p className="mt-1 text-sm text-white">{activeSession?.nextCheckInDueAt ? new Date(activeSession.nextCheckInDueAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: "UTC" }) : "Not scheduled"}</p></div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Latest daily report: {latestReport ? latestReport.status === "submitted" ? "Submitted" : "Draft to complete" : "None yet"}</p>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600"><Clock3 size={12} />Recorded timer data does not verify continuous activity.</p>
          </div>
          <Link href="/employee/activity" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500">
            {activeSession?.status === "on_break" ? <Play size={15} /> : activeSession ? <Coffee size={15} /> : <Play size={15} />}
            {activeSession?.status === "on_break" ? "Resume work" : activeSession ? "Manage session" : "Start work"}
            <ArrowRight size={14} />
          </Link>
        </div>
      </DashboardCard>
      <DashboardCard className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div><p className="text-xs text-slate-500">Recorded work days this month (UTC)</p><p className="mt-2 text-sm font-semibold text-white">{monthlyAttendanceDays}</p></div>
          <div><p className="text-xs text-slate-500">Recent leave status</p><p className="mt-2 text-sm font-semibold capitalize text-white">{latestLeave?.status ?? "No requests"}</p>{latestLeave && <p className="mt-1 text-[11px] text-slate-500">{latestLeave.leaveType.replaceAll("_", " ")}</p>}</div>
          <div><p className="text-xs text-slate-500">Approved incentives</p><p className="mt-2 text-sm font-semibold text-white">{approvedIncentives.length ? approvedIncentives.map((item) => formatMoney(item.total, item._id)).join(" · ") : "None"}</p></div>
          <div><p className="text-xs text-slate-500">Latest payment status</p><p className="mt-2 text-sm font-semibold capitalize text-white">{latestPayment?.status ?? "No approved records"}</p>{latestPayment && <Link href={`/employee/earnings`} className="mt-1 inline-block text-[11px] text-violet-200">{formatWorkDate(latestPayment.periodStart)} · View earnings</Link>}</div>
        </div>
      </DashboardCard>
      <DashboardCard className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-white">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/employee/tasks" className="inline-flex min-h-10 items-center rounded-xl bg-accent px-4 text-xs font-semibold text-white transition hover:bg-violet-500">View my tasks</Link>
          <Link href="/employee/tasks?status=in_review" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-xs font-medium text-slate-200 hover:bg-white/[0.04]">Awaiting review · {pendingReviews}</Link>
          <Link href="/employee/projects" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-xs font-medium text-slate-200 hover:bg-white/[0.04]">View my projects</Link>
          <Link href="/employee/activity" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-xs font-medium text-slate-200 hover:bg-white/[0.04]">Submit daily work report</Link>
          <Link href="/employee/attendance" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-xs font-medium text-slate-200 hover:bg-white/[0.04]">Request leave</Link>
        </div>
      </DashboardCard>
      <div className="grid gap-5 xl:grid-cols-2">
        <DashboardCard className="p-0">
          <div className="flex items-center justify-between border-b border-white/6 px-5 py-4"><div><h2 className="text-sm font-semibold text-white">Upcoming deadlines</h2><p className="mt-1 text-xs text-slate-500">Your next assigned tasks</p></div><Link href="/employee/tasks" className="inline-flex items-center gap-1 text-xs font-medium text-violet-200">My tasks <ArrowRight size={13} /></Link></div>
          {upcomingDeadlines.length ? <div className="divide-y divide-white/5">{upcomingDeadlines.map((task) => <Link key={String(task._id)} href={`/employee/tasks/${task._id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02]"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-200">{task.title}</span><span className="mt-1 block truncate text-xs text-slate-500">{task.project?.name ?? "Project unavailable"}</span></span><TaskStatusBadge status={task.status} /><span className="whitespace-nowrap text-xs text-slate-400">{formatWorkDate(task.dueDate)}</span></Link>)}</div> : <div className="px-5 py-8 text-center"><p className="text-sm text-slate-300">No upcoming deadlines</p><p className="mt-1 text-xs text-slate-500">Tasks with a future due date will appear here.</p></div>}
        </DashboardCard>
        <DashboardCard className="p-0">
          <div className="flex items-center justify-between border-b border-white/6 px-5 py-4"><div><h2 className="text-sm font-semibold text-white">Recently assigned</h2><p className="mt-1 text-xs text-slate-500">Your latest tasks</p></div><Link href="/employee/tasks" className="inline-flex items-center gap-1 text-xs font-medium text-violet-200">My tasks <ArrowRight size={13} /></Link></div>
          {recentlyAssigned.length ? <div className="divide-y divide-white/5">{recentlyAssigned.map((task) => <Link key={String(task._id)} href={`/employee/tasks/${task._id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02]"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-200">{task.title}</span><span className="mt-1 block truncate text-xs text-slate-500">{task.project?.name ?? "Project unavailable"} · Added {new Date(task.createdAt).toLocaleDateString()}</span></span><TaskStatusBadge status={task.status} /></Link>)}</div> : <div className="px-5 py-8 text-center"><p className="text-sm text-slate-300">No tasks assigned yet</p><p className="mt-1 text-xs text-slate-500">Newly assigned work will appear here.</p></div>}
        </DashboardCard>
        <DashboardCard className="p-0">
          <div className="border-b border-white/6 px-5 py-4"><h2 className="text-sm font-semibold text-white">Recent notifications</h2><p className="mt-1 text-xs text-slate-500">Updates for your account</p></div>
          {recentNotifications.length ? <div className="divide-y divide-white/5">{recentNotifications.map((notification) => <Link key={String(notification._id)} href="/employee/notifications" className="flex items-start gap-3 px-5 py-3 hover:bg-white/[0.02]"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.readAt ? "bg-slate-600" : "bg-violet-300"}`} /><span className="min-w-0"><span className="block truncate text-xs font-medium text-slate-200">{notification.title}</span><span className="mt-1 block line-clamp-2 text-[11px] text-slate-500">{notification.message}</span></span></Link>)}</div> : <p className="px-5 py-8 text-center text-xs text-slate-500">No recent notifications.</p>}
        </DashboardCard>
        <DashboardCard className="p-0">
          <div className="border-b border-white/6 px-5 py-4"><h2 className="text-sm font-semibold text-white">Latest announcements</h2><p className="mt-1 text-xs text-slate-500">Published for you</p></div>
          {latestAnnouncements.length ? <div className="divide-y divide-white/5">{latestAnnouncements.map((announcement) => <Link key={String(announcement._id)} href={`/employee/announcements/${announcement._id}`} className="flex flex-wrap items-center gap-2 px-5 py-3 hover:bg-white/[0.02]"><span className={`min-w-0 flex-1 truncate text-xs font-medium ${announcement.priority === "urgent" ? "text-rose-200" : "text-slate-200"}`}>{announcement.title}</span><span className="text-[10px] text-slate-500">{announcementCategoryLabels[announcement.category as keyof typeof announcementCategoryLabels]}</span><span className="text-[10px] text-slate-500">{announcementPriorityLabels[announcement.priority as keyof typeof announcementPriorityLabels]}</span></Link>)}</div> : <p className="px-5 py-8 text-center text-xs text-slate-500">No current announcements.</p>}
        </DashboardCard>
      </div>
    </>
  );
}
