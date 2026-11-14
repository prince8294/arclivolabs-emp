import type { ReactNode } from "react";

export function DashboardCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[20px] border border-white/[0.07] bg-panel/92 p-5 shadow-card shadow-black/10 ring-1 ring-white/[0.012] transition-[border-color,transform,box-shadow] duration-200 hover:border-white/[0.1] sm:p-6 ${className}`}>
      {children}
    </section>
  );
}
