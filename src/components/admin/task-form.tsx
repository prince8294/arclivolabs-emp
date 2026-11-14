"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeading } from "@/components/ui/page-heading";
import type { EmployeeRole } from "@/types/employee";
import type { Priority } from "@/types/work";

interface TeamMember {
  _id: string;
  fullName: string;
  role: EmployeeRole;
  designation?: string;
  status: string;
}

interface ProjectOption {
  _id: string;
  projectId: string;
  name: string;
  status: string;
  assignedEmployees: TeamMember[];
}

export interface TaskFormData {
  _id: string;
  project: string;
  title: string;
  description?: string;
  assignedTo: string;
  priority: Priority;
  dueDate: string;
  startDate?: string;
  instructions?: string;
  acceptanceCriteria?: string;
}

const dateValue = (value?: string) => value ? new Date(value).toISOString().slice(0, 10) : "";

export function TaskForm({ task, initialProjectId = "" }: { task?: TaskFormData; initialProjectId?: string }) {
  const editing = Boolean(task);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectId, setProjectId] = useState(task?.project ?? initialProjectId);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [startDate, setStartDate] = useState(dateValue(task?.startDate));
  const [dueDate, setDueDate] = useState(dateValue(task?.dueDate));
  const [instructions, setInstructions] = useState(task?.instructions ?? "");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(task?.acceptanceCriteria ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/projects?limit=50", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load projects.");
        setProjects(result.projects ?? []);
      })
      .catch((loadError: unknown) => {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(loadError instanceof Error ? loadError.message : "Could not load projects.");
        }
      })
      .finally(() => setLoadingProjects(false));
    return () => controller.abort();
  }, []);

  const selectedProject = projects.find((project) => project._id === projectId);
  const team = selectedProject?.assignedEmployees.filter((employee) => employee.status === "active") ?? [];
  const selectedAssignee = team.some((employee) => employee._id === assignedTo) ? assignedTo : "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const due = new Date(`${dueDate}T00:00:00.000Z`);
    const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : undefined;
    if (Number.isNaN(due.getTime()) || (start && (Number.isNaN(start.getTime()) || start > due))) {
      setError("Enter valid dates and ensure the due date is on or after the start date.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(editing ? `/api/admin/tasks/${task?._id}` : "/api/admin/tasks", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: projectId,
          title,
          description,
          assignedTo: selectedAssignee,
          priority,
          startDate: start?.toISOString() ?? "",
          dueDate: due.toISOString(),
          instructions,
          acceptanceCriteria,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save this task.");
      const taskId = editing ? task?._id : result.task.id;
      const notice = result.warning ? `?notice=${encodeURIComponent(result.warning)}` : "";
      window.location.assign(`/admin/tasks/${taskId}${notice}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save this task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={editing ? `/admin/tasks/${task?._id}` : "/admin/tasks"} className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} /> Back to tasks</Link>
      <PageHeading title={editing ? "Edit task" : "Create task"} description="Assign one active team member as the primary owner of this task." />
      <form onSubmit={submit} className="space-y-6">
        <section className="grid gap-5 rounded-2xl border border-white/6 bg-panel p-5 sm:grid-cols-2 sm:p-6">
          <label className="block space-y-2 text-sm font-medium text-slate-200 sm:col-span-2">Project
            <select required value={projectId} onChange={(event) => setProjectId(event.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-sidebar px-4 font-normal text-white outline-none focus:border-accent">
              <option value="">{loadingProjects ? "Loading projects…" : "Select project"}</option>
              {projects.filter((project) => !["completed", "cancelled"].includes(project.status) || project._id === task?.project).map((project) => <option key={project._id} value={project._id}>{project.name} · {project.projectId}</option>)}
            </select>
          </label>
          <Input label="Task title" name="title" required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} />
          <label className="block space-y-2 text-sm font-medium text-slate-200">Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className="h-12 w-full rounded-xl border border-white/10 bg-sidebar px-4 font-normal text-white outline-none focus:border-accent"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select>
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-200 sm:col-span-2">Description
            <textarea maxLength={6000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full resize-y rounded-xl border border-white/10 bg-sidebar px-4 py-3 text-sm font-normal text-white outline-none focus:border-accent" />
          </label>
          <Input label="Start date (optional)" name="startDate" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input label="Due date" name="dueDate" type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <label className="block space-y-2 text-sm font-medium text-slate-200 sm:col-span-2">Assigned employee
            <select required value={selectedAssignee} onChange={(event) => setAssignedTo(event.target.value)} disabled={!projectId} className="h-12 w-full rounded-xl border border-white/10 bg-sidebar px-4 font-normal text-white outline-none focus:border-accent disabled:opacity-50">
              <option value="">{projectId ? "Select one active project team member" : "Select a project first"}</option>
              {team.map((employee) => <option key={employee._id} value={employee._id}>{employee.fullName} · {employee.role === "developer" ? "Developer" : "Designer"} · {employee.designation || "Team member"}</option>)}
            </select>
            {projectId && team.length === 0 && <span className="block text-xs text-amber-200">This project has no active team members. Assign an employee in the project settings first.</span>}
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-200 sm:col-span-2">Instructions
            <textarea maxLength={6000} rows={3} value={instructions} onChange={(event) => setInstructions(event.target.value)} className="w-full resize-y rounded-xl border border-white/10 bg-sidebar px-4 py-3 text-sm font-normal text-white outline-none focus:border-accent" />
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-200 sm:col-span-2">Acceptance criteria
            <textarea maxLength={4000} rows={3} value={acceptanceCriteria} onChange={(event) => setAcceptanceCriteria(event.target.value)} className="w-full resize-y rounded-xl border border-white/10 bg-sidebar px-4 py-3 text-sm font-normal text-white outline-none focus:border-accent" />
          </label>
          <p className="text-xs leading-5 text-slate-500 sm:col-span-2">File attachments are unavailable until private storage is configured. Add work links when submitting for review.</p>
        </section>
        {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
        <div className="flex justify-end gap-3"><Link href={editing ? `/admin/tasks/${task?._id}` : "/admin/tasks"} className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm font-medium text-slate-300 hover:bg-white/5">Cancel</Link><Button type="submit" disabled={busy || loadingProjects}>{busy ? "Saving…" : editing ? "Save task" : "Create task"}</Button></div>
      </form>
    </div>
  );
}
