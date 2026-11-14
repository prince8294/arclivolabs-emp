"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Eye, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { PriorityBadge, TaskStatusBadge } from "@/components/ui/work-badges";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { EmployeeRole } from "@/types/employee";
import { taskStatuses, type Priority, type TaskStatus } from "@/types/work";
import { formatWorkDate } from "@/lib/work/format";

interface TaskRow {
  _id: string;
  taskId: string;
  title: string;
  project: { _id: string; name: string; projectId: string } | null;
  assignedTo: { _id: string; fullName: string; role: EmployeeRole; profilePicture?: string } | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
}

interface TaskResponse {
  tasks: TaskRow[];
  pagination: { page: number; pages: number; total: number };
  stats: { pendingReviews: number; overdueTasks: number };
}

export function TaskList({ initialStatus = "", initialNotice = "" }: { initialStatus?: string; initialNotice?: string }) {
  const [data, setData] = useState<TaskResponse | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>(
    taskStatuses.includes(initialStatus as TaskStatus) ? initialStatus as TaskStatus : "",
  );
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ q: query, status, archived: String(archived), page: String(page), limit: "10" });
    try {
      const response = await fetch(`/api/admin/tasks?${params}`, { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load tasks.");
      setData(result as TaskResponse);
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
        setError(loadError instanceof Error ? loadError.message : "Could not load tasks.");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [archived, page, query, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  function setFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <PageHeading title="Task management" description="Assign, review, and track work across your projects." />
        <Link href="/admin/tasks/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:bg-violet-500"><Plus size={16} /> Create task</Link>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/tasks?status=in_review" className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.05] p-4 transition hover:bg-violet-400/[0.08]">
          <p className="text-xs text-violet-200">Awaiting review</p><p className="mt-2 text-2xl font-semibold text-white">{data?.stats.pendingReviews ?? "—"}</p>
        </Link>
        <DashboardCard className="p-4"><p className="text-xs text-rose-200">Overdue tasks</p><p className="mt-2 text-2xl font-semibold text-white">{data?.stats.overdueTasks ?? "—"}</p></DashboardCard>
      </div>
      <DashboardCard className="mb-5 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_200px_180px]">
          <label className="relative block"><span className="sr-only">Search tasks</span><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setFilter(setQuery, event.target.value)} placeholder="Search task title" className="h-11 w-full rounded-xl border border-white/10 bg-sidebar pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-accent" /></label>
          <select aria-label="Filter by task status" value={status} onChange={(event) => setFilter(setStatus, event.target.value)} className="h-11 rounded-xl border border-white/10 bg-sidebar px-3 text-sm text-slate-200 outline-none focus:border-accent">
            <option value="">All statuses</option><option value="to_do">To do</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="in_review">In review</option><option value="completed">Completed</option>
          </select>
          <select aria-label="Task archive view" value={String(archived)} onChange={(event) => { setArchived(event.target.value === "true"); setPage(1); }} className="h-11 rounded-xl border border-white/10 bg-sidebar px-3 text-sm text-slate-200 outline-none focus:border-accent">
            <option value="false">Current tasks</option><option value="true">Archived tasks</option>
          </select>
        </div>
      </DashboardCard>
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
      {initialNotice && <p role="status" className="mb-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-4 py-3 text-sm text-amber-200">{initialNotice}</p>}
      {loading && !data ? <DashboardCard><p className="py-12 text-center text-sm text-slate-400">Loading tasks…</p></DashboardCard> :
        data?.tasks.length ? (
          <>
            <DashboardCard className="hidden overflow-hidden p-0 md:block">
              <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left">
                <thead className="border-b border-white/6 bg-white/[0.02]"><tr>{["Task", "Project", "Assignee", "Priority", "Due date", "Status", "View"].map((head) => <th key={head} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{head}</th>)}</tr></thead>
                <tbody className="divide-y divide-white/5">{data.tasks.map((task) => (
                  <tr key={task._id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-4"><Link href={`/admin/tasks/${task._id}`} className="text-sm font-medium text-slate-100 hover:text-violet-200">{task.title}</Link><p className="mt-1 font-mono text-[10px] text-slate-500">{task.taskId}</p></td>
                    <td className="px-5 py-4 text-sm text-slate-300">{task.project?.name ?? "Project unavailable"}</td>
                    <td className="px-5 py-4">{task.assignedTo && <div className="flex items-center gap-2"><UserAvatar name={task.assignedTo.fullName} src={task.assignedTo.profilePicture} className="size-8 text-[10px]" /><span className="text-xs text-slate-300">{task.assignedTo.fullName}</span></div>}</td>
                    <td className="px-5 py-4"><PriorityBadge priority={task.priority} /></td>
                    <td className="px-5 py-4 text-xs text-slate-400">{formatWorkDate(task.dueDate)}</td>
                    <td className="px-5 py-4"><TaskStatusBadge status={task.status} /></td>
                    <td className="px-5 py-4"><Link aria-label={`View ${task.title}`} href={`/admin/tasks/${task._id}`} className="inline-flex rounded-lg p-2 text-slate-400 hover:bg-white/6 hover:text-white"><Eye size={16} /></Link></td>
                  </tr>
                ))}</tbody>
              </table></div>
            </DashboardCard>
            <div className="space-y-3 md:hidden">{data.tasks.map((task) => (
              <DashboardCard key={task._id} className="p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{task.title}</p><p className="mt-1 truncate text-xs text-slate-400">{task.project?.name ?? "Project unavailable"}</p></div><TaskStatusBadge status={task.status} /></div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-3"><PriorityBadge priority={task.priority} /><span className="text-xs text-slate-400">Due {formatWorkDate(task.dueDate)}</span><Link href={`/admin/tasks/${task._id}`} className="text-xs font-medium text-violet-200">View details</Link></div>
              </DashboardCard>
            ))}</div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{data.pagination.total} task{data.pagination.total === 1 ? "" : "s"}</span><div className="flex items-center gap-2"><Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>{page} / {Math.max(1, data.pagination.pages)}</span><Button variant="secondary" size="sm" disabled={page >= data.pagination.pages || loading} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
          </>
        ) : <EmptyState title={query || status ? "No matching tasks" : archived ? "No archived tasks" : "No tasks yet"} description={query || status ? "Try changing the search or status filter." : "Create a task to assign work to a project team member."} icon={ClipboardList} />}
    </>
  );
}
