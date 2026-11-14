"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { PageHeading } from "@/components/ui/page-heading";
import { formatMoney } from "@/lib/hr/money";
import { compensationTypeLabels, paymentMethodLabels, paymentStatusLabels, type CompensationType, type PaymentMethod, type PaymentStatus } from "@/types/hr";

interface PaymentDetailsData {
  payment: {
    _id: string;
    employee: { _id?: string; employeeId: string; fullName: string } | null;
    periodStart: string;
    periodEnd: string;
    currency: string;
    compensation?: { compensationType: CompensationType; effectiveDate: string; notes?: string } | null;
    baseAmountPaise: number;
    incentives: Array<{ title: string; amountPaise: number; incentive?: { reason?: string; incentiveDate?: string } | null }>;
    incentiveTotalPaise: number;
    adjustments: Array<{ amountPaise: number; reason: string; authorizedBy?: string }>;
    totalPayablePaise: number;
    status: PaymentStatus;
    paidAmountPaise?: number;
    reversedAmountPaise?: number;
    paidAt?: string;
    paymentMethod?: PaymentMethod;
    transactionReference?: string;
    paymentNotes?: string;
    auditLog?: Array<{ action: string; actor: string; reason?: string; previousValue?: unknown; newValue?: unknown; createdAt: string }>;
  };
  reversals: Array<{ _id: string; amountPaise: number; reason: string; createdAt: string; recordedBy?: { fullName: string } | null }>;
}

function monthLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" }) : "—";
}

async function responseJson(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not load payment details.");
  return result;
}

export function PaymentDetails({ paymentId, admin }: { paymentId: string; admin: boolean }) {
  const [data, setData] = useState<PaymentDetailsData | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const endpoint = admin ? `/api/admin/payments/${paymentId}` : `/api/employee/earnings/${paymentId}`;

  const load = useCallback(async () => {
    setData(await responseJson(await fetch(endpoint, { cache: "no-store" })));
  }, [endpoint]);

  useEffect(() => {
    void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load payment details."));
  }, [load]);

  async function submitReversal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!admin || !data) return;
    setBusy(true);
    setError("");
    setNotice("");
    const key = idempotencyKey || crypto.randomUUID();
    setIdempotencyKey(key);
    try {
      await responseJson(await fetch(`/api/admin/payments/${paymentId}/reversals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason, idempotencyKey: key }),
      }));
      setAmount("");
      setReason("");
      setIdempotencyKey("");
      setNotice("Audited reversal recorded. The original paid record was not changed.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not record reversal.");
    } finally {
      setBusy(false);
    }
  }

  const payment = data?.payment;
  return (
    <>
      <div className="mb-5"><Link href={admin ? "/admin/payments" : "/employee/earnings"} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} />{admin ? "Payments" : "My earnings"}</Link></div>
      {error && <p role="alert" className="mb-4 flex gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"><AlertCircle size={16} />{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200">{notice}</p>}
      {!payment ? <DashboardCard><p className="text-sm text-slate-400">Loading payment summary…</p></DashboardCard> : <>
        <PageHeading title="Payment summary" description="Internal record only. This is not a statutory payslip and no money is transferred by this portal." />
        <DashboardCard className="mx-auto max-w-3xl">
          <div className="border-b border-white/[0.06] pb-5 text-center"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">ArclivoLabs</p><h2 className="mt-2 text-xl font-semibold text-white">Payment summary</h2><p className="mt-1 text-sm text-slate-400">{monthLabel(payment.periodStart)}</p></div>
          <div className="grid gap-4 border-b border-white/[0.06] py-5 sm:grid-cols-2"><div><p className="text-xs text-slate-500">Employee</p><p className="mt-1 text-sm font-medium text-white">{payment.employee?.fullName ?? "Employee"}</p><p className="mt-1 text-xs text-slate-400">{payment.employee?.employeeId ?? ""}</p></div><div><p className="text-xs text-slate-500">Payment status</p><p className={`mt-1 text-sm font-semibold ${payment.status === "paid" ? "text-emerald-200" : payment.status === "approved" ? "text-sky-200" : "text-amber-200"}`}>{paymentStatusLabels[payment.status]}</p>{payment.paidAt && <p className="mt-1 text-xs text-slate-400">Paid {formatDate(payment.paidAt)}</p>}</div><div><p className="text-xs text-slate-500">Compensation type</p><p className="mt-1 text-sm text-slate-200">{payment.compensation ? compensationTypeLabels[payment.compensation.compensationType] : "Agreed compensation"}</p></div><div><p className="text-xs text-slate-500">Base pay</p><p className="mt-1 text-sm text-white">{formatMoney(payment.baseAmountPaise, payment.currency)}</p></div></div>
          <div className="space-y-3 border-b border-white/[0.06] py-5"><div className="flex justify-between gap-4 text-sm"><span className="text-slate-400">Base pay</span><span className="text-white">{formatMoney(payment.baseAmountPaise, payment.currency)}</span></div>{payment.incentives.map((incentive, index) => <div key={`${incentive.title}-${index}`} className="flex justify-between gap-4 text-sm"><span className="text-slate-400">Incentive · {incentive.title}</span><span className="text-white">{formatMoney(incentive.amountPaise, payment.currency)}</span></div>)}{payment.adjustments.map((adjustment, index) => <div key={`${adjustment.reason}-${index}`} className="flex justify-between gap-4 text-sm"><span className="min-w-0 text-slate-400">Adjustment · {adjustment.reason}</span><span className="whitespace-nowrap text-white">{formatMoney(adjustment.amountPaise, payment.currency)}</span></div>)}<div className="flex justify-between gap-4 border-t border-white/[0.06] pt-4 text-base font-semibold"><span className="text-white">Total payable</span><span className="text-white">{formatMoney(payment.totalPayablePaise, payment.currency)}</span></div></div>
          {payment.status === "paid" && <div className="grid gap-3 py-5 text-sm sm:grid-cols-2"><p><span className="block text-xs text-slate-500">Amount recorded paid</span><span className="mt-1 block text-white">{formatMoney(payment.paidAmountPaise ?? 0, payment.currency)}</span></p><p><span className="block text-xs text-slate-500">Method</span><span className="mt-1 block text-white">{payment.paymentMethod ? paymentMethodLabels[payment.paymentMethod] : "—"}</span></p><p><span className="block text-xs text-slate-500">Transaction reference</span><span className="mt-1 block break-all text-white">{payment.transactionReference || "—"}</span></p><p><span className="block text-xs text-slate-500">Payment notes</span><span className="mt-1 block text-white">{payment.paymentNotes || "—"}</span></p></div>}
          <p className="pt-4 text-[11px] leading-5 text-slate-500">Amounts reflect documented compensation, approved incentives, and authorized adjustments only. Recorded attendance, check-ins, task status, and reports are not used to deduct pay.</p>
        </DashboardCard>
        {data.reversals.length > 0 && <DashboardCard className="mx-auto mt-5 max-w-3xl"><h2 className="text-sm font-semibold text-white">Audited reversals</h2><div className="mt-3 space-y-3">{data.reversals.map((reversal) => <div key={reversal._id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] p-3 text-xs"><RotateCcw size={14} className="text-amber-200" /><span className="min-w-0 flex-1 text-slate-300">{reversal.reason}</span><span className="text-white">{formatMoney(reversal.amountPaise, payment.currency)}</span><span className="text-slate-500">{formatDate(reversal.createdAt)}{admin ? ` · ${reversal.recordedBy?.fullName ?? "Admin"}` : ""}</span></div>)}</div></DashboardCard>}
        {admin && payment.auditLog && <DashboardCard className="mx-auto mt-5 max-w-3xl"><h2 className="text-sm font-semibold text-white">Payment audit history</h2><div className="mt-3 space-y-2">{payment.auditLog.map((entry, index) => <div key={`${entry.action}-${index}`} className="flex flex-wrap justify-between gap-2 rounded-lg border border-white/[0.05] p-3 text-xs"><span className="text-slate-300">{entry.action.replaceAll("_", " ")}{entry.reason ? ` · ${entry.reason}` : ""}</span><span className="text-slate-500">{formatDate(entry.createdAt)}</span></div>)}</div></DashboardCard>}
        {admin && payment.status === "paid" && (payment.paidAmountPaise ?? 0) > (payment.reversedAmountPaise ?? 0) && <DashboardCard className="mx-auto mt-5 max-w-3xl"><div className="mb-3 flex items-center gap-2"><RotateCcw size={16} className="text-amber-200" /><h2 className="text-sm font-semibold text-white">Record an audited reversal</h2></div><p className="mb-4 text-xs leading-5 text-slate-500">This preserves the original paid record and adds a separate reasoned reversal. It does not initiate a bank transfer.</p><form onSubmit={(event) => void submitReversal(event)} className="grid gap-3 sm:grid-cols-3"><label className="space-y-1.5 text-xs text-slate-400">Amount<input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label><label className="space-y-1.5 text-xs text-slate-400 sm:col-span-2">Reason<input required minLength={5} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label><div className="sm:col-span-3"><Button type="submit" disabled={busy}><RotateCcw size={14} />{busy ? "Recording…" : "Record reversal"}</Button></div></form></DashboardCard>}
      </>}
    </>
  );
}
