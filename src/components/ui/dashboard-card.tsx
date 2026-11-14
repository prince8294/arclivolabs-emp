import type { ReactNode } from "react";

export function DashboardCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-white/[0.06] bg-panel p-5 shadow-card sm:p-6 ${className}`}>
      {children}
    </section>
  );
}
