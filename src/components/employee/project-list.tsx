"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, ClipboardList } from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { PriorityBadge, ProgressBar, ProjectStatusBadge, TaskStatusBadge } from "@/components/ui/work-badges";
import type { Priority, ProjectStatus, ProjectType, TaskStatus } from "@/types/work";
import { formatWorkDate } from "@/lib/work/format";

interface MyProject {
  _id: string;
  projectId: string;
  name: string;
  description: string;
  type: ProjectType;
  priority: Priority;
  status: ProjectStatus;
  deadline: string;
  githubUrl?: string;
  figmaUrl?: string;
  progress: { total: number; completed: number };
  tasks: Array<{ _id: string; taskId: string; title: string; priority: Priority; status: TaskStatus; dueDate: string }>;
}

export function EmployeeProjectList() {
  const [projects, setProjects] = useState<MyProject[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/employee/projects", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load your projects.");
        setProjects(result.projects as MyProject[]);
      })
      .catch((loadError: unknown) => {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(loadError instanceof Error ? loadError.message : "Could not load your projects.");
      });
    return () => controller.abort();
  }, []);

  return (
    <>
      <PageHeading title="My projects" description="Projects assigned to you and your tasks within them." />
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
      {!projects && !error ? <DashboardCard><p className="py-12 text-center text-sm text-slate-400">Loading your projects…</p></DashboardCard> :
        projects?.length ? <div className="space-y-4">{projects.map((project) => {
          const percent = project.progress.total ? Math.round((project.progress.completed / project.progress.total) * 100) : 0;
          return <DashboardCard key={project._id} className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-violet-200"><BriefcaseBusiness size={18} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><Link href={`/employee/projects/${project._id}`} className="text-sm font-semibold text-white hover:text-violet-200">{project.name}</Link><ProjectStatusBadge status={project.status} /><PriorityBadge priority={project.priority} /></div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{project.description}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]"><span className="text-[11px] text-slate-500">Project progress</span><ProgressBar value={percent} /></div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-slate-400"><CalendarDays size={14} />Due {formatWorkDate(project.deadline)}</div>
            </div>
            <div className="mt-4 border-t border-white/[0.05] pt-4">
              <div className="mb-3 flex items-center gap-2 text-xs text-slate-400"><ClipboardList size={14} />Your assigned tasks <span className="text-slate-500">({project.tasks.length})</span></div>
              {project.tasks.length ? <div className="space-y-2">{project.tasks.map((task) => <Link key={task._id} href={`/employee/tasks/${task._id}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.02] px-3 py-2.5 hover:bg-white/[0.04]"><span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-200">{task.title}</span><TaskStatusBadge status={task.status} /><span className="text-[11px] text-slate-500">Due {formatWorkDate(task.dueDate)}</span></Link>)}</div> : <p className="text-xs text-slate-500">You do not have tasks assigned on this project yet.</p>}
              {(project.githubUrl || project.figmaUrl) && <div className="mt-3 flex flex-wrap gap-4">{project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-200 hover:text-white">GitHub <ArrowUpRight size={12} /></a>}{project.figmaUrl && <a href={project.figmaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-200 hover:text-white">Figma <ArrowUpRight size={12} /></a>}</div>}
            </div>
          </DashboardCard>;
        })}</div> : <EmptyState title="No projects assigned" description="Projects assigned to you by your administrator will appear here." icon={BriefcaseBusiness} />}
    </>
  );
}
