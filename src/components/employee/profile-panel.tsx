"use client";

import { useState, type FormEvent } from "react";
import { signOut } from "next-auth/react";
import { Check, KeyRound, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { Input } from "@/components/ui/input";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { AccountStatus, EmployeeRole, EmploymentType } from "@/types/employee";

interface Profile {
  employeeId: string;
  fullName: string;
  email: string;
  role: EmployeeRole;
  designation?: string;
  profilePicture?: string;
  phoneNumber?: string;
  skills: string[];
  employmentType: EmploymentType;
  joiningDate: string;
  status: AccountStatus;
}

export function ProfilePanel({ profile: initial }: { profile: Profile }) {
  const [profile, setProfile] = useState(initial);
  const [fullName, setFullName] = useState(initial.fullName);
  const [phoneNumber, setPhoneNumber] = useState(initial.phoneNumber ?? "");
  const [profilePicture, setProfilePicture] = useState(initial.profilePicture ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage("");
    setProfileError("");
    try {
      const response = await fetch("/api/employee/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phoneNumber, profilePicture }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update your profile.");
      setProfile({ ...profile, ...result.employee });
      setProfileMessage("Your profile has been updated.");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Could not update your profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    if (newPassword.length < 12) {
      setPasswordError("Choose a password with at least 12 characters.");
      return;
    }
    setSavingPassword(true);
    try {
      const response = await fetch("/api/employee/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not change your password.");
      setPasswordMessage("Password updated. Signing you out to protect your account…");
      window.setTimeout(() => void signOut({ callbackUrl: "/login" }), 900);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Could not change your password.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <div className="space-y-6">
        <DashboardCard>
          <div className="mb-6 flex items-center gap-4">
            <UserAvatar name={profile.fullName} src={profile.profilePicture} className="size-14 text-base" />
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-white">{profile.fullName}</h2>
              <p className="mt-1 truncate text-sm text-slate-400">{profile.email}</p>
              <div className="mt-2"><RoleBadge role={profile.role} /></div>
            </div>
          </div>
          <form onSubmit={saveProfile} className="space-y-5">
            <Input label="Full name" name="fullName" autoComplete="name" required maxLength={100} value={fullName} onChange={(event) => setFullName(event.target.value)} />
            <Input label="Work email" name="email" type="email" value={profile.email} disabled />
            <Input label="Phone number" name="phoneNumber" type="tel" autoComplete="tel" maxLength={32} value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
            <Input label="Profile picture URL" name="profilePicture" type="url" maxLength={2048} value={profilePicture} onChange={(event) => setProfilePicture(event.target.value)} />
            {profileError && <p role="alert" className="text-sm text-rose-200">{profileError}</p>}
            {profileMessage && <p role="status" className="flex items-center gap-2 text-sm text-emerald-200"><Check size={15} />{profileMessage}</p>}
            <div className="flex justify-end"><Button type="submit" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save profile"}</Button></div>
          </form>
        </DashboardCard>

        <DashboardCard>
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-violet-200"><KeyRound size={17} /></span>
            <div><h2 className="text-sm font-semibold text-white">Change password</h2><p className="mt-1 text-xs text-slate-500">Changing your password signs out all active sessions.</p></div>
          </div>
          <form onSubmit={changePassword} className="space-y-4">
            <Input label="Current password" name="currentPassword" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            <Input label="New password" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            <Input label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            <p className="-mt-2 text-xs text-slate-500">At least 12 characters, up to 72 UTF-8 bytes.</p>
            {passwordError && <p role="alert" className="text-sm text-rose-200">{passwordError}</p>}
            {passwordMessage && <p role="status" className="text-sm text-emerald-200">{passwordMessage}</p>}
            <div className="flex justify-end"><Button type="submit" variant="secondary" disabled={savingPassword}>{savingPassword ? "Updating…" : "Update password"}</Button></div>
          </form>
        </DashboardCard>
      </div>

      <div className="space-y-6">
        <DashboardCard>
          <div className="mb-5 flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-violet-200"><UserRound size={17} /></span><h2 className="text-sm font-semibold text-white">Work information</h2></div>
          <dl className="space-y-4 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Employee ID</dt><dd className="font-mono text-slate-200">{profile.employeeId}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Designation</dt><dd className="text-right text-slate-200">{profile.designation || "Not provided"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Employment type</dt><dd className="capitalize text-slate-200">{profile.employmentType.replace("_", " ")}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Skills</dt><dd className="max-w-[65%] text-right text-slate-200">{profile.skills.length ? profile.skills.join(", ") : "Not provided"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Joining date</dt><dd className="text-slate-200">{new Date(profile.joiningDate).toLocaleDateString()}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Account status</dt><dd><StatusBadge status={profile.status} /></dd></div>
          </dl>
        </DashboardCard>
        <p className="px-1 text-xs leading-5 text-slate-500">Your role, work email, account status, employee ID, and employment information are managed by an administrator.</p>
      </div>
    </div>
  );
}
