"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ClipboardList, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { PageHeading } from "@/components/ui/page-heading";
import { RoleBadge } from "@/components/ui/role-badge";
import { leaveStatusLabels, leaveTypeLabels, type LeaveType, type LeaveStatus } from "@/types/hr";

interface LeaveEmployee {
  employeeId: string;
  fullName: string;
  role: "developer" | "designer";
  designation?: string;
}

interface LeaveRequestItem {
  _id: string;
  employee: LeaveEmployee | null;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  notes: string;
  status: LeaveStatus;
  adminRemarks: string;
  createdAt: string;
}

interface LeavesData {
  requests: LeaveRequestItem[];
  summary: { pending: number; approved: number; rejected: number };
  pagination: { page: number; limit: number; total: number; pages: number };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
}

async function responseJson(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not load leave requests.");
  return result;
}

export function AdminLeaves() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LeavesData | null>(null);
  const [selected, setSelected] = useState<LeaveRequestItem | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page) });
    if (status) query.set("status", status);
    setError("");
    setData(await responseJson(await fetch(`/api/admin/leaves?${query}`, { cache: "no-store" })));
  }, [page, status]);

  useEffect(() => {
    void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load leave requests."));
  }, [load]);

  function openReview(request: LeaveRequestItem, nextDecision: "approve" | "reject") {
    setSelected(request);
    setDecision(nextDecision);
    setRemarks(request.adminRemarks ?? "");
  }

  async function submitReview() {
    if (!selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await responseJson(await fetch(`/api/admin/leaves/${selected._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, adminRemarks: remarks }),
      }));
      setNotice(`Leave request ${decision === "approve" ? "approved" : "rejected"}.`);
      setSelected(null);
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review leave request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading title="Leave requests" description="Review employee leave requests. Durations use inclusive UTC calendar days; no requests are approved automatically." />
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200">{notice}</p>}
      {!data ? <DashboardCard><p className="text-sm text-slate-400">Loading leave requests…</p></DashboardCard> : <>
        <div className="mb-5 grid grid-cols-3 gap-3">
          {[["Pending requests", data.summary.pending, "text-amber-200"], ["Approved requests", data.summary.approved, "text-emerald-200"], ["Rejected requests", data.summary.rejected, "text-slate-300"]].map(([label, count, color]) => <DashboardCard key={String(label)} className="p-4 sm:p-5"><p className="text-xs text-slate-400">{label}</p><p className={`mt-3 text-2xl font-semibold ${color}`}>{count}</p></DashboardCard>)}
        </div>
        <DashboardCard className="p-0">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] p-4 sm:px-5">
            <label className="space-y-1.5 text-xs text-slate-400">Request status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-10 w-48 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white"><option value="">All requests</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select></label>
            <span className="text-xs text-slate-500">{data.pagination.total} requests</span>
          </div>
          {data.requests.length ? <div className="divide-y divide-white/[0.05]">
            {data.requests.map((request) => <div key={request._id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(180px,1.2fr)_minmax(130px,0.8fr)_minmax(150px,1fr)_minmax(140px,0.9fr)_minmax(130px,0.8fr)_auto] sm:items-center sm:px-5">
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-200">{request.employee?.fullName ?? "Employee unavailable"}</span><span className="mt-1 block text-xs text-slate-500">{request.employee?.employeeId ?? "—"} · {request.employee?.designation ?? ""}</span></span>
              <span className="flex items-center gap-2 text-xs text-slate-300"><RoleBadge role={request.employee?.role ?? "developer"} />{leaveTypeLabels[request.leaveType]}</span>
              <span className="text-xs text-slate-400">{formatDate(request.startDate)} – {formatDate(request.endDate)}<span className="mt-1 block text-slate-500">{request.totalDays} calendar day{request.totalDays === 1 ? "" : "s"}</span></span>
              <span className="min-w-0 text-xs text-slate-400"><span className="block truncate">{request.reason}</span>{request.notes && <span className="mt-1 block truncate text-slate-500">{request.notes}</span>}</span>
              <span className={`text-xs ${request.status === "approved" ? "text-emerald-200" : request.status === "pending" ? "text-amber-200" : "text-slate-400"}`}>{leaveStatusLabels[request.status]}</span>
              {request.status === "pending" ? <span className="flex gap-2"><Button size="sm" onClick={() => openReview(request, "approve")}><Check size={13} />Approve</Button><Button size="sm" variant="secondary" onClick={() => openReview(request, "reject")}><X size={13} />Reject</Button></span> : <span className="text-xs text-slate-500">{request.adminRemarks || "—"}</span>}
            </div>)}
          </div> : <div className="px-6 py-12 text-center"><ClipboardList className="mx-auto text-slate-600" size={20} /><p className="mt-3 text-sm text-slate-300">No leave requests match this filter</p><p className="mt-1 text-xs text-slate-500">New employee requests will appear here.</p></div>}
          <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3 text-xs text-slate-500 sm:px-5"><span>Page {page} of {Math.max(1, data.pagination.pages)}</span><span className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page" className="rounded border border-white/10 p-1.5 disabled:opacity-30"><ChevronLeft size={15} /></button><button type="button" disabled={page >= data.pagination.pages} onClick={() => setPage((value) => value + 1)} aria-label="Next page" className="rounded border border-white/10 p-1.5 disabled:opacity-30"><ChevronRight size={15} /></button></span></div>
        </DashboardCard>
      </>}
      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><section role="dialog" aria-modal="true" aria-labelledby="leave-review-title" className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111827] p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><h2 id="leave-review-title" className="text-lg font-semibold text-white">{decision === "approve" ? "Approve leave" : "Reject leave"}</h2><p className="mt-1 text-sm text-slate-400">{selected.employee?.fullName} · {leaveTypeLabels[selected.leaveType]} · {selected.totalDays} calendar days</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Close review dialog" className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"><X size={16} /></button></div><label className="mt-5 block space-y-2 text-sm text-slate-300">Admin remarks (optional)<textarea maxLength={2000} value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={4} className="w-full rounded-xl border border-white/10 bg-[#0B0F19] px-3 py-2.5 text-sm text-white outline-none focus:border-accent" /></label><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button><Button disabled={busy} onClick={() => void submitReview()}>{busy ? "Saving…" : decision === "approve" ? "Confirm approval" : "Confirm rejection"}</Button></div></section></div>}
    </>
  );
}
