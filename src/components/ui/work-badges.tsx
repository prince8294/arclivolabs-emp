import type { Priority, ProjectStatus, TaskStatus } from "@/types/work";
import { priorityLabels, projectStatusLabels, taskStatusLabels } from "@/types/work";

const projectColors: Record<ProjectStatus, string> = {
  planning: "border-slate-400/20 bg-slate-400/10 text-slate-200",
  in_progress: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  on_hold: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  completed: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  cancelled: "border-rose-400/20 bg-rose-400/10 text-rose-200",
};

const taskColors: Record<TaskStatus, string> = {
  to_do: "border-slate-400/20 bg-slate-400/10 text-slate-200",
  in_progress: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  blocked: "border-rose-400/20 bg-rose-400/10 text-rose-200",
  in_review: "border-violet-400/20 bg-violet-400/10 text-violet-200",
  completed: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
};

const priorityColors: Record<Priority, string> = {
  low: "text-slate-400",
  medium: "text-sky-200",
  high: "text-amber-200",
  urgent: "text-rose-200",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${projectColors[status]}`}>{projectStatusLabels[status]}</span>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${taskColors[status]}`}>{taskStatusLabels[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${priorityColors[priority]}`}><span className="size-1.5 rounded-full bg-current" />{priorityLabels[priority]}</span>;
}

export function ProgressBar({ value }: { value: number }) {
  const percent = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 min-w-14 flex-1 overflow-hidden rounded-full bg-white/6">
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-slate-400">{percent}%</span>
    </div>
  );
}
