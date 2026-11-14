"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CalendarClock, Coffee, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { PageHeading } from "@/components/ui/page-heading";
import { RoleBadge } from "@/components/ui/role-badge";
import { formatDuration } from "@/lib/activity/time";

interface EmployeeDetail {
  employee: { _id: string; employeeId: string; fullName: string; email: string; role: "developer" | "designer"; designation?: string; status: string };
  sessions: Array<{
    _id: string;
    startedAt: string;
    endedAt?: string | null;
    status: string;
    recordedWorkDurationMs: number;
    durationMs: number;
    totalBreakDurationMs: number;
    activeEmployeeId?: string;
    task?: { _id?: string; title: string; taskId?: string; status?: string } | null;
    project?: { _id?: string; name: string; projectId?: string } | null;
  }>;
  breaks: Array<{ _id: string; session: string; startedAt: string; endedAt?: string | null; durationMs?: number; currentDurationMs: number }>;
  checkIns: Array<{ _id: string; session: string; task?: { title: string } | null; scheduledAt: string; submittedAt?: string; workStatus?: string; progressUpdate: string; recordStatus: string }>;
  reports: Array<{ _id: string; session: { startedAt?: string; task?: { title: string } | null } | null; reportDate: string; status: string; completedWork: string; pendingWork: string; blockers: string; notes: string; submittedAt?: string }>;
  corrections: Array<{ _id: string; session: string; reason: string; previousStatus: string; correctedEndAt: string; createdAt: string; reviewedBy?: { fullName: string } | null }>;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function localDateTimeInputValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

async function responseJson(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not load employee activity.");
  return result;
}

export function EmployeeActivityDetail({ employeeId }: { employeeId: string }) {
  const [data, setData] = useState<EmployeeDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await responseJson(await fetch(`/api/admin/activity/${employeeId}`, { cache: "no-store" })));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load employee activity.");
    }
  }, [employeeId]);

  useEffect(() => { void load(); }, [load]);

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await responseJson(await fetch(`/api/admin/activity/sessions/${sessionId}/correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endedAt: new Date(endedAt).toISOString(), reason }),
      }));
      setNotice(result.warning ?? "Open session corrected and the correction was audited.");
      setSessionId("");
      setEndedAt("");
      setReason("");
      await load();
    } catch (correctionError) {
      setError(correctionError instanceof Error ? correctionError.message : "Could not correct the work session.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-5"><Link href="/admin/activity" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} />Activity overview</Link></div>
      {error && <p role="alert" className="mb-4 flex gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"><AlertCircle size={16} className="shrink-0" />{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200">{notice}</p>}
      {!data ? <DashboardCard><p className="text-sm text-slate-400">Loading employee activity…</p></DashboardCard> : <>
        <PageHeading title={data.employee.fullName} description={`${data.employee.employeeId} · ${data.employee.designation || data.employee.email}`} />
        <DashboardCard className="mb-5 flex flex-wrap items-center gap-4">
          <span className="flex size-11 items-center justify-center rounded-xl bg-accent/10 text-violet-200"><UserRound size={18} /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">{data.employee.fullName}</p><p className="mt-1 text-xs text-slate-500">{data.employee.email} · {data.employee.status}</p></div>
          <RoleBadge role={data.employee.role} />
          <span className="text-xs text-slate-500">Recorded history only — not an online or productivity indicator</span>
        </DashboardCard>
        <div className="grid gap-5 xl:grid-cols-2">
          <DashboardCard>
            <h2 className="text-sm font-semibold text-white">Work sessions</h2>
            <div className="mt-4 space-y-3">
              {data.sessions.length ? data.sessions.map((session) => <div key={session._id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-start gap-3"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-200">{session.task?._id ? <Link href={`/admin/tasks/${session.task._id}`} className="hover:text-violet-200">{session.task.title}</Link> : session.task?.title ?? "Task unavailable"}</span><span className="mt-1 block truncate text-xs text-slate-500">{session.project?._id ? <Link href={`/admin/projects/${session.project._id}`} className="hover:text-violet-200">{session.project.name}</Link> : session.project?.name ?? "Project unavailable"} · Started {formatDate(session.startedAt)}</span></span><span className="text-right"><span className="block text-xs font-medium text-slate-300">{session.status === "working" ? "Working session open" : session.status === "on_break" ? "On break" : "Session ended"}</span><span className="mt-1 block font-mono text-xs text-white">{formatDuration(session.durationMs)}</span></span></div>
                {session.status !== "ended" && <button type="button" onClick={() => { setSessionId(session._id); setEndedAt(localDateTimeInputValue(new Date())); }} className="mt-3 text-xs font-medium text-amber-200 hover:text-amber-100">Admin-reviewed correction</button>}
              </div>) : <p className="text-sm text-slate-500">No work sessions recorded.</p>}
            </div>
          </DashboardCard>
          <DashboardCard>
            <h2 className="text-sm font-semibold text-white">Break history</h2>
            <div className="mt-4 space-y-3">{data.breaks.length ? data.breaks.map((item) => <div key={item._id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><Coffee size={16} className="text-amber-200" /><span className="min-w-0 flex-1 text-xs text-slate-300">{formatDate(item.startedAt)} – {formatDate(item.endedAt)}</span><span className="font-mono text-xs text-slate-400">{formatDuration(item.currentDurationMs)}{item.endedAt ? "" : " · open"}</span></div>) : <p className="text-sm text-slate-500">No break records.</p>}</div>
          </DashboardCard>
          <DashboardCard>
            <h2 className="text-sm font-semibold text-white">Check-in history</h2>
            <div className="mt-4 space-y-3">{data.checkIns.length ? data.checkIns.map((item) => <article key={item._id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium text-slate-200">{item.task?.title ?? "Assigned task"} · {item.recordStatus}</p><time className="text-xs text-slate-500">{formatDate(item.submittedAt ?? item.scheduledAt)}</time></div>{item.progressUpdate && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-400">{item.progressUpdate}</p>}</article>) : <p className="text-sm text-slate-500">No activity check-ins.</p>}</div>
          </DashboardCard>
          <DashboardCard>
            <h2 className="text-sm font-semibold text-white">Daily work reports</h2>
            <div className="mt-4 space-y-3">{data.reports.length ? data.reports.map((report) => <article key={report._id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-slate-200">{report.session?.task?.title ?? "Work session report"}</p><span className="text-xs capitalize text-violet-200">{report.status}</span></div><p className="mt-1 text-xs text-slate-500">{formatDate(report.session?.startedAt ?? report.reportDate)}</p><p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-400">{report.completedWork || "Draft report not completed."}</p>{report.pendingWork && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-500">Pending: {report.pendingWork}</p>}{report.blockers && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-amber-200">Blockers: {report.blockers}</p>}</article>) : <p className="text-sm text-slate-500">No daily reports.</p>}</div>
          </DashboardCard>
        </div>
        <DashboardCard className="mt-5">
          <h2 className="text-sm font-semibold text-white">Session correction audit</h2>
          <div className="mt-4 space-y-3">{data.corrections.length ? data.corrections.map((correction) => <div key={correction._id} className="flex flex-wrap items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"><CalendarClock size={16} className="mt-0.5 text-amber-200" /><div className="min-w-0 flex-1"><p className="text-sm text-slate-200">Ended at {formatDate(correction.correctedEndAt)}</p><p className="mt-1 text-xs leading-5 text-slate-400">{correction.reason}</p></div><span className="text-xs text-slate-500">Reviewed by {correction.reviewedBy?.fullName ?? "Admin"} · {formatDate(correction.createdAt)}</span></div>) : <p className="text-sm text-slate-500">No admin corrections recorded.</p>}</div>
        </DashboardCard>
        {sessionId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><section role="dialog" aria-modal="true" aria-labelledby="correction-title" className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111827] p-5 shadow-2xl sm:p-7"><div className="mb-5 flex items-start justify-between"><div><h2 id="correction-title" className="text-lg font-semibold text-white">Correct open session</h2><p className="mt-1 text-xs text-slate-500">The employee's session will be ended and this action audited.</p></div><button type="button" onClick={() => setSessionId("")} className="text-sm text-slate-500 hover:text-white">Close</button></div><form onSubmit={(event) => void submitCorrection(event)} className="space-y-4"><label className="block space-y-2 text-sm text-slate-300">Corrected end time<input type="datetime-local" required value={endedAt} onChange={(event) => setEndedAt(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-sm text-white outline-none focus:border-accent" /></label><label className="block space-y-2 text-sm text-slate-300">Reason<textarea required minLength={5} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="w-full rounded-xl border border-white/10 bg-[#0B0F19] px-3 py-2.5 text-sm text-white outline-none focus:border-accent" /></label><div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Apply correction"}</Button></div></form></section></div>}
      </>}
    </>
  );
}
