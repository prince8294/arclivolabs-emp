"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, Clock3, Eye } from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { PriorityBadge, TaskStatusBadge } from "@/components/ui/work-badges";
import type { Priority, TaskStatus } from "@/types/work";
import { formatWorkDate, isWorkDateOverdue } from "@/lib/work/format";

interface EmployeeTask {
  _id: string;
  taskId: string;
  title: string;
  project?: { _id: string; name: string; projectId: string; status: string } | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
  updatedAt: string;
}

interface EmployeeTaskResponse {
  tasks: EmployeeTask[];
  stats: { totalAssigned: number; inProgress: number; inReview: number; completed: number; overdue: number };
}

export function EmployeeTaskList() {
  const [data, setData] = useState<EmployeeTaskResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/employee/tasks", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load your tasks.");
        setData(result as EmployeeTaskResponse);
      })
      .catch((loadError: unknown) => {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(loadError instanceof Error ? loadError.message : "Could not load your tasks.");
      });
    return () => controller.abort();
  }, []);

  const statistics = [
    ["Total assigned", data?.stats.totalAssigned],
    ["In progress", data?.stats.inProgress],
    ["In review", data?.stats.inReview],
    ["Completed", data?.stats.completed],
  ] as const;

  return (
    <>
      <PageHeading title="My tasks" description="Your assigned work and current deadlines." />
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">{statistics.map(([label, count]) => <DashboardCard key={label} className="p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{count ?? "—"}</p></DashboardCard>)}</div>
      {data && data.stats.overdue > 0 && <p className="mb-4 rounded-xl border border-rose-400/15 bg-rose-400/[0.05] px-4 py-3 text-xs text-rose-200">{data.stats.overdue} task{data.stats.overdue === 1 ? " is" : "s are"} past its deadline and not completed.</p>}
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
      {!data && !error ? <DashboardCard><p className="py-12 text-center text-sm text-slate-400">Loading your tasks…</p></DashboardCard> :
        data?.tasks.length ? <div className="grid gap-3 xl:grid-cols-2">{data.tasks.map((task) => {
          const overdue = task.status !== "completed" && isWorkDateOverdue(task.dueDate);
          return <Link key={task._id} href={`/employee/tasks/${task._id}`} className="rounded-2xl border border-white/[0.06] bg-panel p-4 transition hover:border-white/10 hover:bg-white/[0.035] sm:p-5">
            <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-violet-200"><ClipboardList size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{task.title}</h2><TaskStatusBadge status={task.status} /></div><p className="mt-1 truncate text-xs text-slate-400">{task.project?.name ?? "Project unavailable"}</p></div><Eye size={15} className="mt-1 shrink-0 text-slate-500" /></div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-3"><PriorityBadge priority={task.priority} /><span className={`inline-flex items-center gap-1.5 text-xs ${overdue ? "text-rose-200" : "text-slate-400"}`}><CalendarDays size={13} />{overdue ? "Overdue · " : "Due "}{formatWorkDate(task.dueDate)}</span><span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"><Clock3 size={12} />Updated {new Date(task.updatedAt).toLocaleDateString()}</span></div>
          </Link>;
        })}</div> : <EmptyState title="No tasks assigned" description="When an administrator assigns work to you, it will appear here." icon={ClipboardList} />}
    </>
  );
}
