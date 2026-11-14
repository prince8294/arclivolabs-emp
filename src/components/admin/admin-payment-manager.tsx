"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, BadgeIndianRupee, Check, ChevronRight, CircleDollarSign, Gift, Plus, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { PageHeading } from "@/components/ui/page-heading";
import { formatMoney, moneyInputValue } from "@/lib/hr/money";
import {
  compensationTypeLabels,
  incentiveStatusLabels,
  paymentMethodLabels,
  paymentStatusLabels,
  type CompensationType,
  type IncentiveStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "@/types/hr";

interface EmployeeOption {
  _id: string;
  employeeId: string;
  fullName: string;
  role: "developer" | "designer";
  designation?: string;
  compensation?: { _id?: string; compensationType: CompensationType; baseAmountPaise: number; currency: string; effectiveDate: string } | null;
}

interface PaymentRow {
  _id: string;
  employee: EmployeeOption | null;
  periodStart: string;
  currency: string;
  baseAmountPaise: number;
  incentiveTotalPaise: number;
  adjustments: Array<{ amountPaise: number; reason: string }>;
  totalPayablePaise: number;
  status: PaymentStatus;
  paidAt?: string;
}

interface CompensationRow {
  _id: string;
  employee: EmployeeOption | null;
  compensationType: CompensationType;
  baseAmountPaise: number;
  currency: string;
  effectiveDate: string;
  notes: string;
}

interface ProjectOption { _id: string; name: string; projectId: string }
interface TaskOption { _id: string; title: string; taskId: string; project: string; assignedTo: string }

interface IncentiveRow {
  _id: string;
  employee: EmployeeOption | null;
  project?: { name: string } | null;
  task?: { title: string } | null;
  title: string;
  amountPaise: number;
  currency: string;
  reason: string;
  incentiveDate: string;
  status: IncentiveStatus;
  paymentRecord?: string;
}

interface PaymentData {
  records: PaymentRow[];
  employees: EmployeeOption[];
  summary: {
    approvedPayableByCurrency: Record<string, number>;
    pendingPayments: number;
    paidThisMonthByCurrency: Record<string, number>;
    approvedIncentivesByCurrency: Record<string, number>;
  };
}

interface IncentiveData {
  records: IncentiveRow[];
  employees: EmployeeOption[];
  projects: ProjectOption[];
  tasks: TaskOption[];
}

const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);
const currencyOptions = ["INR", "USD", "EUR", "GBP"];

function monthName(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
}

async function responseJson(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "The request could not be completed.");
  return result;
}

function MoneyBreakdown({ values }: { values: Record<string, number> }) {
  const items = Object.entries(values).filter(([, amount]) => amount !== 0);
  return items.length ? <span className="flex flex-col gap-1">{items.map(([currency, amount]) => <span key={currency}>{formatMoney(amount, currency)}</span>)}</span> : <span>—</span>;
}

export function AdminPaymentManager() {
  const [period, setPeriod] = useState(currentMonth);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [compensationData, setCompensationData] = useState<{ employees: EmployeeOption[]; records: CompensationRow[] } | null>(null);
  const [incentiveData, setIncentiveData] = useState<IncentiveData | null>(null);
  const [tab, setTab] = useState<"payments" | "compensation" | "incentives">("payments");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("0.00");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [compEmployee, setCompEmployee] = useState("");
  const [compType, setCompType] = useState<CompensationType>("monthly_fixed");
  const [compAmount, setCompAmount] = useState("");
  const [compCurrency, setCompCurrency] = useState("INR");
  const [compDate, setCompDate] = useState(today);
  const [compNotes, setCompNotes] = useState("");
  const [incEmployee, setIncEmployee] = useState("");
  const [incProject, setIncProject] = useState("");
  const [incTask, setIncTask] = useState("");
  const [incTitle, setIncTitle] = useState("");
  const [incAmount, setIncAmount] = useState("");
  const [incCurrency, setIncCurrency] = useState("INR");
  const [incDate, setIncDate] = useState(today);
  const [incReason, setIncReason] = useState("");
  const [paidPayment, setPaidPayment] = useState<PaymentRow | null>(null);
  const [paidAmount, setPaidAmount] = useState("");
  const [paidDate, setPaidDate] = useState(today);
  const [paidMethod, setPaidMethod] = useState<PaymentMethod>("bank_transfer");
  const [paidReference, setPaidReference] = useState("");
  const [paidNotes, setPaidNotes] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [payments, compensations, incentives] = await Promise.all([
      responseJson(await fetch(`/api/admin/payments?period=${period}`, { cache: "no-store" })),
      responseJson(await fetch("/api/admin/compensations", { cache: "no-store" })),
      responseJson(await fetch("/api/admin/incentives", { cache: "no-store" })),
    ]);
    setPaymentData(payments);
    setCompensationData(compensations);
    setIncentiveData(incentives);
    setSelectedEmployee((current) => current || payments.employees[0]?._id || "");
    setCompEmployee((current) => current || compensations.employees[0]?._id || "");
    setIncEmployee((current) => current || incentives.employees[0]?._id || "");
  }, [period]);

  useEffect(() => {
    void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load compensation and payments."));
  }, [load]);

  const filteredTasks = useMemo(
    () => incentiveData?.tasks.filter((task) => !incProject || task.project === incProject) ?? [],
    [incentiveData?.tasks, incProject],
  );
  const selectedCompEmployee = compensationData?.employees.find((employee) => employee._id === compEmployee);

  async function createPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("payment");
    setError("");
    setNotice("");
    try {
      await responseJson(await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedEmployee, period, adjustmentAmount, adjustmentReason }),
      }));
      setAdjustmentAmount("0.00");
      setAdjustmentReason("");
      setNotice("Payment draft created. It is not marked paid.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create payment draft.");
    } finally {
      setBusy("");
    }
  }

  async function saveCompensation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("compensation");
    setError("");
    setNotice("");
    try {
      await responseJson(await fetch("/api/admin/compensations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: compEmployee, compensationType: compType, baseAmount: compAmount, currency: compCurrency, effectiveDate: compDate, notes: compNotes }),
      }));
      setCompAmount("");
      setCompNotes("");
      setNotice("Agreed compensation saved as a new effective-dated record.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save compensation.");
    } finally {
      setBusy("");
    }
  }

  async function saveIncentive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("incentive");
    setError("");
    setNotice("");
    try {
      await responseJson(await fetch("/api/admin/incentives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: incEmployee, projectId: incProject, taskId: incTask, title: incTitle, amount: incAmount, currency: incCurrency, reason: incReason, date: incDate }),
      }));
      setIncTitle("");
      setIncAmount("");
      setIncReason("");
      setIncTask("");
      setNotice("Incentive created as pending. It is not automatically awarded or included in a payment until approved.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create incentive.");
    } finally {
      setBusy("");
    }
  }

  async function reviewIncentive(incentive: IncentiveRow, action: "approved" | "cancelled") {
    setBusy(incentive._id);
    setError("");
    setNotice("");
    try {
      await responseJson(await fetch(`/api/admin/incentives/${incentive._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: action === "cancelled" ? "Cancelled by Super Admin." : "" }),
      }));
      setNotice(`Incentive ${action}.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update incentive.");
    } finally {
      setBusy("");
    }
  }

  async function approvePayment(payment: PaymentRow) {
    setBusy(payment._id);
    setError("");
    setNotice("");
    try {
      await responseJson(await fetch(`/api/admin/payments/${payment._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      }));
      setNotice("Payment approved. Record the external payment separately when paid.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not approve payment.");
    } finally {
      setBusy("");
    }
  }

  function openPaidForm(payment: PaymentRow) {
    setPaidPayment(payment);
    setPaidAmount(moneyInputValue(payment.totalPayablePaise));
    setPaidDate(today);
    setPaidMethod("bank_transfer");
    setPaidReference("");
    setPaidNotes("");
  }

  async function markPaid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paidPayment) return;
    setBusy("paid");
    setError("");
    try {
      await responseJson(await fetch(`/api/admin/payments/${paidPayment._id}/paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountPaid: paidAmount, paymentDate: paidDate, paymentMethod: paidMethod, transactionReference: paidReference, notes: paidNotes }),
      }));
      setPaidPayment(null);
      setNotice("External payment recorded as paid.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not record payment.");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeading title="Payments & incentives" description="Configure agreed compensation, review incentives, and record monthly payments made externally. This is not a payroll-compliance or money-transfer system." />
      {error && <p role="alert" className="mb-4 flex gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"><AlertCircle size={16} className="shrink-0" />{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200">{notice}</p>}
      {!paymentData || !compensationData || !incentiveData ? <DashboardCard><p className="text-sm text-slate-400">Loading payment records…</p></DashboardCard> : <>
        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: "Total approved payable", value: <MoneyBreakdown values={paymentData.summary.approvedPayableByCurrency} />, icon: CircleDollarSign },
            { label: "Pending payments", value: paymentData.summary.pendingPayments, icon: WalletCards },
            { label: "Recorded paid this month", value: <MoneyBreakdown values={paymentData.summary.paidThisMonthByCurrency} />, icon: Check },
            { label: "Approved incentives", value: <MoneyBreakdown values={paymentData.summary.approvedIncentivesByCurrency} />, icon: Gift },
          ].map(({ label, value, icon: Icon }) => <DashboardCard key={label} className="p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-slate-400">{label}</p><Icon size={16} className="text-violet-200" /></div><p className="mt-4 text-sm font-semibold text-white">{value}</p></DashboardCard>)}
        </div>
        <div className="mb-5 flex flex-wrap gap-2 border-b border-white/[0.06]">
          {([["payments", "Monthly payments"], ["compensation", "Compensation"], ["incentives", "Incentives"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`border-b-2 px-4 py-3 text-sm font-medium transition ${tab === value ? "border-accent text-white" : "border-transparent text-slate-500 hover:text-slate-200"}`}>{label}</button>)}
        </div>

        {tab === "payments" && <>
          <DashboardCard className="mb-5">
            <div className="mb-4 flex items-center gap-2"><Plus size={16} className="text-violet-200" /><h2 className="text-sm font-semibold text-white">Create monthly payment draft</h2></div>
            <p className="mb-4 text-xs leading-5 text-slate-500">The latest compensation effective on the first day of the selected UTC month is used. Monthly base pay is not prorated by attendance or recorded hours.</p>
            <form onSubmit={(event) => void createPayment(event)} className="grid gap-3 md:grid-cols-4">
              <label className="space-y-1.5 text-xs text-slate-400">Employee<select required value={selectedEmployee} onChange={(event) => setSelectedEmployee(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white"><option value="">Select employee</option>{paymentData.employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.fullName} · {employee.employeeId}</option>)}</select></label>
              <label className="space-y-1.5 text-xs text-slate-400">Payment month<input type="month" required value={period} onChange={(event) => setPeriod(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label>
              <label className="space-y-1.5 text-xs text-slate-400">Adjustment (+/-)<input required inputMode="decimal" pattern="-?[0-9]+(\.[0-9]{1,2})?" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label>
              <label className="space-y-1.5 text-xs text-slate-400">Adjustment reason<input value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} maxLength={1000} placeholder="Required for non-zero amount" className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label>
              <div className="md:col-span-4"><Button type="submit" disabled={busy === "payment"}>{busy === "payment" ? "Creating…" : "Create payment draft"}</Button></div>
            </form>
          </DashboardCard>
          <DashboardCard className="p-0">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] p-4 sm:px-5"><div><h2 className="text-sm font-semibold text-white">Payment records</h2><p className="mt-1 text-xs text-slate-500">{monthName(period)} · UTC pay period</p></div><span className="text-xs text-slate-500">{paymentData.records.length} records</span></div>
            {paymentData.records.length ? <div className="divide-y divide-white/[0.05]">
              {paymentData.records.map((payment) => <div key={payment._id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(160px,1.2fr)_120px_minmax(110px,0.8fr)_minmax(110px,0.8fr)_minmax(130px,1fr)_auto] sm:items-center sm:px-5">
                <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-200">{payment.employee?.fullName ?? "Employee unavailable"}</span><span className="mt-1 block text-xs text-slate-500">{payment.employee?.employeeId ?? "—"}</span></span>
                <span className="text-xs text-slate-400">{monthName(payment.periodStart.slice(0, 7))}</span>
                <span className="text-xs text-slate-400">Base {formatMoney(payment.baseAmountPaise, payment.currency)}</span>
                <span className="text-xs text-slate-400">Incentives {formatMoney(payment.incentiveTotalPaise, payment.currency)}<span className="mt-1 block text-slate-500">Adjustments {formatMoney(payment.adjustments.reduce((total, item) => total + item.amountPaise, 0), payment.currency)}</span></span>
                <span><span className="block text-sm font-semibold text-white">{formatMoney(payment.totalPayablePaise, payment.currency)}</span><span className={`mt-1 block text-xs ${payment.status === "paid" ? "text-emerald-200" : payment.status === "approved" ? "text-sky-200" : "text-amber-200"}`}>{paymentStatusLabels[payment.status]}</span></span>
                <span className="flex flex-wrap gap-2"><Link href={`/admin/payments/${payment._id}`} className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs text-slate-200 hover:bg-white/5">Details<ChevronRight size={13} /></Link>{payment.status === "draft" && <Button size="sm" disabled={busy === payment._id} onClick={() => void approvePayment(payment)}>Approve</Button>}{payment.status === "approved" && <Button size="sm" onClick={() => openPaidForm(payment)}>Mark as paid</Button>}</span>
              </div>)}
            </div> : <div className="px-6 py-10 text-center"><p className="text-sm text-slate-300">No payment records for {monthName(period)}</p><p className="mt-1 text-xs text-slate-500">Create a draft from agreed compensation when the period is ready.</p></div>}
          </DashboardCard>
        </>}

        {tab === "compensation" && <>
          <DashboardCard className="mb-5">
            <div className="mb-4 flex items-center gap-2"><BadgeIndianRupee size={16} className="text-violet-200" /><h2 className="text-sm font-semibold text-white">Configure agreed compensation</h2></div>
            <p className="mb-4 text-xs leading-5 text-slate-500">Enter each employee's actual agreement. Records are effective-dated and historical values are not overwritten. Default currency is INR.</p>
            <form onSubmit={(event) => void saveCompensation(event)} className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1.5 text-xs text-slate-400">Employee<select required value={compEmployee} onChange={(event) => setCompEmployee(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white"><option value="">Select employee</option>{compensationData.employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.fullName} · {employee.employeeId}</option>)}</select></label>
              <label className="space-y-1.5 text-xs text-slate-400">Compensation type<select value={compType} onChange={(event) => setCompType(event.target.value as CompensationType)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white">{Object.entries(compensationTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2"><label className="space-y-1.5 text-xs text-slate-400">Agreed base amount<input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" value={compAmount} onChange={(event) => setCompAmount(event.target.value)} placeholder="e.g. 5000.00" className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label><label className="space-y-1.5 text-xs text-slate-400">Currency<select value={compCurrency} onChange={(event) => setCompCurrency(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-2 text-sm text-white">{currencyOptions.map((currency) => <option key={currency}>{currency}</option>)}</select></label></div>
              <label className="space-y-1.5 text-xs text-slate-400">Effective date<input type="date" required value={compDate} onChange={(event) => setCompDate(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label>
              <label className="space-y-1.5 text-xs text-slate-400 md:col-span-2">Notes<input maxLength={2000} value={compNotes} onChange={(event) => setCompNotes(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label>
              <div className="md:col-span-3"><Button type="submit" disabled={busy === "compensation"}>{busy === "compensation" ? "Saving…" : "Save compensation"}</Button></div>
            </form>
          </DashboardCard>
          <DashboardCard className="p-0"><div className="border-b border-white/[0.06] px-5 py-4"><h2 className="text-sm font-semibold text-white">Compensation history</h2></div>{compensationData.records.length ? <div className="divide-y divide-white/[0.05]">{compensationData.records.map((record) => <div key={record._id} className="flex flex-wrap items-center gap-3 px-5 py-4"><span className="min-w-0 flex-1"><span className="block text-sm text-slate-200">{record.employee?.fullName ?? "Employee"} · {compensationTypeLabels[record.compensationType]}</span><span className="mt-1 block text-xs text-slate-500">Effective {formatDate(record.effectiveDate)}{record.notes ? ` · ${record.notes}` : ""}</span></span><span className="text-sm font-semibold text-white">{formatMoney(record.baseAmountPaise, record.currency)} / month</span></div>)}</div> : <p className="px-5 py-8 text-center text-sm text-slate-500">No compensation records configured.</p>}</DashboardCard>
          {selectedCompEmployee && <p className="mt-3 text-xs text-slate-500">Current form selection: {selectedCompEmployee.fullName}. Salary information is restricted to administrators and the employee concerned.</p>}
        </>}

        {tab === "incentives" && <>
          <DashboardCard className="mb-5">
            <div className="mb-4 flex items-center gap-2"><Gift size={16} className="text-violet-200" /><h2 className="text-sm font-semibold text-white">Add incentive</h2></div>
            <p className="mb-4 text-xs leading-5 text-slate-500">Incentives are created pending and require explicit approval. They are never automatically calculated from hours or check-ins.</p>
            <form onSubmit={(event) => void saveIncentive(event)} className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1.5 text-xs text-slate-400">Employee<select required value={incEmployee} onChange={(event) => setIncEmployee(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white"><option value="">Select employee</option>{incentiveData.employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.fullName} · {employee.employeeId}</option>)}</select></label>
              <label className="space-y-1.5 text-xs text-slate-400">Title<input required minLength={2} maxLength={120} value={incTitle} onChange={(event) => setIncTitle(event.target.value)} placeholder="Project Completion Bonus" className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label>
              <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2"><label className="space-y-1.5 text-xs text-slate-400">Amount<input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" value={incAmount} onChange={(event) => setIncAmount(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label><label className="space-y-1.5 text-xs text-slate-400">Currency<select value={incCurrency} onChange={(event) => setIncCurrency(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-2 text-sm text-white">{currencyOptions.map((currency) => <option key={currency}>{currency}</option>)}</select></label></div>
              <label className="space-y-1.5 text-xs text-slate-400">Related project (optional)<select value={incProject} onChange={(event) => { setIncProject(event.target.value); setIncTask(""); }} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white"><option value="">No project</option>{incentiveData.projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select></label>
              <label className="space-y-1.5 text-xs text-slate-400">Related task (optional)<select value={incTask} onChange={(event) => setIncTask(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white"><option value="">No task</option>{filteredTasks.map((task) => <option key={task._id} value={task._id}>{task.title}</option>)}</select></label>
              <label className="space-y-1.5 text-xs text-slate-400">Incentive date<input type="date" required value={incDate} onChange={(event) => setIncDate(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label>
              <label className="space-y-1.5 text-xs text-slate-400 md:col-span-3">Reason<textarea required minLength={5} maxLength={2000} value={incReason} onChange={(event) => setIncReason(event.target.value)} rows={2} placeholder="Explain why this incentive is being provided." className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-sm text-white" /></label>
              <div className="md:col-span-3"><Button type="submit" disabled={busy === "incentive"}>{busy === "incentive" ? "Saving…" : "Add pending incentive"}</Button></div>
            </form>
          </DashboardCard>
          <DashboardCard className="p-0"><div className="border-b border-white/[0.06] px-5 py-4"><h2 className="text-sm font-semibold text-white">Incentive history</h2></div>{incentiveData.records.length ? <div className="divide-y divide-white/[0.05]">{incentiveData.records.map((incentive) => <div key={incentive._id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5"><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-200">{incentive.employee?.fullName ?? "Employee"} · {incentive.title}</span><span className="mt-1 block text-xs text-slate-500">{formatDate(incentive.incentiveDate)} · {incentive.reason}{incentive.project?.name ? ` · ${incentive.project.name}` : ""}{incentive.task?.title ? ` · ${incentive.task.title}` : ""}</span></span><span className="text-sm font-semibold text-white">{formatMoney(incentive.amountPaise, incentive.currency)}</span><span className={`text-xs ${incentive.status === "approved" ? "text-emerald-200" : incentive.status === "pending" ? "text-amber-200" : "text-slate-400"}`}>{incentiveStatusLabels[incentive.status]}</span>{incentive.status !== "cancelled" && !incentive.paymentRecord && <span className="flex gap-2">{incentive.status === "pending" && <Button size="sm" disabled={busy === incentive._id} onClick={() => void reviewIncentive(incentive, "approved")}><Check size={13} />Approve</Button>}<Button size="sm" variant="secondary" disabled={busy === incentive._id} onClick={() => void reviewIncentive(incentive, "cancelled")}>Cancel</Button></span>}</div>)}</div> : <p className="px-5 py-8 text-center text-sm text-slate-500">No incentives recorded.</p>}</DashboardCard>
        </>}
      </>}

      {paidPayment && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><section role="dialog" aria-modal="true" aria-labelledby="paid-title" className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111827] p-5 shadow-2xl sm:p-7"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="paid-title" className="text-lg font-semibold text-white">Confirm external payment</h2><p className="mt-1 text-xs text-slate-500">{paidPayment.employee?.fullName} · {formatMoney(paidPayment.totalPayablePaise, paidPayment.currency)}</p></div><button type="button" onClick={() => setPaidPayment(null)} aria-label="Close payment confirmation" className="rounded-lg p-2 text-slate-500 hover:bg-white/5">×</button></div><form onSubmit={(event) => void markPaid(event)} className="space-y-4"><label className="block space-y-2 text-sm text-slate-300">Amount paid<input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-sm text-white" /></label><label className="block space-y-2 text-sm text-slate-300">Payment date<input required type="date" max={today} value={paidDate} onChange={(event) => setPaidDate(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-sm text-white" /></label><label className="block space-y-2 text-sm text-slate-300">Method<select value={paidMethod} onChange={(event) => setPaidMethod(event.target.value as PaymentMethod)} className="h-11 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-sm text-white">{Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block space-y-2 text-sm text-slate-300">Transaction reference (optional)<input maxLength={200} value={paidReference} onChange={(event) => setPaidReference(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-sm text-white" /></label><label className="block space-y-2 text-sm text-slate-300">Notes (optional)<textarea maxLength={2000} value={paidNotes} onChange={(event) => setPaidNotes(event.target.value)} rows={2} className="w-full rounded-xl border border-white/10 bg-[#0B0F19] px-3 py-2.5 text-sm text-white" /></label><p className="text-xs text-amber-200">Confirm only after the external payment is complete. This action records payment; it does not transfer money.</p><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setPaidPayment(null)}>Cancel</Button><Button type="submit" disabled={busy === "paid"}>{busy === "paid" ? "Recording…" : "Confirm as paid"}</Button></div></form></section></div>}
    </>
  );
}
