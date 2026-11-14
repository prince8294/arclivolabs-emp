"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function SetupForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 12) {
      setError("Choose a password with at least 12 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Account setup could not be completed.");
      setComplete(true);
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : "Account setup could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#111827]/90 p-6 shadow-2xl shadow-black/30 sm:p-9">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white">A</span>
        <span className="text-sm font-semibold text-white">ArclivoLabs</span>
      </div>
      {complete ? (
        <>
          <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-200"><Check size={22} /></span>
          <h1 className="mt-5 text-2xl font-semibold text-white">Account set up</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Your password is ready. If your administrator has enabled account activation, you can now sign in.</p>
          <Link href="/login" className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-violet-500">Continue to sign in</Link>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-violet-300">Employee account</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Set up your password</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Choose a strong password to finish setting up your ArclivoLabs workspace account.</p>
          <form onSubmit={submit} className="mt-7 space-y-5">
            <Input label="New password" name="password" type={visible ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} required trailing={<button type="button" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible((value) => !value)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 hover:text-white">{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>} />
            <Input label="Confirm password" name="confirmPassword" type={visible ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={12} maxLength={128} required />
            <p className="text-xs text-slate-500">Use at least 12 characters. Maximum 72 UTF-8 bytes.</p>
            {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">{busy ? <><Spinner /> Setting up…</> : <><KeyRound size={16} /> Set password</>}</Button>
          </form>
        </>
      )}
    </div>
  );
}
