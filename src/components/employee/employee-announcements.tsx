"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CircleCheck, Megaphone } from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { PageHeading } from "@/components/ui/page-heading";
import { announcementCategories, announcementCategoryLabels, announcementPriorityLabels, type AnnouncementCategory, type AnnouncementPriority } from "@/types/announcement";

interface AnnouncementItem {
  _id: string;
  title: string;
  message: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  publishAt: string;
  readAt: string | null;
}

async function parseResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not load announcements.");
  return result;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
}

export function EmployeeAnnouncements() {
  const [category, setCategory] = useState("");
  const [records, setRecords] = useState<AnnouncementItem[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const query = category ? `?category=${category}&limit=50` : "?limit=50";
    const result = await parseResponse(await fetch(`/api/employee/announcements${query}`, { cache: "no-store" }));
    setRecords(result.records);
  }, [category]);

  useEffect(() => {
    void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load announcements."));
  }, [load]);

  async function markRead(id: string) {
    try {
      const result = await parseResponse(await fetch(`/api/employee/announcements/${id}`, { method: "PATCH" }));
      setRecords((current) => current?.map((record) => record._id === id ? { ...record, readAt: result.readAt } : record) ?? null);
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Could not mark announcement as read.");
    }
  }

  const urgent = records?.filter((item) => item.priority === "urgent" && !item.readAt) ?? [];
  return (
    <>
      <PageHeading title="Announcements" description="Company updates published for your role and account." />
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
      {urgent.length > 0 && <div className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-300/20 bg-rose-400/[0.07] px-4 py-3 text-rose-100"><Bell size={17} /><p className="text-sm font-medium">{urgent.length} unread urgent announcement{urgent.length === 1 ? "" : "s"}</p></div>}
      <DashboardCard className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4"><div><h2 className="text-sm font-semibold text-white">Published updates</h2><p className="mt-1 text-xs text-slate-500">Only active announcements intended for your account are shown.</p></div><label className="flex items-center gap-2 text-xs text-slate-400">Category<select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 rounded-lg border border-white/10 bg-[#111827] px-2.5 text-xs text-slate-200"><option value="">All categories</option>{announcementCategories.map((item) => <option key={item} value={item}>{announcementCategoryLabels[item]}</option>)}</select></label></div>
        {records === null ? <p className="px-5 py-8 text-sm text-slate-500">Loading announcements…</p> : records.length ? <div className="divide-y divide-white/[0.05]">{records.map((item) => <article key={item._id} className={`px-5 py-4 ${item.priority === "urgent" ? "border-l-2 border-l-rose-300 bg-rose-400/[0.025]" : ""}`}>
          <div className="flex flex-wrap items-start gap-3"><span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${item.priority === "urgent" ? "bg-rose-400/10 text-rose-200" : "bg-accent/10 text-violet-200"}`}><Megaphone size={16} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Link href={`/employee/announcements/${item._id}`} className="text-sm font-semibold text-slate-100 hover:text-violet-200">{item.title}</Link><span className={`rounded-full px-2 py-0.5 text-[10px] ${item.priority === "urgent" ? "bg-rose-400/10 text-rose-200" : item.priority === "important" ? "bg-amber-400/10 text-amber-200" : "bg-white/[0.05] text-slate-400"}`}>{announcementPriorityLabels[item.priority]}</span><span className="text-[10px] text-slate-500">{item.readAt ? "Read" : "Unread"}</span></div><p className="mt-1 text-[11px] text-slate-500">{announcementCategoryLabels[item.category]} · {formatDate(item.publishAt)}</p><p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-slate-400">{item.message}</p><div className="mt-3 flex items-center gap-3"><Link href={`/employee/announcements/${item._id}`} className="text-xs font-medium text-violet-200 hover:text-white">View details</Link>{!item.readAt && <button type="button" onClick={() => void markRead(item._id)} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"><CircleCheck size={13} />Mark as read</button>}</div></div></div>
        </article>)}</div> : <p className="px-5 py-10 text-center text-sm text-slate-500">No published announcements for this category.</p>}
      </DashboardCard>
    </>
  );
}
