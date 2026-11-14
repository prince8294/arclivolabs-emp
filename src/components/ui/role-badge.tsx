import type { EmployeeRole } from "@/types/employee";
import { roleLabels } from "@/types/employee";

export function RoleBadge({ role }: { role: EmployeeRole }) {
  const color =
    role === "admin"
      ? "border-violet-400/20 bg-violet-400/10 text-violet-200"
      : role === "designer"
        ? "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200"
        : "border-sky-400/20 bg-sky-400/10 text-sky-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${color}`}>
      {roleLabels[role]}
    </span>
  );
}
