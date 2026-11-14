import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">403 · Access restricted</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">You don’t have access to this area</h1>
        <p className="mt-3 text-sm text-slate-400">Your account is not permitted to open this page.</p>
        <Link href="/" className="mt-7 inline-flex rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500">
          Return to your workspace
        </Link>
      </div>
    </main>
  );
}
