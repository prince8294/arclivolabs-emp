"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, CheckCheck } from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { PageHeading } from "@/components/ui/page-heading";

interface NotificationRecord {
  _id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  href: string;
}

export function NotificationCenter() {
  const [records, setRecords] = useState<NotificationRecord[] | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/notifications?limit=100", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load notifications.");
    setRecords(result.records);
  }

  useEffect(() => {
    void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load notifications."));
  }, []);

  async function markAllRead() {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Could not mark notifications as read.");
      return;
    }
    setRecords((current) => current?.map((record) => ({ ...record, readAt: record.readAt ?? new Date().toISOString() })) ?? null);
  }

  return (
    <>
      <PageHeading title="Notification history" description="Recent updates for your account." />
      {error && <p role="alert" className="mb-4 text-sm text-rose-200">{error}</p>}
      <DashboardCard className="p-0">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"><h2 className="text-sm font-semibold text-white">Recent notifications</h2><button type="button" onClick={() => void markAllRead()} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-violet-200 hover:bg-white/5"><CheckCheck size={14} />Mark all read</button></div>
        {records === null ? <p className="px-5 py-8 text-sm text-slate-500">Loading notifications…</p> : records.length ? <div className="divide-y divide-white/[0.05]">{records.map((record) => <Link key={record._id} href={record.href} className="flex items-start gap-3 px-5 py-4 hover:bg-white/[0.02]"><span className={`mt-1 size-2 shrink-0 rounded-full ${record.readAt ? "bg-slate-600" : "bg-violet-300"}`} /><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-200">{record.title}</span><span className="mt-1 block text-xs text-slate-400">{record.message}</span><span className="mt-2 block text-[10px] text-slate-600">{new Date(record.createdAt).toLocaleString()}</span></span>{record.readAt && <Check size={14} className="text-slate-600" />}</Link>)}</div> : <p className="px-5 py-10 text-center text-sm text-slate-500">No notifications yet.</p>}
      </DashboardCard>
    </>
  );
}
