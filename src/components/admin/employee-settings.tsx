"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Activity, Building2, Check, Clock3, Settings2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { PageHeading } from "@/components/ui/page-heading";
import { checkInIntervals } from "@/types/activity";

interface EmployeeSettingsValues {
  workspaceName: string;
  companyLogoUrl: string;
  defaultTimeZone: "UTC" | "Asia/Kolkata" | "Europe/London" | "America/New_York";
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  invitationExpiryHours: number;
  activateOnSetup: boolean;
  employeeIdPrefix: string;
}

const defaults: EmployeeSettingsValues = {
  workspaceName: "ArclivoLabs",
  companyLogoUrl: "",
  defaultTimeZone: "Asia/Kolkata",
  dateFormat: "DD/MM/YYYY",
  invitationExpiryHours: 72,
  activateOnSetup: true,
  employeeIdPrefix: "ARL",
};

export function EmployeeSettings() {
  const [values, setValues] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/settings", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load employee settings.");
        setValues(result.settings ?? defaults);
      })
      .catch((loadError: unknown) => {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(loadError instanceof Error ? loadError.message : "Could not load employee settings.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save employee settings.");
      setValues(result.settings);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save employee settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading title="Settings" description="Manage the employee account defaults for your workspace." />
      <DashboardCard className="mb-5 max-w-3xl">
        <div className="mb-5 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-violet-200"><Building2 size={18} /></span><div><h2 className="text-sm font-semibold text-white">General settings</h2><p className="mt-1 text-xs text-slate-500">Workspace identity and date display defaults.</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">Workspace name<input required minLength={2} maxLength={100} value={values.workspaceName} onChange={(event) => setValues((current) => ({ ...current, workspaceName: event.target.value }))} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label>
          <label className="space-y-2 text-sm text-slate-300">Company logo URL (optional)<input type="url" maxLength={2048} value={values.companyLogoUrl} onChange={(event) => setValues((current) => ({ ...current, companyLogoUrl: event.target.value }))} placeholder="https://…" className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label>
          <label className="space-y-2 text-sm text-slate-300">Default time zone<select value={values.defaultTimeZone} onChange={(event) => setValues((current) => ({ ...current, defaultTimeZone: event.target.value as EmployeeSettingsValues["defaultTimeZone"] }))} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white">{["Asia/Kolkata", "UTC", "Europe/London", "America/New_York"].map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></label>
          <label className="space-y-2 text-sm text-slate-300">Date format<select value={values.dateFormat} onChange={(event) => setValues((current) => ({ ...current, dateFormat: event.target.value as EmployeeSettingsValues["dateFormat"] }))} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white">{["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].map((format) => <option key={format} value={format}>{format}</option>)}</select></label>
        </div>
        {values.companyLogoUrl && <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><span className="flex size-11 items-center justify-center overflow-hidden rounded-lg bg-white/5"><img src={values.companyLogoUrl} alt="Company logo preview" className="size-full object-contain" /></span><span className="text-xs text-slate-400">Logo preview</span></div>}
      </DashboardCard>
      <DashboardCard className="max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-violet-200"><Settings2 size={18} /></span>
          <div><h2 className="text-sm font-semibold text-white">Employee settings</h2><p className="mt-1 text-xs text-slate-500">Applied to new employee invitations.</p></div>
        </div>
        {loading ? <p className="text-sm text-slate-400">Loading settings…</p> : (
          <form onSubmit={save} className="space-y-6">
            <label className="block space-y-2 text-sm font-medium text-slate-200">
              Invitation expiration
              <span className="block text-xs font-normal text-slate-500">Setup links automatically expire after this many hours.</span>
              <div className="flex items-center gap-3">
                <input type="number" min={1} max={720} required value={values.invitationExpiryHours} onChange={(event) => setValues((current) => ({ ...current, invitationExpiryHours: Number(event.target.value) }))} className="h-11 w-36 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white outline-none focus:border-accent" />
                <span className="text-sm text-slate-500">hours (1–720)</span>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <input type="checkbox" checked={values.activateOnSetup} onChange={(event) => setValues((current) => ({ ...current, activateOnSetup: event.target.checked }))} className="mt-0.5 size-4 accent-violet-500" />
              <span><span className="block text-sm font-medium text-slate-200">Activate account after setup</span><span className="mt-1 block text-xs leading-5 text-slate-500">When enabled, employees can sign in as soon as they set a password. Otherwise, an admin must activate the account.</span></span>
            </label>
            <label className="block space-y-2 text-sm font-medium text-slate-200">
              Employee ID prefix
              <span className="block text-xs font-normal text-slate-500">New IDs use this prefix followed by an automatically increasing number.</span>
              <input value={values.employeeIdPrefix} onChange={(event) => setValues((current) => ({ ...current, employeeIdPrefix: event.target.value.toUpperCase() }))} required minLength={2} maxLength={12} pattern="[A-Z0-9]{2,12}" className="h-11 w-40 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm uppercase text-white outline-none focus:border-accent" />
            </label>
            {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
            {saved && <p role="status" className="flex items-center gap-2 text-sm text-emerald-200"><Check size={15} /> Settings saved.</p>}
            <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button></div>
          </form>
        )}
      </DashboardCard>
      <ActivitySettingsPanel />
      <DashboardCard className="mt-5 max-w-3xl">
        <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-violet-200"><ShieldCheck size={17} /></span><div><h2 className="text-sm font-semibold text-white">Security settings</h2><p className="mt-1 text-xs text-slate-500">Session and password controls are enforced by the authentication policy.</p></div></div>
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div className="rounded-xl border border-white/[0.06] p-3"><dt className="text-slate-500">Session expiration</dt><dd className="mt-1 text-slate-200">8 hours · fixed</dd></div><div className="rounded-xl border border-white/[0.06] p-3"><dt className="text-slate-500">Password protection</dt><dd className="mt-1 text-slate-200">bcrypt · minimum 12 characters · 72 UTF-8 bytes maximum</dd></div></dl>
      </DashboardCard>
    </>
  );
}

interface ActivitySettingsValues {
  checkInIntervalMinutes: (typeof checkInIntervals)[number];
  checkInsEnabled: boolean;
  dailyReportRequired: boolean;
}

const activityDefaults: ActivitySettingsValues = {
  checkInIntervalMinutes: 60,
  checkInsEnabled: true,
  dailyReportRequired: true,
};

function ActivitySettingsPanel() {
  const [values, setValues] = useState<ActivitySettingsValues>(activityDefaults);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/activity/settings", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load activity settings.");
        setValues(result.settings ?? activityDefaults);
      })
      .catch((loadError: unknown) => {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(loadError instanceof Error ? loadError.message : "Could not load activity settings.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/admin/activity/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save activity settings.");
      setValues(result.settings);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save activity settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardCard className="mt-5 max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-violet-200"><Activity size={18} /></span>
        <div><h2 className="text-sm font-semibold text-white">Work activity settings</h2><p className="mt-1 text-xs text-slate-500">Control employee activity check-ins and daily reports.</p></div>
      </div>
      {loading ? <p className="text-sm text-slate-400">Loading activity settings…</p> : (
        <form onSubmit={save} className="space-y-5">
          <label className="block space-y-2 text-sm font-medium text-slate-200">
            Check-in interval
            <span className="block text-xs font-normal text-slate-500">The interval is measured in recorded work time. Breaks pause the schedule; overdue check-ins appear when an employee returns.</span>
            <span className="flex items-center gap-3">
              <Clock3 size={16} className="text-slate-500" />
              <select value={values.checkInIntervalMinutes} onChange={(event) => setValues((current) => ({ ...current, checkInIntervalMinutes: Number(event.target.value) as ActivitySettingsValues["checkInIntervalMinutes"] }))} className="h-11 w-40 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white outline-none focus:border-accent">
                {checkInIntervals.map((interval) => <option key={interval} value={interval}>{interval} minutes</option>)}
              </select>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <input type="checkbox" checked={values.checkInsEnabled} onChange={(event) => setValues((current) => ({ ...current, checkInsEnabled: event.target.checked }))} className="mt-0.5 size-4 accent-violet-500" />
            <span><span className="block text-sm font-medium text-slate-200">Enable activity check-ins</span><span className="mt-1 block text-xs leading-5 text-slate-500">Employees are asked for a short progress update while a work session is open. Responses are not proof of productivity or activity.</span></span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <input type="checkbox" checked={values.dailyReportRequired} onChange={(event) => setValues((current) => ({ ...current, dailyReportRequired: event.target.checked }))} className="mt-0.5 size-4 accent-violet-500" />
            <span><span className="block text-sm font-medium text-slate-200">Require daily work reports</span><span className="mt-1 block text-xs leading-5 text-slate-500">Show the report prompt when an employee ends a work session.</span></span>
          </label>
          {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
          {saved && <p role="status" className="flex items-center gap-2 text-sm text-emerald-200"><Check size={15} /> Activity settings saved.</p>}
          <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save activity settings"}</Button></div>
        </form>
      )}
    </DashboardCard>
  );
}
