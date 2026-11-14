"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, CalendarDays, ClipboardList } from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { PriorityBadge, ProgressBar, ProjectStatusBadge, TaskStatusBadge } from "@/components/ui/work-badges";
import type { Priority, ProjectStatus, ProjectType, TaskStatus } from "@/types/work";
import { formatWorkDate } from "@/lib/work/format";

interface EmployeeProjectDetailData {
  _id: string;
  projectId: string;
  name: string;
  description: string;
  type: ProjectType;
  priority: Priority;
  status: ProjectStatus;
  startDate: string;
  deadline: string;
  technologies: string[];
  githubUrl?: string;
  figmaUrl?: string;
}

interface EmployeeProjectDetailResponse {
  project: EmployeeProjectDetailData;
  tasks: Array<{ _id: string; taskId: string; title: string; priority: Priority; status: TaskStatus; dueDate: string; updatedAt: string }>;
  progress: { total: number; completed: number; percentage: number };
}

export function EmployeeProjectDetail({ id }: { id: string }) {
  const [data, setData] = useState<EmployeeProjectDetailResponse | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/employee/projects/${id}`, { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load project.");
      setData(result as EmployeeProjectDetailResponse);
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(loadError instanceof Error ? loadError.message : "Could not load project.");
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (error && !data) return <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>;
  if (!data) return <DashboardCard><p className="py-12 text-center text-sm text-slate-400">Loading project…</p></DashboardCard>;
  const { project, tasks, progress } = data;

  return <>
    <Link href="/employee/projects" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} /> My projects</Link>
    <DashboardCard className="mb-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[11px] text-slate-500">{project.projectId}</span><ProjectStatusBadge status={project.status} /><PriorityBadge priority={project.priority} /></div>
      <PageHeading title={project.name} description={project.description} />
      <div className="mt-4 grid gap-4 border-t border-white/[0.06] pt-4 sm:grid-cols-3">
        <div><p className="text-[11px] text-slate-500">Timeline</p><p className="mt-1 flex items-center gap-2 text-sm text-slate-200"><CalendarDays size={14} className="text-slate-500" />{formatWorkDate(project.startDate)} – {formatWorkDate(project.deadline)}</p></div>
        <div><p className="text-[11px] text-slate-500">Project type</p><p className="mt-1 text-sm capitalize text-slate-200">{project.type.replaceAll("_", " ")}</p></div>
        <div><p className="text-[11px] text-slate-500">Approved project progress</p><div className="mt-2"><ProgressBar value={progress.percentage} /></div><p className="mt-1 text-[11px] text-slate-500">{progress.completed}/{progress.total} approved tasks</p></div>
      </div>
      {project.technologies.length > 0 && <p className="mt-4 text-xs text-slate-400">Technology stack: {project.technologies.join(", ")}</p>}
      {(project.githubUrl || project.figmaUrl) && <div className="mt-4 flex flex-wrap gap-4">{project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-200 hover:text-white">GitHub repository <ArrowUpRight size={13} /></a>}{project.figmaUrl && <a href={project.figmaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-200 hover:text-white">Figma design <ArrowUpRight size={13} /></a>}</div>}
    </DashboardCard>
    <DashboardCard className="p-0">
      <div className="border-b border-white/[0.06] px-5 py-4"><h2 className="text-sm font-semibold text-white">Your assigned tasks</h2><p className="mt-1 text-xs text-slate-500">Other team members' tasks are not shown.</p></div>
      {tasks.length ? <div className="divide-y divide-white/5">{tasks.map((task) => <Link key={task._id} href={`/employee/tasks/${task._id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-white/[0.02]"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-200">{task.title}</span><span className="mt-1 block font-mono text-[10px] text-slate-500">{task.taskId}</span></span><PriorityBadge priority={task.priority} /><TaskStatusBadge status={task.status} /><span className="w-full text-right text-[11px] text-slate-500 sm:w-auto">Due {formatWorkDate(task.dueDate)}</span></Link>)}</div> : <div className="px-5 py-2"><EmptyState title="No tasks assigned" description="Your tasks for this project will appear here when an administrator assigns them." icon={ClipboardList} /></div>}
    </DashboardCard>
  </>;
}
