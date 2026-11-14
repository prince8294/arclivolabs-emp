"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BriefcaseBusiness, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { PriorityBadge, ProgressBar, ProjectStatusBadge } from "@/components/ui/work-badges";
import type { Priority, ProjectStatus, ProjectType } from "@/types/work";
import { formatWorkDate, isWorkDateOverdue } from "@/lib/work/format";

interface ProjectRow {
  _id: string;
  projectId: string;
  name: string;
  description: string;
  type: ProjectType;
  priority: Priority;
  status: ProjectStatus;
  assignedEmployees: Array<{ _id: string; fullName: string }>;
  deadline: string;
  progress: { total: number; completed: number };
}

interface ProjectsResponse {
  projects: ProjectRow[];
  pagination: { page: number; pages: number; total: number };
  stats: { totalProjects: number; activeProjects: number; completedProjects: number; overdueProjects: number };
}

export function ProjectList() {
  const [data, setData] = useState<ProjectsResponse | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ q: query, status, archived: String(archived), page: String(page), limit: "10" });
    try {
      const response = await fetch(`/api/admin/projects?${params}`, { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load projects.");
      setData(result as ProjectsResponse);
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
        setError(loadError instanceof Error ? loadError.message : "Could not load projects.");
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
        <PageHeading title="Projects" description="Plan and track your team's development work." />
        <Link href="/admin/projects/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:bg-violet-500"><Plus size={16} /> New project</Link>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ["Total projects", data?.stats.totalProjects ?? 0],
          ["Active projects", data?.stats.activeProjects ?? 0],
          ["Completed", data?.stats.completedProjects ?? 0],
          ["Overdue", data?.stats.overdueProjects ?? 0],
        ].map(([label, count]) => (
          <DashboardCard key={String(label)} className="p-4 sm:p-5">
            <p className="text-xs font-medium text-slate-400">{label}</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading && !data ? "—" : count}</p>
          </DashboardCard>
        ))}
      </div>
      <DashboardCard className="mb-5 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_200px_180px]">
          <label className="relative block"><span className="sr-only">Search projects</span><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setFilter(setQuery, event.target.value)} placeholder="Search project name" className="h-11 w-full rounded-xl border border-white/10 bg-sidebar pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-accent" /></label>
          <select aria-label="Filter by project status" value={status} onChange={(event) => setFilter(setStatus, event.target.value)} className="h-11 rounded-xl border border-white/10 bg-sidebar px-3 text-sm text-slate-200 outline-none focus:border-accent">
            <option value="">All statuses</option><option value="planning">Planning</option><option value="in_progress">In progress</option><option value="on_hold">On hold</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
          </select>
          <select aria-label="Project archive view" value={String(archived)} onChange={(event) => { setArchived(event.target.value === "true"); setPage(1); }} className="h-11 rounded-xl border border-white/10 bg-sidebar px-3 text-sm text-slate-200 outline-none focus:border-accent">
            <option value="false">Current projects</option><option value="true">Archived projects</option>
          </select>
        </div>
      </DashboardCard>
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}

      {loading && !data ? <DashboardCard><p className="py-12 text-center text-sm text-slate-400">Loading projects…</p></DashboardCard> :
        data?.projects.length ? (
          <>
            <div className="space-y-3">
              {data.projects.map((project) => {
                const percent = project.progress.total ? Math.round((project.progress.completed / project.progress.total) * 100) : 0;
                const overdue = !archived && !["completed", "cancelled"].includes(project.status) && isWorkDateOverdue(project.deadline);
                return (
                  <Link key={project._id} href={`/admin/projects/${project._id}`} className="block rounded-2xl border border-white/[0.06] bg-panel p-4 transition hover:border-white/10 hover:bg-white/[0.035] sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold text-white">{project.name}</h2><span className="font-mono text-[10px] text-slate-500">{project.projectId}</span></div>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-400">{project.description}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 lg:w-[440px] lg:justify-between">
                        <ProjectStatusBadge status={project.status} /><PriorityBadge priority={project.priority} />
                        <span className={`text-xs ${overdue ? "text-rose-200" : "text-slate-400"}`}>Due {formatWorkDate(project.deadline)}{overdue ? " · Overdue" : ""}</span>
                      </div>
                      <div className="flex items-center gap-2 lg:w-36">
                        <span className="truncate text-xs text-slate-400">{project.assignedEmployees.length ? project.assignedEmployees.map((member) => member.fullName).join(", ") : "No team assigned"}</span>
                        <ArrowRight size={15} className="ml-auto shrink-0 text-slate-500" />
                      </div>
                    </div>
                    <div className="mt-4 grid items-center gap-2 border-t border-white/[0.05] pt-3 sm:grid-cols-[100px_minmax(0,1fr)]">
                      <span className="text-[11px] text-slate-500">Task progress <span className="ml-1 text-slate-400">{project.progress.completed}/{project.progress.total}</span></span>
                      <ProgressBar value={percent} />
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>{data.pagination.total} project{data.pagination.total === 1 ? "" : "s"}</span>
              <div className="flex items-center gap-2"><Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>{page} / {Math.max(1, data.pagination.pages)}</span><Button variant="secondary" size="sm" disabled={page >= data.pagination.pages || loading} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
            </div>
          </>
        ) : <EmptyState title={query || status ? "No matching projects" : archived ? "No archived projects" : "No projects yet"} description={query || status ? "Try changing the search or status filter." : "Create a project to plan and assign your team's work."} icon={BriefcaseBusiness} />}
    </>
  );
}
