"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Clock3, Coffee, Plus, Send, X } from "lucide-react";
import { AttendanceCalendar, type AttendanceCalendarDay } from "@/components/hr/attendance-calendar";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { PageHeading } from "@/components/ui/page-heading";
import { formatDuration } from "@/lib/activity/time";
import { leaveStatusLabels, leaveTypeLabels, leaveTypes, type LeaveType } from "@/types/hr";

interface AttendanceSession {
  _id: string;
  startedAt: string;
  endedAt?: string | null;
  status: string;
  task?: { title: string; taskId?: string } | null;
  project?: { name: string } | null;
}

interface AttendanceDay extends AttendanceCalendarDay {
  employeeId: string;
  firstStartAt: string | null;
  lastEndAt: string | null;
  sessions: AttendanceSession[];
  approvedAdjustmentMinutes: number;
}

interface LeaveRequestItem {
  _id: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  notes: string;
  status: keyof typeof leaveStatusLabels;
  adminRemarks: string;
  reviewedAt?: string;
}

interface CorrectionItem {
  _id: string;
  attendanceDate: string;
  requestedChanges: string;
  approvedChanges: string;
  previousValue: string;
  updatedValue: string;
  reason: string;
  reviewerRemarks?: string;
  status: string;
  reviewedAt?: string;
}

interface AttendanceData {
  month: string;
  summary: { recordedWorkDays: number; recordedWorkMs: number; approvedLeaveDays: number; todayRecordedWorkMs: number };
  days: AttendanceDay[];
  leaves: LeaveRequestItem[];
  corrections: CorrectionItem[];
}

const todayUtc = new Date().toISOString().slice(0, 10);

function monthLabel(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

function shiftMonth(month: string, delta: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

function formatUtcDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
}

async function responseJson(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "The request could not be completed.");
  return result;
}

export function EmployeeAttendance() {
  const [month, setMonth] = useState(todayUtc.slice(0, 7));
  const [data, setData] = useState<AttendanceData | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayUtc);
  const [leaveType, setLeaveType] = useState<LeaveType>("casual");
  const [startDate, setStartDate] = useState(todayUtc);
  const [endDate, setEndDate] = useState(todayUtc);
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveNotes, setLeaveNotes] = useState("");
  const [requestedChanges, setRequestedChanges] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const result = await responseJson(await fetch(`/api/employee/attendance?month=${month}`, { cache: "no-store" }));
    setData(result);
  }, [month]);

  useEffect(() => {
    void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load attendance."));
  }, [load]);

  const dayMap = useMemo(() => new Map((data?.days ?? []).map((day) => [day.date, day])), [data?.days]);
  const selectedDay = dayMap.get(selectedDate);

  async function submitLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("leave");
    setError("");
    setNotice("");
    try {
      await responseJson(await fetch("/api/employee/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveType, startDate, endDate, reason: leaveReason, notes: leaveNotes }),
      }));
      setLeaveReason("");
      setLeaveNotes("");
      setNotice("Leave request submitted for admin review.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not submit leave request.");
    } finally {
      setBusy("");
    }
  }

  async function cancelLeave(id: string) {
    setBusy(`cancel-${id}`);
    setError("");
    setNotice("");
    try {
      await responseJson(await fetch(`/api/employee/leaves/${id}`, { method: "DELETE" }));
      setNotice("Pending leave request cancelled.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not cancel this leave request.");
    } finally {
      setBusy("");
    }
  }

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("correction");
    setError("");
    setNotice("");
    try {
      await responseJson(await fetch("/api/employee/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceDate: selectedDate, requestedChanges, reason: correctionReason }),
      }));
      setRequestedChanges("");
      setCorrectionReason("");
      setNotice("Attendance correction request sent for admin review.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not submit the correction request.");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeading title="Attendance & leave" description="Your attendance is calculated from recorded work sessions, excluding recorded breaks. Dates and monthly totals use UTC; a day without a session is not a confirmed absence." />
      {error && <p role="alert" className="mb-4 flex gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"><AlertCircle size={16} className="shrink-0" />{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200">{notice}</p>}
      {!data ? <DashboardCard><p className="text-sm text-slate-400">Loading attendance…</p></DashboardCard> : <>
        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: "Today's recorded work", value: formatDuration(data.summary.todayRecordedWorkMs), icon: Clock3 },
            { label: "Recorded work days this month", value: data.summary.recordedWorkDays, icon: CalendarDays },
            { label: "Recorded work this month", value: formatDuration(data.summary.recordedWorkMs), icon: Clock3 },
            { label: "Approved leave days this month", value: data.summary.approvedLeaveDays, icon: Coffee },
          ].map(({ label, value, icon: Icon }) => <DashboardCard key={label} className="p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-slate-400">{label}</p><Icon size={16} className="text-violet-200" /></div><p className="mt-4 text-xl font-semibold text-white sm:text-2xl">{value}</p></DashboardCard>)}
        </div>
        <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <DashboardCard>
            <div className="mb-4 flex items-center justify-between gap-3"><button type="button" onClick={() => setMonth((current) => shiftMonth(current, -1))} aria-label="Previous month" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><ChevronLeft size={17} /></button><div className="text-center"><h2 className="text-sm font-semibold text-white">{monthLabel(month)}</h2><p className="mt-1 text-xs text-slate-500">Calendar-day totals (UTC)</p></div><button type="button" onClick={() => setMonth((current) => shiftMonth(current, 1))} aria-label="Next month" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><ChevronRight size={17} /></button></div>
            <AttendanceCalendar month={month} days={data.days} selectedDate={selectedDate} onSelect={setSelectedDate} />
          </DashboardCard>
          <DashboardCard>
            <h2 className="text-sm font-semibold text-white">Daily work history</h2>
            <p className="mt-1 text-xs text-slate-500">{formatUtcDate(selectedDate)} · {selectedDay?.status.replaceAll("_", " ") ?? "No work recorded"}</p>
            <div className="mt-4 space-y-3">
              {selectedDay?.sessions.length ? selectedDay.sessions.map((session) => <div key={session._id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><p className="text-sm font-medium text-slate-200">{session.task?.title ?? "Task unavailable"}</p><p className="mt-1 text-xs text-slate-500">{session.project?.name ?? "Project unavailable"}</p><p className="mt-2 text-xs text-slate-400">{new Date(session.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – {session.endedAt ? new Date(session.endedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : session.status === "ended" ? "—" : "Open session"}</p></div>) : <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center"><p className="text-sm text-slate-300">{selectedDay?.approvedLeave ? "Approved leave" : "No recorded work sessions"}</p><p className="mt-1 text-xs text-slate-500">This is not evidence of an absence.</p></div>}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs"><span className="text-slate-500">Recorded work · Break time</span><span className="font-mono text-slate-200">{formatDuration(selectedDay?.recordedWorkMs ?? 0)} · {formatDuration(selectedDay?.breakMs ?? 0)}</span></div>
            {selectedDay?.approvedAdjustmentMinutes !== 0 && <p className="mt-2 text-xs text-violet-200">Admin-approved adjustment: {selectedDay?.approvedAdjustmentMinutes} minutes</p>}
          </DashboardCard>
        </div>

        <DashboardCard className="mb-5">
          <div className="mb-5"><h2 className="text-sm font-semibold text-white">Leave requests</h2><p className="mt-1 text-xs text-slate-500">Leave duration uses inclusive UTC calendar days. Requests are not approved automatically.</p></div>
          <form onSubmit={(event) => void submitLeave(event)} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2 text-sm text-slate-300">Leave type<select value={leaveType} onChange={(event) => setLeaveType(event.target.value as LeaveType)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white outline-none focus:border-accent">{leaveTypes.map((type) => <option key={type} value={type}>{leaveTypeLabels[type]}</option>)}</select></label>
            <label className="space-y-2 text-sm text-slate-300">Start date<input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white outline-none focus:border-accent" /></label>
            <label className="space-y-2 text-sm text-slate-300">End date<input type="date" required min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white outline-none focus:border-accent" /></label>
            <label className="space-y-2 text-sm text-slate-300 md:col-span-2">Reason<input required minLength={5} maxLength={2000} value={leaveReason} onChange={(event) => setLeaveReason(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white outline-none focus:border-accent" /></label>
            <label className="space-y-2 text-sm text-slate-300 md:col-span-2 xl:col-span-3">Additional notes (optional)<input maxLength={2000} value={leaveNotes} onChange={(event) => setLeaveNotes(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white outline-none focus:border-accent" /></label>
            <div className="flex items-end"><Button type="submit" disabled={busy === "leave"}><Send size={14} />{busy === "leave" ? "Submitting…" : "Apply for leave"}</Button></div>
          </form>
          <div className="mt-6 space-y-3">
            {data.leaves.length ? data.leaves.map((leave) => <div key={leave._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"><span className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-violet-200"><CalendarDays size={16} /></span><div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-200">{leaveTypeLabels[leave.leaveType]} · {leave.totalDays} calendar day{leave.totalDays === 1 ? "" : "s"}</p><p className="mt-1 text-xs text-slate-500">{formatUtcDate(leave.startDate)} – {formatUtcDate(leave.endDate)} · {leave.reason}</p>{leave.adminRemarks && <p className="mt-1 text-xs text-slate-400">Admin: {leave.adminRemarks}</p>}</div><span className={`rounded-full px-2.5 py-1 text-xs ${leave.status === "approved" ? "bg-emerald-300/10 text-emerald-200" : leave.status === "rejected" || leave.status === "cancelled" ? "bg-slate-400/10 text-slate-300" : "bg-amber-300/10 text-amber-200"}`}>{leaveStatusLabels[leave.status]}</span>{leave.status === "pending" && <button type="button" disabled={busy === `cancel-${leave._id}`} onClick={() => void cancelLeave(leave._id)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-50"><X size={13} />Cancel</button>}</div>) : <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-500">No leave requests yet.</p>}
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="mb-4 flex items-center gap-2"><Plus size={16} className="text-violet-200" /><h2 className="text-sm font-semibold text-white">Request an attendance correction</h2></div>
          <p className="mb-4 text-xs leading-5 text-slate-500">Requests do not change your recorded sessions. An administrator reviews and records any approved adjustment separately.</p>
          <form onSubmit={(event) => void submitCorrection(event)} className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm text-slate-300">Attendance date<input type="date" required value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white outline-none focus:border-accent" /></label>
            <label className="space-y-2 text-sm text-slate-300 md:col-span-2">Requested change<textarea required minLength={5} maxLength={2000} value={requestedChanges} onChange={(event) => setRequestedChanges(event.target.value)} rows={2} className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-sm text-white outline-none focus:border-accent" /></label>
            <label className="space-y-2 text-sm text-slate-300 md:col-span-2">Reason<textarea required minLength={5} maxLength={2000} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} rows={2} className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-sm text-white outline-none focus:border-accent" /></label>
            <div className="flex items-end"><Button type="submit" disabled={busy === "correction"}>{busy === "correction" ? "Sending…" : "Request correction"}</Button></div>
          </form>
          <div className="mt-5 space-y-2">{data.corrections.length ? data.corrections.map((correction) => <div key={correction._id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-white/[0.05] px-3 py-2.5 text-xs"><span className="text-slate-300">{formatUtcDate(correction.attendanceDate)} · {correction.requestedChanges}<span className="mt-1 block text-slate-500">Reason: {correction.reason}</span>{correction.reviewerRemarks && <span className="mt-1 block text-slate-400">Admin review: {correction.reviewerRemarks}</span>}</span><span className="capitalize text-amber-200">{correction.status.replaceAll("_", " ")}</span></div>) : <p className="text-xs text-slate-500">No correction requests for this month.</p>}</div>
        </DashboardCard>
      </>}
    </>
  );
}
