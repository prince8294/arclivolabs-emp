"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeIndianRupee, CircleDollarSign, Gift, WalletCards } from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { PageHeading } from "@/components/ui/page-heading";
import { formatMoney } from "@/lib/hr/money";
import { compensationTypeLabels, paymentStatusLabels, type CompensationType, type PaymentStatus } from "@/types/hr";

interface EarningsData {
  compensation: { compensationType: CompensationType; baseAmountPaise: number; currency: string; effectiveDate: string } | null;
  payments: Array<{ _id: string; periodStart: string; currency: string; baseAmountPaise: number; incentiveTotalPaise: number; adjustments: Array<{ amountPaise: number; reason: string }>; totalPayablePaise: number; status: PaymentStatus; paidAmountPaise?: number; paidAt?: string }>;
  incentives: Array<{ _id: string; title: string; amountPaise: number; currency: string; reason: string; incentiveDate: string; status: string; project?: { name: string } | null; task?: { title: string } | null }>;
  summary: { outstandingByCurrency: Record<string, number>; receivedByCurrency: Record<string, number>; approvedIncentivesByCurrency: Record<string, number> };
}

function monthLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
}

function Breakdown({ values }: { values: Record<string, number> }) {
  const entries = Object.entries(values).filter(([, amount]) => amount !== 0);
  return entries.length ? <span className="flex flex-col gap-1">{entries.map(([currency, amount]) => <span key={currency}>{formatMoney(amount, currency)}</span>)}</span> : <span>—</span>;
}

export function EmployeeEarnings() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/employee/earnings", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load earnings.");
        setData(result);
      })
      .catch((loadError: unknown) => {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(loadError instanceof Error ? loadError.message : "Could not load earnings.");
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <>
      <PageHeading title="My earnings" description="Private compensation and payment records for your account. Amounts are informational internal records, not statutory payslips." />
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
      {!data ? <DashboardCard><p className="text-sm text-slate-400">Loading your earnings…</p></DashboardCard> : <>
        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: "Agreed monthly base pay", value: data.compensation ? formatMoney(data.compensation.baseAmountPaise, data.compensation.currency) : "Not configured", icon: BadgeIndianRupee },
            { label: "Approved incentives", value: <Breakdown values={data.summary.approvedIncentivesByCurrency} />, icon: Gift },
            { label: "Approved payments pending", value: <Breakdown values={data.summary.outstandingByCurrency} />, icon: WalletCards },
            { label: "Recorded payments received", value: <Breakdown values={data.summary.receivedByCurrency} />, icon: CircleDollarSign },
          ].map(({ label, value, icon: Icon }) => <DashboardCard key={label} className="p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-slate-400">{label}</p><Icon size={16} className="text-violet-200" /></div><p className="mt-4 text-sm font-semibold text-white">{value}</p>{label === "Agreed monthly base pay" && data.compensation && <p className="mt-2 text-[10px] text-slate-500">{compensationTypeLabels[data.compensation.compensationType]} · effective {formatDate(data.compensation.effectiveDate)}</p>}</DashboardCard>)}
        </div>
        <DashboardCard className="mb-5 p-0">
          <div className="border-b border-white/[0.06] px-5 py-4"><h2 className="text-sm font-semibold text-white">Payment history</h2><p className="mt-1 text-xs text-slate-500">A paid status means an administrator recorded an external payment.</p></div>
          {data.payments.length ? <div className="divide-y divide-white/[0.05]">{data.payments.map((payment) => <Link key={payment._id} href={`/employee/earnings/${payment._id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 transition hover:bg-white/[0.02]"><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-200">{monthLabel(payment.periodStart)}</span><span className="mt-1 block text-xs text-slate-500">Base {formatMoney(payment.baseAmountPaise, payment.currency)} · incentives {formatMoney(payment.incentiveTotalPaise, payment.currency)}</span></span><span className="text-right"><span className="block text-sm font-semibold text-white">{formatMoney(payment.totalPayablePaise, payment.currency)}</span><span className={`mt-1 block text-xs ${payment.status === "paid" ? "text-emerald-200" : "text-sky-200"}`}>{paymentStatusLabels[payment.status]}</span></span><span className="w-full text-right text-xs text-slate-500 sm:w-auto">{payment.paidAt ? `Paid ${formatDate(payment.paidAt)}` : "Not yet recorded paid"}</span></Link>)}</div> : <div className="px-6 py-10 text-center"><p className="text-sm text-slate-300">No approved payment records yet</p><p className="mt-1 text-xs text-slate-500">Approved monthly payment history will appear here.</p></div>}
        </DashboardCard>
        <DashboardCard className="p-0">
          <div className="border-b border-white/[0.06] px-5 py-4"><h2 className="text-sm font-semibold text-white">Incentive history</h2><p className="mt-1 text-xs text-slate-500">Status and amount are set by an administrator.</p></div>
          {data.incentives.length ? <div className="divide-y divide-white/[0.05]">{data.incentives.map((incentive) => <div key={incentive._id} className="flex flex-wrap items-center gap-3 px-5 py-4"><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-200">{incentive.title}</span><span className="mt-1 block text-xs text-slate-500">{formatDate(incentive.incentiveDate)} · {incentive.reason}{incentive.project?.name ? ` · ${incentive.project.name}` : ""}{incentive.task?.title ? ` · ${incentive.task.title}` : ""}</span></span><span className="text-sm font-semibold text-white">{formatMoney(incentive.amountPaise, incentive.currency)}</span><span className={`text-xs capitalize ${incentive.status === "approved" ? "text-emerald-200" : incentive.status === "pending" ? "text-amber-200" : "text-slate-400"}`}>{incentive.status}</span></div>)}</div> : <p className="px-5 py-8 text-center text-sm text-slate-500">No incentives recorded.</p>}
        </DashboardCard>
      </>}
    </>
  );
}
