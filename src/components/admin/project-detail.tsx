"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, ClipboardList, Pencil, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { PriorityBadge, ProgressBar, ProjectStatusBadge, TaskStatusBadge } from "@/components/ui/work-badges";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { Priority, ProjectStatus, ProjectType, TaskStatus } from "@/types/work";
import type { EmployeeRole } from "@/types/employee";
import { formatWorkDate } from "@/lib/work/format";

interface ProjectData {
  _id: string;
  projectId: string;
  name: string;
  description: string;
  type: ProjectType;
  priority: Priority;
  status: ProjectStatus;
  assignedEmployees: Array<{ _id: string; fullName: string; email: string; role: EmployeeRole; designation?: string; profilePicture?: string; status: string }>;
  startDate: string;
  deadline: string;
  technologies: string[];
  githubUrl?: string;
  figmaUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

interface ProjectTask {
  _id: string;
  taskId: string;
  title: string;
  assignedTo?: { _id: string; fullName: string } | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
}

interface ProjectDetailResponse {
  project: ProjectData;
  tasks: ProjectTask[];
  progress: { total: number; completed: number; percentage: number };
}

export function ProjectDetail({ id }: { id: string }) {
  const [data, setData] = useState<ProjectDetailResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/admin/projects/${id}`, { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load project.");
      setData(result as ProjectDetailResponse);
      setError("");
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(loadError instanceof Error ? loadError.message : "Could not load project.");
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function archive() {
    if (!data || !window.confirm(`Archive "${data.project.name}"? It will no longer appear in the current project list.`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/projects/${id}/archive`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not archive this project.");
      window.location.assign("/admin/projects?archived=true");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not archive this project.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>;
  if (!data) return <DashboardCard><p className="py-12 text-center text-sm text-slate-400">Loading project…</p></DashboardCard>;

  const { project, tasks, progress } = data;
  return (
    <>
      <Link href="/admin/projects" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} /> All projects</Link>
      <div className="mb-6 flex flex-col gap-5 rounded-2xl border border-white/[0.06] bg-panel p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[11px] text-slate-500">{project.projectId}</span><ProjectStatusBadge status={project.status} /><PriorityBadge priority={project.priority} /></div>
          <PageHeading title={project.name} description={project.description} />
          <p className="text-xs capitalize text-slate-500">{project.type.replaceAll("_", " ")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!project.archivedAt && <Link href={`/admin/projects/${id}/edit`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-medium text-slate-200 hover:bg-white/5"><Pencil size={14} /> Edit project</Link>}
          {!project.archivedAt && !["completed", "cancelled"].includes(project.status) && <Link href={`/admin/tasks/new?project=${id}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3 text-sm font-semibold text-white hover:bg-violet-500"><Plus size={14} /> Create task</Link>}
          {project.archivedAt ? <span className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-3 text-xs text-slate-500">Archived</span> : <Button variant="secondary" size="sm" disabled={busy || !["completed", "cancelled"].includes(project.status)} title={!["completed", "cancelled"].includes(project.status) ? "Only completed or cancelled projects can be archived" : undefined} onClick={() => void archive()}>{busy ? "Archiving…" : "Archive"}</Button>}
        </div>
      </div>
      {error && <p role="alert" className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <DashboardCard className="p-4"><div className="flex items-center gap-2 text-xs text-slate-400"><CheckCircle2 size={15} className="text-violet-200" />Task progress</div><div className="mt-4"><ProgressBar value={progress.percentage} /></div><p className="mt-2 text-[11px] text-slate-500">{progress.completed} of {progress.total} tasks approved</p></DashboardCard>
        <DashboardCard className="p-4"><div className="flex items-center gap-2 text-xs text-slate-400"><CalendarDays size={15} className="text-violet-200" />Timeline</div><p className="mt-3 text-sm text-slate-200">{formatWorkDate(project.startDate)} – {formatWorkDate(project.deadline)}</p></DashboardCard>
        <DashboardCard className="p-4"><div className="flex items-center gap-2 text-xs text-slate-400"><Users size={15} className="text-violet-200" />Assigned team</div><p className="mt-3 text-sm text-slate-200">{project.assignedEmployees.length} member{project.assignedEmployees.length === 1 ? "" : "s"}</p></DashboardCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <DashboardCard className="p-0">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"><div><h2 className="text-sm font-semibold text-white">Project tasks</h2><p className="mt-1 text-xs text-slate-500">{tasks.length} task{tasks.length === 1 ? "" : "s"} · progress counts approved work only</p></div><Link href="/admin/tasks" className="text-xs font-medium text-violet-200 hover:text-white">View all tasks</Link></div>
          {tasks.length ? <div className="divide-y divide-white/5">{tasks.map((task) => <Link key={task._id} href={`/admin/tasks/${task._id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-white/[0.02]"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-200">{task.title}</span><span className="mt-1 block font-mono text-[10px] text-slate-500">{task.taskId}{task.assignedTo ? ` · ${task.assignedTo.fullName}` : ""}</span></span><PriorityBadge priority={task.priority} /><TaskStatusBadge status={task.status} /><span className="w-full text-right text-[11px] text-slate-500 sm:w-auto">Due {formatWorkDate(task.dueDate)}</span></Link>)}</div> : <div className="px-5 py-2"><EmptyState title="No tasks yet" description="Create tasks and assign them to active project team members." icon={ClipboardList} /></div>}
        </DashboardCard>
        <div className="space-y-5">
          <DashboardCard>
            <h2 className="text-sm font-semibold text-white">Assigned team</h2>
            <div className="mt-4 space-y-3">{project.assignedEmployees.length ? project.assignedEmployees.map((member) => <div key={member._id} className="flex items-center gap-3"><UserAvatar name={member.fullName} src={member.profilePicture} className="size-9 text-[10px]" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{member.fullName}</p><p className="truncate text-xs text-slate-500">{member.designation || member.email}</p></div><span className="text-[11px] text-slate-400">{member.role === "developer" ? "Developer" : "Designer"}</span></div>) : <p className="text-sm text-slate-500">No team members assigned.</p>}</div>
          </DashboardCard>
          {(project.githubUrl || project.figmaUrl || project.technologies.length > 0) && <DashboardCard><h2 className="text-sm font-semibold text-white">Project resources</h2><div className="mt-4 space-y-3">{project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-violet-200 hover:text-white">GitHub repository <ArrowUpRight size={14} /></a>}{project.figmaUrl && <a href={project.figmaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-violet-200 hover:text-white">Figma design <ArrowUpRight size={14} /></a>}{project.technologies.length > 0 && <p className="text-xs leading-5 text-slate-400">Stack: {project.technologies.join(", ")}</p>}</div></DashboardCard>}
          {project.notes && <DashboardCard><h2 className="text-sm font-semibold text-white">Internal project notes</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{project.notes}</p></DashboardCard>}
        </div>
      </div>
    </>
  );
}
