"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, CalendarDays, Pencil, UserRound } from "lucide-react";
import { TaskDiscussion } from "@/components/work/task-discussion";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { PageHeading } from "@/components/ui/page-heading";
import { PriorityBadge, TaskStatusBadge } from "@/components/ui/work-badges";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { EmployeeRole } from "@/types/employee";
import type { Priority, TaskStatus } from "@/types/work";

interface AdminTask {
  _id: string;
  taskId: string;
  title: string;
  description: string;
  project: { _id: string; name: string; projectId: string; status: string } | null;
  assignedTo: { _id: string; fullName: string; role: EmployeeRole; designation?: string; profilePicture?: string; employeeId?: string } | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
  startDate?: string;
  instructions: string;
  acceptanceCriteria: string;
  blockedReason?: string;
  updatedAt: string;
  archivedAt?: string | null;
}

interface Submission {
  _id: string;
  employee?: { fullName: string; role: EmployeeRole } | null;
  deliverableLinks: Array<{ kind: string; url: string }>;
  submissionNotes: string;
  submittedAt: string;
  reviewStatus: string;
  reviewFeedback?: string;
  reviewedAt?: string;
  reviewedBy?: { fullName: string } | null;
}

interface Activity {
  _id: string;
  action: string;
  actor?: { fullName: string } | null;
  previousValue?: unknown;
  newValue?: unknown;
  createdAt: string;
}

interface DetailResponse {
  task: AdminTask;
  submissions: Submission[];
  comments: Array<{ _id: string; message: string; createdAt: string; author: { fullName: string; role?: string; profilePicture?: string } | null }>;
  activity: Activity[];
}

const actionLabels: Record<string, string> = {
  task_created: "Task created",
  employee_assigned: "Employee assigned",
  employee_reassigned: "Employee reassigned",
  status_changed: "Status changed",
  submission_added: "Work submitted",
  task_approved: "Work approved",
  changes_requested: "Changes requested",
  task_archived: "Task archived",
};

function activityValue(value: unknown) {
  if (typeof value !== "string") return "";
  const labels: Record<string, string> = { to_do: "To do", in_progress: "In progress", blocked: "Blocked", in_review: "In review", completed: "Completed" };
  return labels[value] ?? value;
}

export function AdminTaskDetail({ id, initialNotice = "" }: { id: string; initialNotice?: string }) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(initialNotice);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/admin/tasks/${id}`, { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load task.");
      setData(result as DetailResponse);
      setError("");
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(loadError instanceof Error ? loadError.message : "Could not load task.");
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function review(decision: "approve" | "request_changes") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/tasks/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, feedback }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save the review decision.");
      setFeedback("");
      await load();
      setNotice(result.warning ?? "");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not save the review decision.");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!data || !window.confirm(`Archive task "${data.task.title}"?`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/tasks/${id}/archive`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not archive this task.");
      const notice = result.warning ? `&notice=${encodeURIComponent(result.warning)}` : "";
      window.location.assign(`/admin/tasks?archived=true${notice}`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not archive this task.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>;
  if (!data) return <DashboardCard><p className="py-12 text-center text-sm text-slate-400">Loading task…</p></DashboardCard>;
  const { task } = data;
  const currentSubmission = data.submissions.find((submission) => submission.reviewStatus === "pending") ?? data.submissions[0];

  return (
    <>
      <Link href="/admin/tasks" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} /> All tasks</Link>
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-panel p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[11px] text-slate-500">{task.taskId}</span><TaskStatusBadge status={task.status} /><PriorityBadge priority={task.priority} /></div><PageHeading title={task.title} description={task.project?.name ?? "Project unavailable"} /></div>
        <div className="flex shrink-0 flex-wrap gap-2">{!task.archivedAt && <Link href={`/admin/tasks/${id}/edit`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-medium text-slate-200 hover:bg-white/5"><Pencil size={14} /> Edit</Link>}{!task.archivedAt && <Button variant="secondary" size="sm" disabled={busy} onClick={() => void archive()}>Archive</Button>}</div>
      </div>
      {error && <p role="alert" className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
      {notice && <p role="status" className="mb-5 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-4 py-3 text-sm text-amber-200">{notice}</p>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
        <div className="space-y-5">
          <DashboardCard>
            <div className="mb-4 flex items-center gap-2"><h2 className="text-sm font-semibold text-white">Task information</h2></div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{task.description || "No description provided."}</p>
            <div className="mt-5 grid gap-4 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
              <div><p className="text-[11px] text-slate-500">Project</p><p className="mt-1 text-sm text-slate-200">{task.project?.name ?? "Project unavailable"}</p></div>
              <div><p className="text-[11px] text-slate-500">Deadline</p><p className="mt-1 flex items-center gap-2 text-sm text-slate-200"><CalendarDays size={14} className="text-slate-500" />{new Date(task.dueDate).toLocaleDateString()}</p></div>
              {task.startDate && <div><p className="text-[11px] text-slate-500">Start date</p><p className="mt-1 text-sm text-slate-200">{new Date(task.startDate).toLocaleDateString()}</p></div>}
              <div><p className="text-[11px] text-slate-500">Last updated</p><p className="mt-1 text-sm text-slate-200">{new Date(task.updatedAt).toLocaleString()}</p></div>
            </div>
            {(task.instructions || task.acceptanceCriteria || task.blockedReason) && <div className="mt-5 space-y-4 border-t border-white/[0.06] pt-4">{task.instructions && <div><h3 className="text-xs font-medium text-slate-300">Instructions</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{task.instructions}</p></div>}{task.acceptanceCriteria && <div><h3 className="text-xs font-medium text-slate-300">Acceptance criteria</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{task.acceptanceCriteria}</p></div>}{task.blockedReason && <div><h3 className="text-xs font-medium text-rose-200">Blocker reported</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{task.blockedReason}</p></div>}</div>}
          </DashboardCard>

          <DashboardCard>
            <h2 className="text-sm font-semibold text-white">Work submission</h2>
            {currentSubmission ? <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-400">{currentSubmission.employee?.fullName ?? "Employee"} · {new Date(currentSubmission.submittedAt).toLocaleString()}</p><span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${currentSubmission.reviewStatus === "pending" ? "bg-violet-400/10 text-violet-200" : currentSubmission.reviewStatus === "approved" ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-400/10 text-amber-200"}`}>{currentSubmission.reviewStatus.replaceAll("_", " ")}</span></div>
              {currentSubmission.deliverableLinks.map((link) => <a key={`${link.kind}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-violet-200 hover:text-white">{link.kind}: {link.url}<ArrowUpRight size={14} className="shrink-0" /></a>)}
              {currentSubmission.submissionNotes && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{currentSubmission.submissionNotes}</p>}
              {currentSubmission.reviewFeedback && <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.04] p-3"><p className="text-xs font-medium text-amber-200">Review feedback</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">{currentSubmission.reviewFeedback}</p></div>}
              {task.status === "in_review" && !task.archivedAt && <div className="space-y-3 border-t border-white/[0.06] pt-4"><label className="block space-y-2 text-xs font-medium text-slate-300">Feedback (required when requesting changes)<textarea maxLength={4000} rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} className="w-full resize-y rounded-xl border border-white/10 bg-sidebar px-4 py-3 text-sm font-normal text-white outline-none focus:border-accent" /></label><div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={busy || feedback.trim().length < 3} onClick={() => void review("request_changes")}>Request changes</Button><Button disabled={busy} onClick={() => void review("approve")}>Approve work</Button></div></div>}
            </div> : <p className="mt-3 text-sm text-slate-500">No work has been submitted for review.</p>}
          </DashboardCard>

          {!task.archivedAt && <TaskDiscussion taskId={id} admin comments={data.comments} onRefresh={() => void load()} />}
        </div>

        <div className="space-y-5">
          <DashboardCard>
            <h2 className="text-sm font-semibold text-white">Assigned employee</h2>
            {task.assignedTo ? <div className="mt-4 flex items-center gap-3"><UserAvatar name={task.assignedTo.fullName} src={task.assignedTo.profilePicture} className="size-10 text-xs" /><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-200">{task.assignedTo.fullName}</p><p className="mt-1 truncate text-xs text-slate-500">{task.assignedTo.designation || (task.assignedTo.role === "developer" ? "Developer" : "Designer")}</p></div><UserRound size={15} className="ml-auto text-slate-500" /></div> : <p className="mt-3 text-sm text-slate-500">Assignee unavailable.</p>}
          </DashboardCard>
          <DashboardCard>
            <h2 className="text-sm font-semibold text-white">Activity history</h2>
            <div className="mt-4 space-y-4">{data.activity.length ? data.activity.map((item) => <div key={item._id} className="border-l border-white/10 pl-3"><p className="text-xs font-medium text-slate-300">{actionLabels[item.action] ?? "Task updated"}</p><p className="mt-1 text-[11px] text-slate-500">{item.actor?.fullName ?? "Team member"} · {new Date(item.createdAt).toLocaleString()}</p>{item.action === "status_changed" && <p className="mt-1 text-[11px] text-slate-400">{activityValue(item.previousValue)} → {activityValue(item.newValue)}</p>}</div>) : <p className="text-sm text-slate-500">No activity recorded.</p>}</div>
          </DashboardCard>
        </div>
      </div>
    </>
  );
}
