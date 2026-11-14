"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, CalendarDays, ChevronLeft, ChevronRight, Clock3, Coffee, RefreshCw, Users } from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { PageHeading } from "@/components/ui/page-heading";
import { RoleBadge } from "@/components/ui/role-badge";
import { formatDuration } from "@/lib/activity/time";
import type { WorkSessionStatus } from "@/types/activity";

interface ActivityEmployee {
  _id: string;
  employeeId: string;
  fullName: string;
  role: "developer" | "designer";
  status: string;
}

interface ActivityRow {
  _id: string;
  employee: ActivityEmployee | null;
  task: { title: string; taskId?: string } | null;
  project: { name: string; projectId?: string } | null;
  startedAt: string;
  endedAt?: string | null;
  status: WorkSessionStatus;
  durationMs: number;
  nextCheckInDueAt?: string | null;
  currentBreakStartedAt?: string | null;
  latestCheckIn?: { submittedAt: string; workStatus: string } | null;
}

interface ActivityResponse {
  serverNow: string;
  overview: { openSessions: number; employeesOnBreak: number; todayWorkDurationMs: number; pendingCheckIns: number };
  employees: ActivityEmployee[];
  sessions: ActivityRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

function localDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
}

async function responseJson(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not load employee activity.");
  return result;
}

export function AdminActivityDashboard() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(localDateValue);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ page: String(page), date });
    if (employeeId) query.set("employeeId", employeeId);
    if (status) query.set("status", status);
    try {
      setData(await responseJson(await fetch(`/api/admin/activity?${query}`, { cache: "no-store" })));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load employee activity.");
    } finally {
      setLoading(false);
    }
  }, [page, date, employeeId, status]);

  useEffect(() => { void load(); }, [load]);

  function updateFilter(update: () => void) {
    update();
    setPage(1);
  }

  return (
    <>
      <PageHeading title="Activity & attendance" description="Review recorded work sessions, breaks, check-ins, and reports. Day totals and the date filter use UTC; timestamps display in your browser's local timezone. Open sessions describe saved timer state, not verified online or productive activity." />
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
      {!data ? <DashboardCard><p className="text-sm text-slate-400">{loading ? "Loading activity records…" : "No activity data available."}</p></DashboardCard> : <>
        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: "Open work sessions", value: data.overview.openSessions, icon: Activity },
            { label: "Employees on recorded break", value: data.overview.employeesOnBreak, icon: Coffee },
            { label: "Today's recorded work", value: formatDuration(data.overview.todayWorkDurationMs), icon: Clock3 },
            { label: "Pending check-ins", value: data.overview.pendingCheckIns, icon: CalendarDays },
          ].map(({ label, value, icon: Icon }) => <DashboardCard key={label} className="p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-slate-400">{label}</p><Icon size={17} className="text-violet-200" /></div><p className="mt-4 text-xl font-semibold text-white sm:text-2xl">{value}</p></DashboardCard>)}
        </div>
        <DashboardCard className="p-0">
          <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-end sm:px-5">
            <label className="min-w-0 flex-1 space-y-1.5 text-xs font-medium text-slate-400">Employee
              <select value={employeeId} onChange={(event) => updateFilter(() => setEmployeeId(event.target.value))} className="h-10 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white outline-none focus:border-accent"><option value="">All employees</option>{data.employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.fullName} · {employee.employeeId}</option>)}</select>
            </label>
            <label className="space-y-1.5 text-xs font-medium text-slate-400">UTC date
              <input type="date" value={date} onChange={(event) => updateFilter(() => setDate(event.target.value))} className="h-10 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white outline-none focus:border-accent sm:w-40" />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-slate-400">Session status
              <select value={status} onChange={(event) => updateFilter(() => setStatus(event.target.value))} className="h-10 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white outline-none focus:border-accent sm:w-44"><option value="">All statuses</option><option value="working">Working session open</option><option value="on_break">On break</option><option value="ended">Session ended</option></select>
            </label>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08] disabled:opacity-50"><RefreshCw size={14} />Refresh</button>
          </div>
          {data.sessions.length ? <div className="divide-y divide-white/[0.05]">
            {data.sessions.map((session) => {
              const isOverdue = session.status === "working" && session.nextCheckInDueAt && new Date(session.nextCheckInDueAt) <= new Date(data.serverNow);
              return <div key={session._id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${session.status === "on_break" ? "bg-amber-400/10 text-amber-200" : session.status === "working" ? "bg-emerald-400/10 text-emerald-200" : "bg-white/[0.05] text-slate-400"}`}><Clock3 size={16} /></span>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/activity/${session.employee?._id}`} className="truncate text-sm font-medium text-slate-100 hover:text-violet-200">{session.employee?.fullName ?? "Employee unavailable"}</Link>
                  <p className="mt-1 truncate text-xs text-slate-500">{session.task?.title ?? "Task unavailable"} · {session.project?.name ?? "Project unavailable"}</p>
                </div>
                {session.employee && <RoleBadge role={session.employee.role} />}
                <div className="min-w-28 text-right"><p className="text-xs font-medium text-slate-300">{session.status === "working" ? "Working session open" : session.status === "on_break" ? "On break" : "Session ended"}</p><p className="mt-1 text-[11px] text-slate-500">Started {formatTime(session.startedAt)}</p></div>
                <div className="min-w-24 text-right"><p className="font-mono text-sm tabular-nums text-white">{formatDuration(session.durationMs)}</p><p className="mt-1 text-[11px] text-slate-500">{session.latestCheckIn ? `Check-in ${formatTime(session.latestCheckIn.submittedAt)}` : "No submitted check-in"}</p></div>
                {isOverdue && <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-medium text-amber-200">Check-in overdue</span>}
                <Link href={`/admin/activity/${session.employee?._id}`} className="rounded-lg px-2 py-1 text-xs font-medium text-violet-200 hover:bg-white/[0.05]">Details</Link>
              </div>;
            })}
          </div> : <div className="px-6 py-12 text-center"><Users className="mx-auto text-slate-600" size={20} /><p className="mt-3 text-sm font-medium text-slate-300">No sessions found for these filters</p><p className="mt-1 text-xs text-slate-500">Choose another date or employee to review recorded activity.</p></div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3 sm:px-5">
            <p className="text-xs text-slate-500">{data.pagination.total} sessions · Page {data.pagination.page} of {Math.max(1, data.pagination.pages)}</p>
            <div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-white/10 p-2 text-slate-300 disabled:opacity-30" aria-label="Previous page"><ChevronLeft size={16} /></button><button type="button" disabled={page >= data.pagination.pages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-white/10 p-2 text-slate-300 disabled:opacity-30" aria-label="Next page"><ChevronRight size={16} /></button></div>
          </div>
        </DashboardCard>
      </>}
    </>
  );
}
