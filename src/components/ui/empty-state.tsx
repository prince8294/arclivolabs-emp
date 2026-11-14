import type { LucideIcon } from "lucide-react";
import { Layers3 } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon: Icon = Layers3,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-10 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <Icon size={21} strokeWidth={1.8} />
      </span>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{description}</p>
      <span className="mt-5 rounded-full border border-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
        Coming in a later phase
      </span>
    </div>
  );
}
