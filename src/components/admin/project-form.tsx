"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeading } from "@/components/ui/page-heading";
import { RoleBadge } from "@/components/ui/role-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { EmployeeRole } from "@/types/employee";
import type { Priority, ProjectStatus, ProjectType } from "@/types/work";

interface AssignableEmployee {
  _id: string;
  fullName: string;
  role: EmployeeRole;
  designation?: string;
  profilePicture?: string;
}

export interface ProjectFormData {
  _id: string;
  name: string;
  description: string;
  type: ProjectType;
  priority: Priority;
  status: ProjectStatus;
  assignedEmployees: Array<string | { _id: string }>;
  startDate: string;
  deadline: string;
  technologies?: string[];
  githubUrl?: string;
  figmaUrl?: string;
  notes?: string;
}

const dateValue = (value?: string) => value ? new Date(value).toISOString().slice(0, 10) : "";

export function ProjectForm({ project }: { project?: ProjectFormData }) {
  const editing = Boolean(project);
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [type, setType] = useState<ProjectType>(project?.type ?? "website");
  const [priority, setPriority] = useState<Priority>(project?.priority ?? "medium");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "planning");
  const [startDate, setStartDate] = useState(dateValue(project?.startDate) || new Date().toISOString().slice(0, 10));
  const [deadline, setDeadline] = useState(dateValue(project?.deadline));
  const [technologies, setTechnologies] = useState(project?.technologies?.join(", ") ?? "");
  const [githubUrl, setGithubUrl] = useState(project?.githubUrl ?? "");
  const [figmaUrl, setFigmaUrl] = useState(project?.figmaUrl ?? "");
  const [notes, setNotes] = useState(project?.notes ?? "");
  const [selected, setSelected] = useState<string[]>(project?.assignedEmployees.map((employee) => typeof employee === "string" ? employee : employee._id) ?? []);
  const [employees, setEmployees] = useState<AssignableEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const initiallyAssigned = project?.assignedEmployees.map((employee) => typeof employee === "string" ? employee : employee._id) ?? [];
    const controller = new AbortController();
    void fetch("/api/admin/assignable-employees", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load active employees.");
        setEmployees(result.employees);
        const activeIds = new Set<string>(result.employees.map((employee: AssignableEmployee) => employee._id));
        if (initiallyAssigned.some((id) => !activeIds.has(id))) {
          setNotice("Inactive employees have been removed from the selected team. Only active team members can be assigned.");
        }
        setSelected((current) => current.filter((id) => activeIds.has(id)));
      })
      .catch((loadError: unknown) => {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(loadError instanceof Error ? loadError.message : "Could not load active employees.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setEmployeesLoading(false);
      });
    return () => controller.abort();
  }, [project]);

  function toggleEmployee(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${deadline}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setError("Enter valid dates and ensure the deadline is on or after the start date.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(editing ? `/api/admin/projects/${project?._id}` : "/api/admin/projects", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          type,
          priority,
          status,
          assignedEmployees: selected,
          startDate: start.toISOString(),
          deadline: end.toISOString(),
          technologies: technologies.split(",").map((value) => value.trim()).filter(Boolean),
          githubUrl,
          figmaUrl,
          notes,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save this project.");
      window.location.assign(editing ? `/admin/projects/${project?._id}` : `/admin/projects/${result.project.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save this project.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={editing ? `/admin/projects/${project?._id}` : "/admin/projects"} className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} /> Back to projects</Link>
      <PageHeading title={editing ? "Edit project" : "Create project"} description="Plan the work, set the timeline, and assign your active team." />
      <form onSubmit={submit} className="space-y-6">
        <section className="grid gap-5 rounded-2xl border border-white/6 bg-panel p-5 sm:grid-cols-2 sm:p-6">
          <Input label="Project name" name="name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
          <label className="block space-y-2 text-sm font-medium text-slate-200">Project type
            <select value={type} onChange={(event) => setType(event.target.value as ProjectType)} className="h-12 w-full rounded-xl border border-white/10 bg-sidebar px-4 font-normal text-white outline-none focus:border-accent">
              <option value="website">Website</option><option value="web_application">Web application</option><option value="software">Software</option><option value="other">Other</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-200 sm:col-span-2">Description
            <textarea required maxLength={6000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full resize-y rounded-xl border border-white/10 bg-sidebar px-4 py-3 text-sm font-normal text-white outline-none placeholder:text-slate-500 focus:border-accent" />
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-200">Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className="h-12 w-full rounded-xl border border-white/10 bg-sidebar px-4 font-normal text-white outline-none focus:border-accent">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-200">Status
            <select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)} className="h-12 w-full rounded-xl border border-white/10 bg-sidebar px-4 font-normal text-white outline-none focus:border-accent">
              <option value="planning">Planning</option><option value="in_progress">In progress</option><option value="on_hold">On hold</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
            </select>
          </label>
          <Input label="Start date" name="startDate" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input label="Deadline" name="deadline" type="date" required value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          <Input label="Technology stack (comma separated)" name="technologies" maxLength={1200} placeholder="Next.js, MongoDB, TypeScript" value={technologies} onChange={(event) => setTechnologies(event.target.value)} />
          <Input label="GitHub repository URL (optional)" name="githubUrl" type="url" maxLength={2048} value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} />
          <Input label="Figma design URL (optional)" name="figmaUrl" type="url" maxLength={2048} value={figmaUrl} onChange={(event) => setFigmaUrl(event.target.value)} />
          <label className="block space-y-2 text-sm font-medium text-slate-200 sm:col-span-2">Project notes <span className="font-normal text-slate-500">(admin only)</span>
            <textarea rows={3} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full resize-y rounded-xl border border-white/10 bg-sidebar px-4 py-3 text-sm font-normal text-white outline-none focus:border-accent" />
          </label>
        </section>

        <section className="rounded-2xl border border-white/6 bg-panel p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">Assigned team</h2>
            <p className="mt-1 text-xs text-slate-500">Only active Developers and Designers can be assigned. You can leave the team empty and assign later.</p>
          </div>
          {employeesLoading ? <p className="rounded-xl bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-500">Loading active employees…</p> : employees.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {employees.map((employee) => (
                <label key={employee._id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${selected.includes(employee._id) ? "border-accent/40 bg-accent/10" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                  <input type="checkbox" checked={selected.includes(employee._id)} onChange={() => toggleEmployee(employee._id)} className="size-4 accent-violet-500" />
                  <UserAvatar name={employee.fullName} src={employee.profilePicture} className="size-9 text-[11px]" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-100">{employee.fullName}</span><span className="mt-1 block truncate text-xs text-slate-500">{employee.designation || "Team member"}</span></span>
                  <RoleBadge role={employee.role} />
                </label>
              ))}
            </div>
          ) : <p className="rounded-xl bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-500">No active employees are available to assign.</p>}
        </section>
        {notice && <p role="status" className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-4 py-3 text-sm text-amber-200">{notice}</p>}
        {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
        <div className="flex justify-end gap-3">
          <Link href={editing ? `/admin/projects/${project?._id}` : "/admin/projects"} className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm font-medium text-slate-300 hover:bg-white/5">Cancel</Link>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save project" : "Create project"}</Button>
        </div>
      </form>
    </div>
  );
}
