"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, CalendarDays } from "lucide-react";
import { TaskDiscussion } from "@/components/work/task-discussion";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { Input } from "@/components/ui/input";
import { PageHeading } from "@/components/ui/page-heading";
import { PriorityBadge, TaskStatusBadge } from "@/components/ui/work-badges";
import type { Priority, TaskStatus } from "@/types/work";
import { formatWorkDate } from "@/lib/work/format";

interface EmployeeTaskDetailData {
  _id: string;
  taskId: string;
  title: string;
  description: string;
  project: { _id: string; projectId: string; name: string; description: string; status: string; deadline: string; githubUrl?: string; figmaUrl?: string } | null;
  priority: Priority;
  status: TaskStatus;
  startDate?: string;
  dueDate: string;
  instructions: string;
  acceptanceCriteria: string;
  blockedReason?: string;
  updatedAt: string;
}

interface Submission {
  _id: string;
  deliverableLinks: Array<{ kind: string; url: string }>;
  submissionNotes: string;
  submittedAt: string;
  reviewStatus: string;
  reviewedAt?: string;
  reviewFeedback?: string;
}

interface EmployeeTaskDetailResponse {
  task: EmployeeTaskDetailData;
  submissions: Submission[];
  comments: Array<{ _id: string; message: string; createdAt: string; author: { fullName: string; role?: string; profilePicture?: string } | null }>;
  activity: Array<{ _id: string; action: string; createdAt: string; actor?: { fullName: string } | null }>;
}

export function EmployeeTaskDetail({ id }: { id: string }) {
  const [data, setData] = useState<EmployeeTaskDetailResponse | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/employee/tasks/${id}`, { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load this task.");
      setData(result as EmployeeTaskDetailResponse);
      setError("");
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(loadError instanceof Error ? loadError.message : "Could not load this task.");
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function updateTask(action: "start" | "resume" | "block") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/employee/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "block" ? { action, reason: blockReason } : { action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update task.");
      setBlockReason("");
      await load();
      setNotice(result.warning ?? "");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not update task.");
    } finally {
      setBusy(false);
    }
  }

  async function submitForReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/employee/tasks/${id}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl, previewUrl, figmaUrl, submissionNotes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not submit your work.");
      setNotice(result.warning ?? "");
      setGithubUrl("");
      setPreviewUrl("");
      setFigmaUrl("");
      setSubmissionNotes("");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit your work.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>;
  if (!data) return <DashboardCard><p className="py-12 text-center text-sm text-slate-400">Loading task…</p></DashboardCard>;
  const { task } = data;
  const latestSubmission = data.submissions[0];

  return (
    <>
      <Link href="/employee/tasks" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} /> My tasks</Link>
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-panel p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[11px] text-slate-500">{task.taskId}</span><TaskStatusBadge status={task.status} /><PriorityBadge priority={task.priority} /></div><PageHeading title={task.title} description={task.project?.name ?? "Project unavailable"} /></div>
        <p className="inline-flex shrink-0 items-center gap-2 text-xs text-slate-400"><CalendarDays size={14} />Due {formatWorkDate(task.dueDate)}</p>
      </div>
      {error && <p role="alert" className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
      {notice && <p role="status" className="mb-5 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-4 py-3 text-sm text-amber-200">{notice}</p>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.8fr)]">
        <div className="space-y-5">
          <DashboardCard>
            <h2 className="text-sm font-semibold text-white">Task information</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{task.description || "No description provided."}</p>
            {task.instructions && <div className="mt-5 border-t border-white/[0.06] pt-4"><h3 className="text-xs font-medium text-slate-300">Instructions</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{task.instructions}</p></div>}
            {task.acceptanceCriteria && <div className="mt-5 border-t border-white/[0.06] pt-4"><h3 className="text-xs font-medium text-slate-300">Acceptance criteria</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{task.acceptanceCriteria}</p></div>}
            {task.blockedReason && <div className="mt-5 rounded-xl border border-rose-400/10 bg-rose-400/[0.04] p-3"><h3 className="text-xs font-medium text-rose-200">Blocker reported</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">{task.blockedReason}</p></div>}
            <div className="mt-5 flex flex-wrap gap-3 border-t border-white/[0.06] pt-4">
              {task.project?.githubUrl && <a href={task.project.githubUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-200 hover:text-white">Project GitHub <ArrowUpRight size={13} /></a>}
              {task.project?.figmaUrl && <a href={task.project.figmaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-200 hover:text-white">Project Figma <ArrowUpRight size={13} /></a>}
            </div>
          </DashboardCard>

          {task.status === "to_do" && <DashboardCard><h2 className="text-sm font-semibold text-white">Ready to begin?</h2><p className="mt-1 text-xs text-slate-400">Starting work changes the task status to In Progress.</p><Button className="mt-4" disabled={busy} onClick={() => void updateTask("start")}>{busy ? "Updating…" : "Start work"}</Button></DashboardCard>}
          {task.status === "blocked" && <DashboardCard><h2 className="text-sm font-semibold text-white">Resume work</h2><p className="mt-1 text-xs text-slate-400">When the blocker is resolved, resume the task.</p><Button className="mt-4" disabled={busy} onClick={() => void updateTask("resume")}>{busy ? "Updating…" : "Resume work"}</Button></DashboardCard>}
          {task.status === "in_progress" && <DashboardCard>
            <h2 className="text-sm font-semibold text-white">Update task</h2>
            <div className="mt-4 space-y-4">
              <div className="space-y-2"><label htmlFor={`block-${id}`} className="text-xs font-medium text-slate-300">Report a blocker</label><textarea id={`block-${id}`} minLength={3} maxLength={2000} rows={2} value={blockReason} onChange={(event) => setBlockReason(event.target.value)} placeholder="Describe what is blocking progress…" className="w-full resize-y rounded-xl border border-white/10 bg-sidebar px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-accent" /><Button variant="secondary" size="sm" disabled={busy || blockReason.trim().length < 3} onClick={() => void updateTask("block")}>Report blocker</Button></div>
            </div>
          </DashboardCard>}

          {task.status === "in_progress" && <DashboardCard>
            <h2 className="text-sm font-semibold text-white">Submit work for review</h2><p className="mt-1 text-xs leading-5 text-slate-400">Include at least one deliverable link or a meaningful explanation. File uploads are unavailable until private storage is configured.</p>
            <form onSubmit={submitForReview} className="mt-4 space-y-4">
              <Input label="GitHub pull request URL (optional)" name="githubUrl" type="url" maxLength={2048} value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} />
              <Input label="Live preview URL (optional)" name="previewUrl" type="url" maxLength={2048} value={previewUrl} onChange={(event) => setPreviewUrl(event.target.value)} />
              <Input label="Figma URL (optional)" name="figmaUrl" type="url" maxLength={2048} value={figmaUrl} onChange={(event) => setFigmaUrl(event.target.value)} />
              <label className="block space-y-2 text-sm font-medium text-slate-200">Submission notes <textarea maxLength={4000} rows={3} value={submissionNotes} onChange={(event) => setSubmissionNotes(event.target.value)} placeholder="Explain what you completed, or note any remaining context." className="w-full resize-y rounded-xl border border-white/10 bg-sidebar px-4 py-3 text-sm font-normal text-white outline-none focus:border-accent" /></label>
              <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit for review"}</Button></div>
            </form>
          </DashboardCard>}

          {latestSubmission && <DashboardCard>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Latest submission</h2><p className="mt-1 text-xs text-slate-500">{new Date(latestSubmission.submittedAt).toLocaleString()}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${latestSubmission.reviewStatus === "pending" ? "bg-violet-400/10 text-violet-200" : latestSubmission.reviewStatus === "approved" ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-400/10 text-amber-200"}`}>{latestSubmission.reviewStatus.replaceAll("_", " ")}</span></div>
            <div className="mt-4 space-y-3">{latestSubmission.deliverableLinks.map((link) => <a key={`${link.kind}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-violet-200 hover:text-white">{link.kind}: {link.url}<ArrowUpRight size={14} /></a>)}{latestSubmission.submissionNotes && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{latestSubmission.submissionNotes}</p>}{latestSubmission.reviewFeedback && <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.04] p-3"><p className="text-xs font-medium text-amber-200">Admin feedback</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">{latestSubmission.reviewFeedback}</p></div>}</div>
          </DashboardCard>}
          <TaskDiscussion taskId={id} admin={false} comments={data.comments} onRefresh={() => void load()} />
        </div>
        <div className="space-y-5">
          <DashboardCard><h2 className="text-sm font-semibold text-white">Project</h2>{task.project ? <><Link href={`/employee/projects/${task.project._id}`} className="mt-3 block text-sm font-medium text-violet-200 hover:text-white">{task.project.name}</Link><p className="mt-1 text-xs text-slate-500">{task.project.projectId} · {task.project.status.replaceAll("_", " ")}</p></> : <p className="mt-3 text-sm text-slate-500">Project unavailable.</p>}</DashboardCard>
          <DashboardCard><h2 className="text-sm font-semibold text-white">Task activity</h2><div className="mt-4 space-y-3">{data.activity.length ? data.activity.map((item) => <div key={item._id} className="border-l border-white/10 pl-3"><p className="text-xs text-slate-300">{item.action.replaceAll("_", " ")}</p><p className="mt-1 text-[11px] text-slate-500">{item.actor?.fullName ?? "Team member"} · {new Date(item.createdAt).toLocaleString()}</p></div>) : <p className="text-sm text-slate-500">No recent activity.</p>}</div></DashboardCard>
        </div>
      </div>
    </>
  );
}
