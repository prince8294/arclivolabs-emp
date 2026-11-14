"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleCheck, Megaphone } from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { PageHeading } from "@/components/ui/page-heading";
import { announcementCategoryLabels, announcementPriorityLabels, type AnnouncementCategory, type AnnouncementPriority } from "@/types/announcement";

interface AnnouncementDetail {
  _id: string;
  title: string;
  message: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  publishAt: string;
  readAt: string | null;
}

export function EmployeeAnnouncementDetail({ id }: { id: string }) {
  const [announcement, setAnnouncement] = useState<AnnouncementDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/employee/announcements/${id}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Announcement not found.");
        setAnnouncement(result.announcement);
      })
      .catch((loadError: unknown) => {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(loadError instanceof Error ? loadError.message : "Announcement not found.");
      });
    return () => controller.abort();
  }, [id]);

  async function markRead() {
    try {
      const response = await fetch(`/api/employee/announcements/${id}`, { method: "PATCH" });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not mark announcement as read.");
        return;
      }
      setAnnouncement((current) => current && ({ ...current, readAt: result.readAt }));
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Could not mark announcement as read.");
    }
  }

  return (
    <>
      <Link href="/employee/announcements" className="mb-4 inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white"><ArrowLeft size={14} />All announcements</Link>
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
      {!announcement ? <DashboardCard><p className="text-sm text-slate-400">{error ? "This announcement is unavailable." : "Loading announcement…"}</p></DashboardCard> : <>
        <PageHeading title={announcement.title} description={`${announcementCategoryLabels[announcement.category]} · Published ${new Date(announcement.publishAt).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" })}`} />
        <DashboardCard className={announcement.priority === "urgent" ? "border-rose-300/20 bg-rose-400/[0.025]" : ""}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className={`flex size-10 items-center justify-center rounded-xl ${announcement.priority === "urgent" ? "bg-rose-400/10 text-rose-200" : "bg-accent/10 text-violet-200"}`}><Megaphone size={18} /></span><span className={`rounded-full px-2.5 py-1 text-xs ${announcement.priority === "urgent" ? "bg-rose-400/10 text-rose-200" : announcement.priority === "important" ? "bg-amber-400/10 text-amber-200" : "bg-white/[0.05] text-slate-400"}`}>{announcementPriorityLabels[announcement.priority]}</span></div>{announcement.readAt ? <span className="inline-flex items-center gap-1.5 text-xs text-emerald-200"><CircleCheck size={14} />Read</span> : <button type="button" onClick={() => void markRead()} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-slate-200 hover:bg-white/[0.05]"><CircleCheck size={14} />Mark as read</button>}</div>
          <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{announcement.message}</div>
        </DashboardCard>
      </>}
    </>
  );
}
