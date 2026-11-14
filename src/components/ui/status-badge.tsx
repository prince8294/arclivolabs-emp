import type { AccountStatus } from "@/types/employee";
import { statusLabels } from "@/types/employee";

export function StatusBadge({ status }: { status: AccountStatus }) {
  const styles: Record<AccountStatus, string> = {
    active: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    inactive: "border-slate-400/20 bg-slate-400/10 text-slate-300",
    pending_setup: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}
