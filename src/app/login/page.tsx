import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/auth/authorization";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getActiveSession();
  if (session) redirect(session.user.role === "admin" ? "/admin/dashboard" : "/employee/dashboard");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute -left-40 top-1/4 size-[420px] rounded-full bg-violet-700/10 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute -right-36 bottom-0 size-[420px] rounded-full bg-indigo-600/10 blur-[130px]" />
      <div className="relative grid w-full max-w-[980px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#111827]/90 shadow-2xl shadow-black/40 lg:grid-cols-[1fr_1.04fr]">
        <section className="hidden flex-col justify-between border-r border-white/[0.06] bg-gradient-to-br from-[#171b30] via-[#131a2b] to-[#111827] p-10 lg:flex">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 font-bold text-white shadow-lg shadow-indigo-950/50">A</span>
            <span className="text-base font-semibold tracking-tight text-white">ArclivoLabs</span>
          </div>
          <div className="max-w-sm">
            <div className="mb-5 h-px w-12 bg-accent" />
            <p className="text-sm font-medium uppercase tracking-[0.17em] text-violet-200/80">People. Craft. Progress.</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white">
              A focused space to do your best work.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              Your team workspace for work, collaboration, and everything we build together.
            </p>
          </div>
          <p className="text-xs text-slate-600">Internal workspace · ArclivoLabs</p>
        </section>
        <section className="px-6 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white">A</span>
            <span className="text-sm font-semibold text-white">ArclivoLabs</span>
          </div>
          <div className="mb-8">
            <p className="text-sm font-medium text-violet-300">Your workspace awaits</p>
            <h1 className="mt-2 text-[30px] font-semibold tracking-tight text-white">Welcome Back</h1>
            <p className="mt-2 text-sm text-slate-400">Sign in to your workspace</p>
          </div>
          <LoginForm />
          <p className="mt-8 text-center text-xs leading-5 text-slate-500">
            Access is limited to ArclivoLabs team members.<br />
            Need an account? Contact your administrator.
          </p>
        </section>
      </div>
    </main>
  );
}
