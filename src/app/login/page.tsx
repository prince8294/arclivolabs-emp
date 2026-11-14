import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/auth/authorization";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getActiveSession();
  if (session) redirect(session.user.role === "admin" ? "/admin/dashboard" : "/employee/dashboard");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0c0911] px-4 py-10 sm:px-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_15%,rgba(169,140,255,0.14),transparent_36%),radial-gradient(ellipse_at_88%_82%,rgba(212,125,225,0.09),transparent_35%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />
      <div className="relative grid w-full max-w-[1040px] overflow-hidden rounded-[30px] border border-white/[0.09] bg-[#120e19]/94 shadow-[0_40px_120px_rgba(3,1,7,0.65)] ring-1 ring-white/[0.018] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden min-h-[660px] flex-col justify-between overflow-hidden border-r border-white/[0.07] bg-[linear-gradient(145deg,#1d1428_0%,#15101d_52%,#110d17_100%)] p-12 lg:flex">
          <div aria-hidden className="absolute -right-28 -top-24 size-80 rounded-full border border-violet-300/10" />
          <div aria-hidden className="absolute -right-12 -top-8 size-52 rounded-full border border-fuchsia-300/[0.08]" />
          <div className="relative flex items-center gap-3.5">
            <span className="flex size-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#21152f] shadow-[0_18px_45px_rgba(169,140,255,0.2)]">
              <img src="/artwork/arclivo-mark.svg" alt="" className="size-full" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold uppercase tracking-[0.13em] text-white">Arclivo</span>
              <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.24em] text-violet-200/55">Team workspace</span>
            </span>
          </div>
          <div className="relative max-w-sm pb-8">
            <span className="mb-6 block h-0.5 w-12 rounded-full bg-gradient-to-r from-violet-300 via-fuchsia-300 to-orange-200" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-200/65">People · craft · progress</p>
            <h2 className="mt-5 text-[40px] font-semibold leading-[1.08] tracking-[-0.035em] text-white">
              Good work starts with a clear space.
            </h2>
            <p className="mt-5 max-w-xs text-sm leading-7 text-slate-400">
              One calm place for the team to stay aligned, move work forward, and keep the important details close.
            </p>
            <div className="mt-9 flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.6)]" />
              Secure internal access
            </div>
          </div>
          <p className="relative text-[10px] uppercase tracking-[0.18em] text-slate-600">Arclivo · Internal workspace</p>
        </section>
        <section className="flex flex-col justify-center px-6 py-10 sm:px-11 sm:py-14 lg:px-14">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="flex size-11 items-center justify-center overflow-hidden rounded-[15px] border border-white/10 bg-[#21152f] shadow-lg shadow-violet-950/30">
              <img src="/artwork/arclivo-mark.svg" alt="" className="size-full" />
            </span>
            <span>
              <span className="block text-sm font-semibold uppercase tracking-[0.12em] text-white">Arclivo</span>
              <span className="mt-0.5 block text-[9px] uppercase tracking-[0.2em] text-slate-500">Team workspace</span>
            </span>
          </div>
          <div className="mb-9">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300/75">Employee portal</p>
            <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.035em] text-white">Welcome back</h1>
            <p className="mt-2.5 text-sm leading-6 text-slate-400">Sign in with your Arclivo work account.</p>
          </div>
          <LoginForm />
          <p className="mt-8 border-t border-white/[0.06] pt-6 text-center text-[11px] leading-5 text-slate-500">
            Access is limited to authorised team members.<br />
            For account help, contact your administrator.
          </p>
        </section>
      </div>
    </main>
  );
}
