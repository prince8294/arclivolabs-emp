"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, Pencil, RefreshCw, UserRoundX, UserRoundCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import type { AccountStatus } from "@/types/employee";

export function EmployeeActions({
  id,
  name,
  employeeId,
  status,
  accountSetupCompleted,
}: {
  id: string;
  name: string;
  employeeId: string;
  status: AccountStatus;
  accountSetupCompleted: boolean;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [invitationUrl, setInvitationUrl] = useState("");

  async function copyEmployeeId() {
    try {
      await navigator.clipboard.writeText(employeeId);
      setCopied(true);
    } catch {
      setError("Could not copy the employee ID.");
    }
  }

  async function updateStatus() {
    setBusy(true);
    setError("");
    try {
      const nextStatus = status === "active" ? "inactive" : "active";
      const response = await fetch(`/api/admin/employees/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update account status.");
      setDialogOpen(false);
      router.refresh();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Could not update account status.");
    } finally {
      setBusy(false);
    }
  }

  async function generateInvite() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/employees/${id}/invite`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not create an invitation.");
      setInvitationUrl(result.invitationUrl);
      await navigator.clipboard.writeText(result.invitationUrl);
      setMessage("A new setup link was created and copied. Previous setup links have been invalidated.");
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Could not create an invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setMessage("Setup link copied.");
      setError("");
    } catch {
      setError("Could not copy the setup link. Select and copy the link manually.");
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Link href={`/admin/employees/${id}/edit`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/4 px-4 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/8">
          <Pencil size={15} /> Edit employee
        </Link>
        <Button type="button" variant="secondary" onClick={() => void copyEmployeeId()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied ID" : "Copy employee ID"}</Button>
        {accountSetupCompleted ? (
          <Button type="button" variant="secondary" onClick={() => setDialogOpen(true)} disabled={busy}>
            {status === "active" ? <UserRoundX size={15} /> : <UserRoundCheck size={15} />}
            {status === "active" ? "Deactivate" : "Activate"}
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={() => void generateInvite()} disabled={busy}>
            <RefreshCw size={15} /> {busy ? "Creating link…" : "Regenerate setup link"}
          </Button>
        )}
      </div>
      {message && <p role="status" className="mt-3 text-sm text-emerald-200">{message}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}
      {invitationUrl && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input readOnly value={invitationUrl} aria-label="Employee account setup link" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-canvas px-3 py-2 text-xs text-slate-300 outline-none" />
          <Button type="button" size="sm" variant="secondary" onClick={() => void copyInvitation()}>Copy link</Button>
        </div>
      )}
      <ConfirmationDialog
        open={dialogOpen}
        title={status === "active" ? "Deactivate employee?" : "Activate employee?"}
        description={status === "active"
          ? `${name} will be signed out and will no longer be able to access the employee portal.`
          : `${name} will be able to sign in to the employee portal.`}
        confirmLabel={busy ? "Updating…" : status === "active" ? "Deactivate" : "Activate"}
        onCancel={() => { if (!busy) setDialogOpen(false); }}
        onConfirm={() => void updateStatus()}
      />
    </>
  );
}
