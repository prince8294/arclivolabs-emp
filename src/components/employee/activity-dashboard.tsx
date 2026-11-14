"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, CalendarClock, CheckCircle2, Clock3, Coffee, Play, RefreshCw, Square, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { PageHeading } from "@/components/ui/page-heading";
import { formatDuration } from "@/lib/activity/time";
import { activityWorkStatusLabels, type ActivityWorkStatus, type WorkSessionStatus } from "@/types/activity";

interface ActivityTask {
  _id: string;
  title: string;
  taskId?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
  project?: { name?: string; projectId?: string } | null;
}

interface ActivitySession {
  _id: string;
  startedAt: string;
  endedAt?: string | null;
  status: WorkSessionStatus;
  recordedWorkDurationMs: number;
  durationMs: number;
  lastResumedAt?: string | null;
  nextCheckInDueAt?: string | null;
  currentBreakStartedAt?: string | null;
  checkInCount: number;
  task?: ActivityTask | null;
  project?: { name?: string; projectId?: string } | null;
}

interface ActivityCheckIn {
  _id: string;
  task: string;
  scheduledAt: string;
  recordStatus: "pending" | "submitted" | "missed";
}

interface DailyReport {
  _id: string;
  status: "draft" | "submitted";
  reportDate: string;
  completedWork: string;
  pendingWork: string;
  blockers: string;
  notes: string;
  session?: { startedAt?: string; task?: ActivityTask | null; project?: { name?: string } | null } | null;
}

interface ActivitySnapshot {
  serverNow: string;
  settings: { checkInIntervalMinutes: number; checkInsEnabled: boolean; dailyReportRequired: boolean };
  availableTasks: ActivityTask[];
  canStartWork: boolean;
  activeSession: ActivitySession | null;
  pendingCheckIns: ActivityCheckIn[];
  draftReports: DailyReport[];
  sessions: ActivitySession[];
  summary: { todayWorkDurationMs: number; todayBreakDurationMs: number; completedSessions: number; pendingCheckIns: number };
}

interface ReportForm {
  completedWork: string;
  pendingWork: string;
  blockers: string;
  notes: string;
}

const blankReport: ReportForm = { completedWork: "", pendingWork: "", blockers: "", notes: "" };

function formatTime(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
}

async function responseJson(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "The activity request could not be completed.");
  return result;
}

export function EmployeeActivityDashboard() {
  const [snapshot, setSnapshot] = useState<ActivitySnapshot | null>(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [selectedTask, setSelectedTask] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checkInStatus, setCheckInStatus] = useState<ActivityWorkStatus>("working");
  const [progressUpdate, setProgressUpdate] = useState("");
  const [reportId, setReportId] = useState("");
  const [reportForm, setReportForm] = useState<ReportForm>(blankReport);
  const [dismissedCheckInId, setDismissedCheckInId] = useState("");

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const result = await responseJson(await fetch("/api/employee/activity", { cache: "no-store", signal }));
    setSnapshot(result);
    setServerOffset(new Date(result.serverNow).getTime() - Date.now());
    setError("");
    setSelectedTask((current) => current || result.availableTasks[0]?._id || "");
    setReportId((current) => current || result.draftReports[0]?._id || "");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal).catch((loadError: unknown) => {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
        setError(loadError instanceof Error ? loadError.message : "Could not load activity.");
      }
    });
    const ticker = window.setInterval(() => setNow(Date.now()), 1000);
    const reportRefreshError = (refreshError: unknown) => {
      if (!(refreshError instanceof DOMException && refreshError.name === "AbortError")) {
        setError(refreshError instanceof Error ? refreshError.message : "Activity could not be refreshed. Your last saved session remains available.");
      }
    };
    const poller = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh().catch(reportRefreshError);
    }, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh().catch(reportRefreshError);
    };
    window.addEventListener("online", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(ticker);
      window.clearInterval(poller);
      window.removeEventListener("online", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const pendingCheckIn = useMemo(
    () => snapshot?.pendingCheckIns.find((item) => item._id !== dismissedCheckInId) ?? null,
    [snapshot?.pendingCheckIns, dismissedCheckInId],
  );
  const activeSession = snapshot?.activeSession ?? null;
  const currentDuration = activeSession
    ? activeSession.durationMs + (activeSession.status === "working"
      ? Math.max(0, now + serverOffset - new Date(snapshot?.serverNow ?? now).getTime())
      : 0)
    : 0;
  const currentReport = snapshot?.draftReports.find((report) => report._id === reportId) ?? null;
  const selectedCheckInTask = pendingCheckIn
    ? activeSession?.task?.title ?? "Current assigned task"
    : "";

  async function startWork() {
    if (!selectedTask) {
      setError("Choose one of your available tasks before starting work.");
      return;
    }
    setBusy("start");
    setError("");
    setNotice("");
    try {
      const result = await responseJson(await fetch("/api/employee/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: selectedTask }),
      }));
      setNotice(result.warning ?? "Work session started. Recorded time is based on server timestamps.");
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not start work.");
    } finally {
      setBusy("");
    }
  }

  async function transition(action: "break" | "resume" | "end") {
    if (!activeSession) return;
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const result = await responseJson(await fetch(`/api/employee/activity/sessions/${activeSession._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }));
      if (action === "end" && result.report) {
        setReportId(result.report._id);
        setReportForm({
          completedWork: result.report.completedWork ?? "",
          pendingWork: result.report.pendingWork ?? "",
          blockers: result.report.blockers ?? "",
          notes: result.report.notes ?? "",
        });
        setNotice(result.warning ?? "Session ended. Complete the daily work report when ready.");
      } else {
        setNotice(action === "break" ? "Break recorded." : "Work session resumed.");
      }
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update the work session.");
    } finally {
      setBusy("");
    }
  }

  async function submitCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingCheckIn) return;
    setBusy("check-in");
    setError("");
    try {
      await responseJson(await fetch(`/api/employee/activity/check-ins/${pendingCheckIn._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workStatus: checkInStatus, progressUpdate }),
      }));
      setProgressUpdate("");
      setDismissedCheckInId("");
      setNotice("Your activity update was saved.");
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not submit the activity update.");
    } finally {
      setBusy("");
    }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentReport) return;
    setBusy("report");
    setError("");
    try {
      await responseJson(await fetch(`/api/employee/activity/reports/${currentReport._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportForm),
      }));
      setNotice("Daily work report submitted.");
      await refresh();
      setReportId("");
      setReportForm(blankReport);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not submit the daily report.");
    } finally {
      setBusy("");
    }
  }

  function chooseDraft(report: DailyReport) {
    setReportId(report._id);
    setReportForm({
      completedWork: report.completedWork ?? "",
      pendingWork: report.pendingWork ?? "",
      blockers: report.blockers ?? "",
      notes: report.notes ?? "",
    });
  }

  return (
    <>
      <PageHeading
        title="Work activity"
        description="Record work sessions and breaks. Timestamps display in your browser's local timezone; day summaries use UTC. An open session does not verify that you are continuously active."
      />
      {error && <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"><AlertCircle className="mt-0.5 shrink-0" size={16} />{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200">{notice}</p>}
      {!snapshot ? (
        <DashboardCard><p className="text-sm text-slate-400">Loading activity records…</p></DashboardCard>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
                      { label: "Today's recorded work (UTC)", value: formatDuration(snapshot.summary.todayWorkDurationMs), icon: Clock3 },
                      { label: "Today's recorded breaks (UTC)", value: formatDuration(snapshot.summary.todayBreakDurationMs), icon: Coffee },
              { label: "Completed sessions", value: String(snapshot.summary.completedSessions), icon: CheckCircle2 },
              { label: "Pending check-ins", value: String(snapshot.summary.pendingCheckIns), icon: CalendarClock },
            ].map(({ label, value, icon: Icon }) => (
              <DashboardCard key={label} className="p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-slate-400">{label}</p><Icon size={17} className="text-violet-200" /></div>
                <p className="mt-4 text-xl font-semibold text-white sm:text-2xl">{value}</p>
              </DashboardCard>
            ))}
          </div>

          <DashboardCard className="mb-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Active session</p>
                {activeSession ? (
                  <>
                    <h2 className="mt-2 truncate text-lg font-semibold text-white">{activeSession.task?.title ?? "Assigned task"}</h2>
                    <p className="mt-1 truncate text-sm text-slate-400">{activeSession.project?.name ?? activeSession.task?.project?.name ?? "Project unavailable"}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>{activeSession.status === "on_break" ? "On recorded break" : "Working session open"}</span>
                      <span>Started {formatTime(activeSession.startedAt)}</span>
                      {activeSession.status === "on_break" && activeSession.currentBreakStartedAt && <span>Break started {formatTime(activeSession.currentBreakStartedAt)}</span>}
                    </div>
                  </>
                ) : <><h2 className="mt-2 text-lg font-semibold text-white">No open work session</h2><p className="mt-1 text-sm text-slate-400">Start a session for one of your assigned tasks.</p></>}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {activeSession ? (
                  <>
                    <div className="rounded-xl border border-white/[0.06] bg-[#111827] px-4 py-2.5 text-center">
                      <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">Recorded work time</span>
                      <span className="mt-1 block font-mono text-xl font-semibold tabular-nums text-white">{formatDuration(currentDuration)}</span>
                    </div>
                    {activeSession.status === "working"
                      ? <Button variant="secondary" disabled={Boolean(busy)} onClick={() => void transition("break")}><Coffee size={15} />{busy === "break" ? "Saving…" : "Take break"}</Button>
                      : <Button variant="secondary" disabled={Boolean(busy)} onClick={() => void transition("resume")}><Play size={15} />{busy === "resume" ? "Resuming…" : "Resume work"}</Button>}
                    <Button disabled={Boolean(busy)} onClick={() => void transition("end")}><Square size={14} />{busy === "end" ? "Ending…" : "End work"}</Button>
                  </>
                ) : (
                  <>
                    <select aria-label="Assigned task" value={selectedTask} onChange={(event) => setSelectedTask(event.target.value)} className="h-11 min-w-56 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white outline-none focus:border-accent">
                      <option value="">Select an assigned task</option>
                      {snapshot.availableTasks.map((task) => <option key={task._id} value={task._id}>{task.title}</option>)}
                    </select>
                    <Button disabled={Boolean(busy) || !selectedTask || !snapshot.canStartWork} onClick={() => void startWork()}><Play size={15} />{busy === "start" ? "Starting…" : "Start work"}</Button>
                  </>
                )}
              </div>
            </div>
            {!activeSession && snapshot.availableTasks.length === 0 && <p className="mt-4 border-t border-white/[0.06] pt-4 text-xs text-slate-500">No active assigned tasks are available to start. Contact your administrator if you need an assignment.</p>}
            {!activeSession && !snapshot.canStartWork && <p className="mt-4 border-t border-white/[0.06] pt-4 text-xs text-amber-200">Submit a pending daily work report before starting another session.</p>}
            {activeSession && activeSession.nextCheckInDueAt && snapshot.settings.checkInsEnabled && (
              <p className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-4 text-xs text-slate-500"><CalendarClock size={14} />Next check-in due {formatTime(activeSession.nextCheckInDueAt)} local time. If this tab is closed or suspended, an overdue check-in appears when you return.</p>
            )}
          </DashboardCard>

          {currentReport && (
            <DashboardCard className="mb-5 border-violet-300/15">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div><h2 className="text-sm font-semibold text-white">Daily work report</h2><p className="mt-1 text-xs text-slate-500">Session started {formatDateTime(currentReport.session?.startedAt)} · Draft saved with this session</p></div>
                <button type="button" aria-label="Close report form" onClick={() => setReportId("")} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"><X size={16} /></button>
              </div>
              <form onSubmit={(event) => void submitReport(event)} className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300 md:col-span-2">What did you complete today? <span className="text-rose-300">*</span>
                  <textarea required minLength={10} maxLength={4000} value={reportForm.completedWork} onChange={(event) => setReportForm((current) => ({ ...current, completedWork: event.target.value }))} rows={3} className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-sm text-white outline-none focus:border-accent" />
                </label>
                <label className="space-y-2 text-sm text-slate-300">What work is still pending?
                  <textarea maxLength={4000} value={reportForm.pendingWork} onChange={(event) => setReportForm((current) => ({ ...current, pendingWork: event.target.value }))} rows={3} className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-sm text-white outline-none focus:border-accent" />
                </label>
                <label className="space-y-2 text-sm text-slate-300">Are you facing any blockers?
                  <textarea maxLength={3000} value={reportForm.blockers} onChange={(event) => setReportForm((current) => ({ ...current, blockers: event.target.value }))} rows={3} className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-sm text-white outline-none focus:border-accent" />
                </label>
                <label className="space-y-2 text-sm text-slate-300 md:col-span-2">Additional notes (optional)
                  <textarea maxLength={3000} value={reportForm.notes} onChange={(event) => setReportForm((current) => ({ ...current, notes: event.target.value }))} rows={2} className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-sm text-white outline-none focus:border-accent" />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
                  <p className="text-xs text-slate-500">Closing this form keeps the report draft available below. Recorded time is saved independently.</p>
                  <Button type="submit" disabled={busy === "report"}>{busy === "report" ? "Submitting…" : "Submit daily report"}</Button>
                </div>
              </form>
            </DashboardCard>
          )}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
            <DashboardCard className="p-0">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sm:px-6"><div><h2 className="text-sm font-semibold text-white">Activity history</h2><p className="mt-1 text-xs text-slate-500">Your recorded work sessions and check-in totals</p></div><button type="button" onClick={() => void refresh().catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not refresh activity."))} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white" aria-label="Refresh activity"><RefreshCw size={15} /></button></div>
              {snapshot.sessions.length ? <div className="divide-y divide-white/[0.05]">
                {snapshot.sessions.map((session) => <div key={session._id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-violet-200"><Timer size={16} /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{session.task?.title ?? "Task unavailable"}</p><p className="mt-1 truncate text-xs text-slate-500">{formatDateTime(session.startedAt)} · {session.project?.name ?? session.task?.project?.name ?? "Project unavailable"}</p></div>
                  <div className="text-right"><p className="font-mono text-sm tabular-nums text-white">{formatDuration(session.durationMs)}</p><p className="mt-1 text-[11px] text-slate-500">{session.endedAt ? `Ended ${formatTime(session.endedAt)}` : session.status === "on_break" ? "On break" : "Session open"}</p></div>
                  <span className="w-16 text-right text-xs text-slate-500">{session.checkInCount} check-ins</span>
                </div>)}
              </div> : <div className="px-6 py-10 text-center"><p className="text-sm text-slate-300">No recorded sessions yet</p><p className="mt-1 text-xs text-slate-500">Your work history will appear here after you start a session.</p></div>}
            </DashboardCard>

            <div className="space-y-5">
              <DashboardCard>
                <h2 className="text-sm font-semibold text-white">Daily reports to complete</h2>
                <p className="mt-1 text-xs text-slate-500">Unfinished reports remain saved as drafts.</p>
                <div className="mt-4 space-y-2">
                  {snapshot.draftReports.length ? snapshot.draftReports.map((report) => <button key={report._id} type="button" onClick={() => chooseDraft(report)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${report._id === reportId ? "border-accent/50 bg-accent/10" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}><CalendarClock size={16} className="shrink-0 text-violet-200" /><span className="min-w-0 flex-1"><span className="block truncate text-sm text-slate-200">{report.session?.task?.title ?? "Work session report"}</span><span className="mt-1 block text-xs text-slate-500">{formatDateTime(report.session?.startedAt)}</span></span><span className="text-xs text-violet-200">{report._id === reportId ? "Open" : "Complete"}</span></button>) : <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-xs text-slate-500">No pending report drafts.</p>}
                </div>
              </DashboardCard>
              <DashboardCard>
                <h2 className="text-sm font-semibold text-white">Recording notice</h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">This portal stores your selected task, session and break timestamps, check-in updates, and daily reports. It does not capture screenshots, keystrokes, webcam video, or prove ongoing activity when a session is open.</p>
              </DashboardCard>
            </div>
          </div>
        </>
      )}

      {pendingCheckIn && activeSession?.status === "working" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="checkin-heading" className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111827] p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-violet-200">Work Activity Check-in</p><h2 id="checkin-heading" className="mt-2 text-xl font-semibold text-white">What are you currently working on?</h2><p className="mt-2 text-sm text-slate-400">{selectedCheckInTask} · Due {formatTime(pendingCheckIn.scheduledAt)}</p></div><button type="button" aria-label="Remind me later" onClick={() => setDismissedCheckInId(pendingCheckIn._id)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"><X size={17} /></button></div>
            <form onSubmit={(event) => void submitCheckIn(event)} className="mt-6 space-y-4">
              <label className="block space-y-2 text-sm text-slate-300">Work status
                <select value={checkInStatus} onChange={(event) => setCheckInStatus(event.target.value as ActivityWorkStatus)} className="h-11 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-sm text-white outline-none focus:border-accent">{Object.entries(activityWorkStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
              <label className="block space-y-2 text-sm text-slate-300">Progress update <span className="text-rose-300">*</span>
                <textarea required minLength={5} maxLength={3000} value={progressUpdate} onChange={(event) => setProgressUpdate(event.target.value)} rows={4} placeholder="Share a brief update. If blocked, describe the issue so it can be addressed." className="w-full rounded-xl border border-white/10 bg-[#0B0F19] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-accent" />
              </label>
              <div className="flex items-center justify-between gap-3 pt-1"><p className="flex items-center gap-1.5 text-xs text-slate-500"><AlertCircle size={13} />Blockers are a normal work status.</p><Button type="submit" disabled={busy === "check-in"}>{busy === "check-in" ? "Submitting…" : "Submit update"}</Button></div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
