"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeading } from "@/components/ui/page-heading";
import type { EmployeeRole, EmploymentType } from "@/types/employee";

export interface EmployeeFormData {
  _id: string;
  fullName: string;
  email: string;
  role: EmployeeRole;
  designation?: string;
  joiningDate: string;
  phoneNumber?: string;
  profilePicture?: string;
  skills?: string[];
  employmentType?: EmploymentType;
  internalNotes?: string;
}

export function EmployeeForm({ employee }: { employee?: EmployeeFormData }) {
  const editing = Boolean(employee);
  const [fullName, setFullName] = useState(employee?.fullName ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [role, setRole] = useState<"developer" | "designer">(employee?.role === "designer" ? "designer" : "developer");
  const [designation, setDesignation] = useState(employee?.designation ?? "");
  const [joiningDate, setJoiningDate] = useState(employee?.joiningDate ? new Date(employee.joiningDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [phoneNumber, setPhoneNumber] = useState(employee?.phoneNumber ?? "");
  const [profilePicture, setProfilePicture] = useState(employee?.profilePicture ?? "");
  const [skills, setSkills] = useState(employee?.skills?.join(", ") ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentType>(employee?.employmentType ?? "full_time");
  const [internalNotes, setInternalNotes] = useState(employee?.internalNotes ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [invitationUrl, setInvitationUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const joiningAt = new Date(`${joiningDate}T00:00:00`);
    if (Number.isNaN(joiningAt.getTime())) {
      setError("Enter a valid joining date.");
      return;
    }
    setBusy(true);
    const body = {
      fullName,
      email,
      role,
      designation,
      joiningDate: joiningAt.toISOString(),
      phoneNumber,
      profilePicture,
      skills: skills.split(",").map((skill) => skill.trim()).filter(Boolean),
      employmentType,
      internalNotes,
    };
    try {
      const response = await fetch(editing ? `/api/admin/employees/${employee?._id}` : "/api/admin/employees", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.employee?.id && !editing) {
          window.location.assign(`/admin/employees/${result.employee.id}`);
          return;
        }
        throw new Error(result.error ?? "The employee could not be saved.");
      }
      if (editing) {
        window.location.assign(`/admin/employees/${employee?._id}`);
      } else {
        setInvitationUrl(result.invitationUrl);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The employee could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
    } catch {
      setError("Could not copy the setup link. Select and copy the link manually.");
    }
  }

  if (invitationUrl) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeading title="Employee created" description="Share this one-time account setup link with the employee. It will only be shown here and cannot be retrieved later." />
        <section className="rounded-2xl border border-emerald-400/15 bg-emerald-400/4 p-5 sm:p-7">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-200"><Link2 size={19} /></div>
          <h2 className="mt-4 text-base font-semibold text-white">Copy the setup invitation</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">The employee account remains Pending Setup until the recipient chooses a password. The link expires based on your employee settings.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input readOnly value={invitationUrl} aria-label="Employee account setup link" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-canvas px-3 py-3 text-xs text-slate-300 outline-none" />
            <Button type="button" onClick={() => void copyInvitation()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy link"}</Button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}
          <p className="mt-4 text-xs text-amber-200/80">Treat this link as a secret. It grants the ability to set up this employee account.</p>
          <Link href="/admin/employees" className="mt-6 inline-flex text-sm font-medium text-violet-200 hover:text-white">Return to employees <ArrowLeft size={15} className="ml-2 rotate-180" /></Link>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={editing ? `/admin/employees/${employee?._id}` : "/admin/employees"} className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} /> Back</Link>
      <PageHeading
        title={editing ? "Edit employee" : "Add employee"}
        description={editing ? "Update employee information. Super Admin accounts cannot be edited here." : "Create a Developer or Designer account and generate a one-time setup invitation."}
      />
      <form onSubmit={submit} className="space-y-6">
        <section className="grid gap-5 rounded-2xl border border-white/6 bg-panel p-5 sm:grid-cols-2 sm:p-6">
          <Input label="Full name" name="fullName" autoComplete="name" required maxLength={100} value={fullName} onChange={(event) => setFullName(event.target.value)} />
          <Input label="Email address" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
          <label className="block space-y-2 text-sm font-medium text-slate-200">
            Role
            <select value={role} onChange={(event) => setRole(event.target.value as "developer" | "designer")} className="h-12 w-full rounded-xl border border-white/10 bg-sidebar px-4 text-sm font-normal text-white outline-none focus:border-accent">
              <option value="developer">Web Developer</option><option value="designer">Designer</option>
            </select>
          </label>
          <Input label="Designation" name="designation" required maxLength={80} placeholder={role === "developer" ? "e.g. Frontend Developer" : "e.g. Product Designer"} value={designation} onChange={(event) => setDesignation(event.target.value)} />
          <Input label="Joining date" name="joiningDate" type="date" required value={joiningDate} onChange={(event) => setJoiningDate(event.target.value)} />
          <Input label="Phone number (optional)" name="phoneNumber" type="tel" autoComplete="tel" maxLength={32} value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
          <Input label="Profile picture URL (optional)" name="profilePicture" type="url" maxLength={2048} value={profilePicture} onChange={(event) => setProfilePicture(event.target.value)} />
          <label className="block space-y-2 text-sm font-medium text-slate-200">
            Employment type
            <select value={employmentType} onChange={(event) => setEmploymentType(event.target.value as EmploymentType)} className="h-12 w-full rounded-xl border border-white/10 bg-sidebar px-4 text-sm font-normal text-white outline-none focus:border-accent">
              <option value="full_time">Full-Time</option><option value="part_time">Part-Time</option><option value="intern">Intern</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-200 sm:col-span-2">
            Skills <span className="font-normal text-slate-500">(optional, separated by commas)</span>
            <input value={skills} onChange={(event) => setSkills(event.target.value)} maxLength={1200} placeholder="React, TypeScript, UI design" className="h-12 w-full rounded-xl border border-white/10 bg-sidebar px-4 text-sm font-normal text-white outline-none placeholder:text-slate-500 focus:border-accent" />
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-200 sm:col-span-2">
            Internal notes <span className="font-normal text-slate-500">(optional, admin only)</span>
            <textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} maxLength={2000} rows={3} className="w-full resize-y rounded-xl border border-white/10 bg-sidebar px-4 py-3 text-sm font-normal text-white outline-none placeholder:text-slate-500 focus:border-accent" />
          </label>
        </section>
        {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
        <div className="flex justify-end gap-3">
          <Link href={editing ? `/admin/employees/${employee?._id}` : "/admin/employees"} className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm font-medium text-slate-300 hover:bg-white/5">Cancel</Link>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create & generate invite"}</Button>
        </div>
      </form>
    </div>
  );
}
