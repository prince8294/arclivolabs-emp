"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Coffee, RefreshCw, Users, X } from "lucide-react";
import { AttendanceCalendar, type AttendanceCalendarDay } from "@/components/hr/attendance-calendar";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { PageHeading } from "@/components/ui/page-heading";
import { RoleBadge } from "@/components/ui/role-badge";
import { formatDuration } from "@/lib/activity/time";

interface AttendanceEmployee {
  _id: string;
  employeeId: string;
  fullName: string;
  role: "developer" | "designer";
  designation?: string;
  status?: string;
}

interface SessionInfo {
  _id: string;
  startedAt: string;
  endedAt?: string | null;
  status: string;
  task?: { title: string } | null;
  project?: { name: string } | null;
}

interface AttendanceRecord extends AttendanceCalendarDay {
  employeeId: string;
  employee: AttendanceEmployee | null;
  recordedWorkMs: number;
  adjustedWorkMs: number;
  breakMs: number;
  firstStartAt: string | null;
  lastEndAt: string | null;
  sessions: SessionInfo[];
  approvedAdjustmentMinutes: number;
}

interface Correction {
  _id: string;
  employee: AttendanceEmployee | null;
  attendanceDate: string;
  requestedChanges: string;
  approvedChanges: string;
  previousValue: string;
  updatedValue: string;
  minutesAdjustment: number;
  reason: string;
  reviewerRemarks?: string;
  status: string;
}

interface AttendanceResponse {
  overview: { employeesWithWorkToday: number; employeesOnBreak: number; recordedWorkMsToday: number; approvedLeavesToday: number };
  employees: AttendanceEmployee[];
  records: AttendanceRecord[];
  corrections: Correction[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

interface CalendarResponse {
  employee: AttendanceEmployee | null;
  days: AttendanceRecord[];
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
}

function monthShift(month: string, delta: number) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value - 1 + delta, 1)).toISOString().slice(0, 7);
}

async function responseJson(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not load attendance.");
  return result;
}

export function AdminAttendance() {
  const [date, setDate] = useState(todayUtc);
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(todayUtc().slice(0, 7));
  const [calendarData, setCalendarData] = useState<CalendarResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayUtc);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [formEmployee, setFormEmployee] = useState("");
  const [formDate, setFormDate] = useState(todayUtc);
  const [changes, setChanges] = useState("");
  const [reason, setReason] = useState("");
  const [minutesAdjustment, setMinutesAdjustment] = useState("0");
  const [reviewInputs, setReviewInputs] = useState<Record<string, { approvedChanges: string; minutesAdjustment: string; reason: string }>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const query = new URLSearchParams({ date, page: String(page) });
    if (employeeId) query.set("employeeId", employeeId);
    if (status) query.set("status", status);
    const result = await responseJson(await fetch(`/api/admin/attendance?${query}`, { cache: "no-store" }));
    setData(result);
    setFormEmployee((current) => current || result.employees[0]?._id || "");
  }, [date, page, employeeId, status]);

  const loadCalendar = useCallback(async () => {
    if (!selectedEmployee) {
      setCalendarData(null);
      return;
    }
    const query = new URLSearchParams({ month: calendarMonth, employeeId: selectedEmployee });
    const result = await responseJson(await fetch(`/api/admin/attendance?${query}`, { cache: "no-store" }));
    setCalendarData(result);
  }, [calendarMonth, selectedEmployee]);

  useEffect(() => {
    void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load attendance."));
  }, [load]);
  useEffect(() => {
    if (data?.employees.length && !selectedEmployee) setSelectedEmployee(data.employees[0]._id);
  }, [data?.employees, selectedEmployee]);
  useEffect(() => {
    void loadCalendar().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load attendance calendar."));
  }, [loadCalendar]);

  const selectedDay = useMemo(() => calendarData?.days.find((day) => day.date === selectedDate), [calendarData?.days, selectedDate]);

  async function createCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("correction");
    setError("");
    setNotice("");
    try {
      await responseJson(await fetch("/api/admin/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: formEmployee, attendanceDate: formDate, changes, reason, minutesAdjustment: Number(minutesAdjustment) }),
      }));
      setChanges("");
      setReason("");
      setMinutesAdjustment("0");
      setNotice("Attendance correction recorded with its original value and audit details.");
      await Promise.all([load(), loadCalendar()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save attendance correction.");
    } finally {
      setBusy("");
    }
  }

  async function reviewCorrection(id: string, decision: "approve" | "reject") {
    const input = reviewInputs[id] ?? { approvedChanges: "", minutesAdjustment: "0", reason: "" };
    setBusy(id);
    setError("");
    setNotice("");
    try {
      await responseJson(await fetch(`/api/admin/attendance/corrections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, approvedChanges: input.approvedChanges, minutesAdjustment: Number(input.minutesAdjustment), reason: input.reason }),
      }));
      setNotice(`Attendance request ${decision === "approve" ? "approved" : "rejected"}.`);
      await Promise.all([load(), loadCalendar()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not review attendance request.");
    } finally {
      setBusy("");
    }
  }

  function setReviewInput(id: string, key: "approvedChanges" | "minutesAdjustment" | "reason", value: string) {
    setReviewInputs((current) => {
      const previous = current[id] ?? { approvedChanges: "", minutesAdjustment: "0", reason: "" };
      return { ...current, [id]: { ...previous, [key]: value } };
    });
  }

  return (
    <>
      <PageHeading title="Attendance" description="Daily summaries are derived from Part 4 work sessions, with recorded breaks excluded. Calendar dates and summaries use UTC; missing sessions are not treated as confirmed absence." />
      {error && <p role="alert" className="mb-4 flex gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"><AlertCircle size={16} className="shrink-0" />{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200">{notice}</p>}
      {!data ? <DashboardCard><p className="text-sm text-slate-400">Loading attendance…</p></DashboardCard> : <>
        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: "Employees with recorded work today", value: data.overview.employeesWithWorkToday, icon: Users },
            { label: "Employees on recorded break", value: data.overview.employeesOnBreak, icon: Coffee },
            { label: "Recorded working hours today", value: formatDuration(data.overview.recordedWorkMsToday), icon: Clock3 },
            { label: "Approved leaves today", value: data.overview.approvedLeavesToday, icon: CalendarDays },
          ].map(({ label, value, icon: Icon }) => <DashboardCard key={label} className="p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-slate-400">{label}</p><Icon size={16} className="text-violet-200" /></div><p className="mt-4 text-xl font-semibold text-white sm:text-2xl">{value}</p></DashboardCard>)}
        </div>
        <DashboardCard className="mb-5 p-0">
          <div className="grid gap-3 border-b border-white/[0.06] p-4 sm:grid-cols-4 sm:px-5">
            <label className="space-y-1.5 text-xs text-slate-400">Employee<select value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white"><option value="">All employees</option>{data.employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.fullName}</option>)}</select></label>
            <label className="space-y-1.5 text-xs text-slate-400">Date (UTC)<input type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label>
            <label className="space-y-1.5 text-xs text-slate-400">Attendance status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white"><option value="">All statuses</option><option value="work_recorded">Work Recorded</option><option value="no_work_recorded">No Work Recorded</option><option value="approved_leave">Approved Leave</option><option value="pending_review">Pending Review</option></select></label>
            <div className="flex items-end"><Button variant="secondary" onClick={() => void load()}><RefreshCw size={14} />Refresh</Button></div>
          </div>
          {data.records.length ? <div className="divide-y divide-white/[0.05]">
            {data.records.map((record) => <div key={`${record.employeeId}-${record.date}`} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(160px,1.3fr)_100px_100px_minmax(130px,1fr)_minmax(120px,0.8fr)_minmax(130px,1fr)] sm:items-center sm:px-5">
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-200">{record.employee?.fullName ?? "Employee unavailable"}</span><span className="mt-1 block text-xs text-slate-500">{record.employee?.employeeId ?? "—"} · {record.employee?.designation ?? record.employee?.role ?? ""}</span></span>
              <span className="text-xs text-slate-300">{new Date(`${record.date}T00:00:00Z`).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" })}</span>
              <span className="text-xs text-slate-400">Start {formatTime(record.firstStartAt)}</span>
              <span className="text-xs text-slate-400">End {formatTime(record.lastEndAt)}</span>
              <span><span className="block font-mono text-xs text-white">{formatDuration(record.recordedWorkMs)}</span><span className="mt-1 block text-[10px] text-slate-500">Break {formatDuration(record.breakMs)}</span></span>
              <span className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] ${record.status === "work_recorded" ? "bg-emerald-300/10 text-emerald-200" : record.status === "approved_leave" ? "bg-sky-300/10 text-sky-200" : record.status === "pending_review" ? "bg-amber-300/10 text-amber-200" : "bg-slate-400/10 text-slate-300"}`}>{record.status.replaceAll("_", " ")}</span>{record.approvedAdjustmentMinutes !== 0 && <span className="text-[10px] text-violet-200">{record.approvedAdjustmentMinutes > 0 ? "+" : ""}{record.approvedAdjustmentMinutes} min approved</span>}</span>
            </div>)}
          </div> : <div className="px-6 py-10 text-center"><p className="text-sm text-slate-300">No employee records match these filters</p><p className="mt-1 text-xs text-slate-500">No work session does not mean a confirmed absence.</p></div>}
          <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3 text-xs text-slate-500 sm:px-5"><span>{data.pagination.total} employees · page {page} / {Math.max(1, data.pagination.pages)}</span><span className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page" className="rounded border border-white/10 p-1.5 disabled:opacity-30"><ChevronLeft size={15} /></button><button type="button" disabled={page >= data.pagination.pages} onClick={() => setPage((value) => value + 1)} aria-label="Next page" className="rounded border border-white/10 p-1.5 disabled:opacity-30"><ChevronRight size={15} /></button></span></div>
        </DashboardCard>

        <div className="mb-5 grid gap-5 xl:grid-cols-2">
          <DashboardCard>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold text-white">Attendance calendar</h2><select aria-label="Calendar employee" value={selectedEmployee} onChange={(event) => { setSelectedEmployee(event.target.value); setSelectedDate(`${calendarMonth}-01`); }} className="h-10 max-w-56 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white"><option value="">Select employee</option>{data.employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.fullName}</option>)}</select></div>
            <div className="mb-3 flex items-center justify-between"><button type="button" onClick={() => setCalendarMonth((current) => monthShift(current, -1))} aria-label="Previous month" className="rounded-lg p-2 text-slate-400 hover:bg-white/5"><ChevronLeft size={16} /></button><span className="text-sm text-slate-300">{calendarMonth}</span><button type="button" onClick={() => setCalendarMonth((current) => monthShift(current, 1))} aria-label="Next month" className="rounded-lg p-2 text-slate-400 hover:bg-white/5"><ChevronRight size={16} /></button></div>
            {calendarData ? <AttendanceCalendar month={calendarMonth} days={calendarData.days} selectedDate={selectedDate} onSelect={setSelectedDate} /> : <p className="py-10 text-center text-sm text-slate-500">Choose an employee to view their month.</p>}
          </DashboardCard>
          <DashboardCard>
            <h2 className="text-sm font-semibold text-white">Sessions for {selectedDate}</h2>
            <p className="mt-1 text-xs text-slate-500">{calendarData?.employee?.fullName ?? "Select an employee"} · Day totals use UTC.</p>
            <div className="mt-4 space-y-3">{selectedDay?.sessions.length ? selectedDay.sessions.map((session) => <div key={session._id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><p className="text-sm font-medium text-slate-200">{session.task?.title ?? "Task unavailable"}</p><p className="mt-1 text-xs text-slate-500">{session.project?.name ?? "Project unavailable"}</p><p className="mt-2 text-xs text-slate-400">{formatTime(session.startedAt)} – {formatTime(session.endedAt)}</p></div>) : <div className="rounded-xl border border-white/[0.06] p-6 text-center"><p className="text-sm text-slate-300">{selectedDay?.approvedLeave ? "Approved leave" : "No recorded sessions on this date"}</p><p className="mt-1 text-xs text-slate-500">Not a confirmed absence.</p></div>}</div>
            <div className="mt-4 border-t border-white/[0.06] pt-4 text-xs text-slate-400">Work: {formatDuration(selectedDay?.recordedWorkMs ?? 0)} · Break: {formatDuration(selectedDay?.breakMs ?? 0)}</div>
          </DashboardCard>
        </div>

        <DashboardCard className="mb-5">
          <h2 className="text-sm font-semibold text-white">Record an attendance correction</h2>
          <p className="mt-1 text-xs text-slate-500">The original work sessions are never overwritten. Corrections are stored as separate audit records.</p>
          <form onSubmit={(event) => void createCorrection(event)} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select required aria-label="Employee for correction" value={formEmployee} onChange={(event) => setFormEmployee(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white"><option value="">Choose employee</option>{data.employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.fullName}</option>)}</select>
            <input required aria-label="Affected date" type="date" value={formDate} onChange={(event) => setFormDate(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" />
            <input required aria-label="Attendance minutes adjustment" type="number" min={-1440} max={1440} step={1} value={minutesAdjustment} onChange={(event) => setMinutesAdjustment(event.target.value)} placeholder="Minutes (+/-)" className="h-11 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" />
            <input required minLength={5} maxLength={2000} aria-label="Correction details" value={changes} onChange={(event) => setChanges(event.target.value)} placeholder="Correction details" className="h-11 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" />
            <input required minLength={5} maxLength={2000} aria-label="Reason for correction" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" className="h-11 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" />
            <div className="xl:col-span-5"><Button type="submit" disabled={busy === "correction"}>{busy === "correction" ? "Saving…" : "Save audited correction"}</Button></div>
          </form>
        </DashboardCard>

        <DashboardCard>
          <h2 className="text-sm font-semibold text-white">Employee correction requests</h2>
          <div className="mt-4 space-y-3">{data.corrections.length ? data.corrections.map((correction) => <div key={correction._id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-start gap-3"><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-200">{correction.employee?.fullName ?? "Employee"} · {correction.attendanceDate.slice(0, 10)}</span><span className="mt-1 block text-xs text-slate-400">{correction.requestedChanges}</span><span className="mt-1 block text-xs text-slate-500">Reason: {correction.reason}</span>{correction.reviewerRemarks && <span className="mt-1 block text-xs text-slate-400">Review: {correction.reviewerRemarks}</span>}</span><span className="text-xs capitalize text-amber-200">{correction.status}</span></div>
            {correction.status === "pending" && <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_minmax(0,1fr)_auto_auto]">
              <input aria-label="Approved correction details" value={reviewInputs[correction._id]?.approvedChanges ?? correction.requestedChanges} onChange={(event) => setReviewInput(correction._id, "approvedChanges", event.target.value)} className="h-10 rounded-lg border border-white/10 bg-[#111827] px-3 text-xs text-white" />
              <input type="number" aria-label="Approved minutes adjustment" value={reviewInputs[correction._id]?.minutesAdjustment ?? "0"} onChange={(event) => setReviewInput(correction._id, "minutesAdjustment", event.target.value)} className="h-10 rounded-lg border border-white/10 bg-[#111827] px-3 text-xs text-white" />
              <input aria-label="Review reason" placeholder="Review note (optional)" value={reviewInputs[correction._id]?.reason ?? ""} onChange={(event) => setReviewInput(correction._id, "reason", event.target.value)} className="h-10 rounded-lg border border-white/10 bg-[#111827] px-3 text-xs text-white" />
              <Button size="sm" disabled={busy === correction._id} onClick={() => void reviewCorrection(correction._id, "approve")}><Check size={13} />Approve</Button>
              <Button size="sm" variant="secondary" disabled={busy === correction._id} onClick={() => void reviewCorrection(correction._id, "reject")}><X size={13} />Reject</Button>
            </div>}
            {(correction.status === "approved" || correction.status === "rejected") && <p className="mt-3 text-xs text-slate-500">Previous: {correction.previousValue || "Not recorded"} · Updated: {correction.updatedValue || correction.approvedChanges || correction.status}</p>}
          </div>) : <p className="rounded-xl border border-white/[0.06] p-6 text-center text-sm text-slate-500">No attendance correction requests for this date.</p>}</div>
        </DashboardCard>
      </>}
    </>
  );
}
