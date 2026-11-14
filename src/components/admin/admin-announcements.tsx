"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Archive, History, Megaphone, Pencil, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { PageHeading } from "@/components/ui/page-heading";
import {
  announcementAudienceLabels,
  announcementAudiences,
  announcementCategories,
  announcementCategoryLabels,
  announcementPriorities,
  announcementPriorityLabels,
  announcementStatuses,
  type AnnouncementAudience,
  type AnnouncementCategory,
  type AnnouncementPriority,
  type AnnouncementStatus,
} from "@/types/announcement";

interface EmployeeOption { _id: string; employeeId: string; fullName: string; role: string }
interface AnnouncementRecord {
  _id: string;
  title: string;
  message: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  selectedEmployees: Array<string | { _id: string }>;
  publishAt: string;
  expiresAt?: string | null;
  status: AnnouncementStatus;
  createdAt: string;
  updatedAt: string;
}
interface HistoryEntry {
  action: string;
  actor?: { fullName: string } | null;
  createdAt: string;
  previousValue?: { title?: string; status?: string };
  newValue?: { title?: string; status?: string };
}
interface AnnouncementResponse {
  records: AnnouncementRecord[];
  employees: EmployeeOption[];
}

const today = new Date().toISOString().slice(0, 10);
const emptyForm = {
  title: "",
  message: "",
  category: "general" as AnnouncementCategory,
  priority: "normal" as AnnouncementPriority,
  audience: "all_employees" as AnnouncementAudience,
  selectedEmployeeIds: [] as string[],
  publishAt: today,
  expiresAt: "",
};

async function parseResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not save announcements.");
  return result;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
}

function selectedId(value: string | { _id: string }) {
  return typeof value === "string" ? value : value._id;
}

export function AdminAnnouncements() {
  const [data, setData] = useState<AnnouncementResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [histories, setHistories] = useState<Record<string, HistoryEntry[]>>({});
  const [historyOpen, setHistoryOpen] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const query = statusFilter ? `?status=${statusFilter}&limit=50` : "?limit=50";
    setData(await parseResponse(await fetch(`/api/admin/announcements${query}`, { cache: "no-store" })));
  }, [statusFilter]);

  useEffect(() => {
    void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load announcements."));
  }, [load]);

  function edit(record: AnnouncementRecord) {
    setEditingId(record._id);
    setForm({
      title: record.title,
      message: record.message,
      category: record.category,
      priority: record.priority,
      audience: record.audience,
      selectedEmployeeIds: record.selectedEmployees.map(selectedId),
      publishAt: record.publishAt.slice(0, 10),
      expiresAt: record.expiresAt?.slice(0, 10) ?? "",
    });
    setNotice("");
    setError("");
  }

  function reset() {
    setEditingId("");
    setForm(emptyForm);
    setError("");
    setNotice("");
  }

  async function save(status: "draft" | "published") {
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const response = await fetch(editingId ? `/api/admin/announcements/${editingId}` : "/api/admin/announcements", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status }),
      });
      await parseResponse(response);
      setNotice(status === "published" ? "Announcement published or scheduled." : "Draft saved.");
      await load();
      if (!editingId) setForm(emptyForm);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save announcement.");
    } finally {
      setBusy("");
    }
  }

  async function archive(record: AnnouncementRecord) {
    setBusy(record._id);
    setError("");
    try {
      await parseResponse(await fetch(`/api/admin/announcements/${record._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      }));
      setNotice("Announcement archived.");
      await load();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Could not archive announcement.");
    } finally {
      setBusy("");
    }
  }

  async function toggleHistory(id: string) {
    if (historyOpen === id) {
      setHistoryOpen("");
      return;
    }
    setHistoryOpen(id);
    if (histories[id]) return;
    try {
      const result = await parseResponse(await fetch(`/api/admin/announcements/${id}`, { cache: "no-store" }));
      setHistories((current) => ({ ...current, [id]: result.announcement.history ?? [] }));
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : "Could not load announcement history.");
    }
  }

  return (
    <>
      <PageHeading title="Announcements" description="Create, schedule, publish, and archive company updates for authorized employees." />
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-4 py-3 text-sm text-emerald-200">{notice}</p>}
      <DashboardCard className="mb-6">
        <div className="mb-5 flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-violet-200"><Megaphone size={17} /></span><div><h2 className="text-sm font-semibold text-white">{editingId ? "Edit announcement" : "Create announcement"}</h2><p className="mt-1 text-xs text-slate-500">Future publish dates are scheduled. Audience membership is checked on every employee request.</p></div></div>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void save("draft"); }}>
          <label className="space-y-2 text-sm text-slate-300">Title<input required minLength={2} maxLength={160} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label>
          <label className="space-y-2 text-sm text-slate-300">Category<select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as AnnouncementCategory }))} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white">{announcementCategories.map((category) => <option key={category} value={category}>{announcementCategoryLabels[category]}</option>)}</select></label>
          <label className="space-y-2 text-sm text-slate-300">Priority<select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as AnnouncementPriority }))} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white">{announcementPriorities.map((priority) => <option key={priority} value={priority}>{announcementPriorityLabels[priority]}</option>)}</select></label>
          <label className="space-y-2 text-sm text-slate-300">Audience<select value={form.audience} onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value as AnnouncementAudience, selectedEmployeeIds: [] }))} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white">{announcementAudiences.map((audience) => <option key={audience} value={audience}>{announcementAudienceLabels[audience]}</option>)}</select></label>
          {form.audience === "selected_employees" && <label className="space-y-2 text-sm text-slate-300 md:col-span-2">Selected active employees<select multiple required value={form.selectedEmployeeIds} onChange={(event) => setForm((current) => ({ ...current, selectedEmployeeIds: Array.from(event.target.selectedOptions, (option) => option.value) }))} className="min-h-28 w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-sm text-white">{data?.employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.fullName} · {employee.employeeId} · {employee.role}</option>)}</select></label>}
          <label className="space-y-2 text-sm text-slate-300">Publish date (UTC)<input type="date" required value={form.publishAt} onChange={(event) => setForm((current) => ({ ...current, publishAt: event.target.value }))} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label>
          <label className="space-y-2 text-sm text-slate-300">Expiration date (optional, UTC)<input type="date" min={form.publishAt} value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white" /></label>
          <label className="space-y-2 text-sm text-slate-300 md:col-span-2">Message<textarea required minLength={2} maxLength={8000} rows={6} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-sm text-white" /></label>
          <div className="flex flex-wrap justify-end gap-2 md:col-span-2"><Button type="button" variant="secondary" onClick={reset}>Clear</Button><Button type="button" variant="secondary" disabled={busy === "save"} onClick={() => void save("draft")}>{busy === "save" ? "Saving…" : "Save draft"}</Button><Button type="button" disabled={busy === "save"} onClick={() => void save("published")}><Send size={14} />{busy === "save" ? "Saving…" : "Publish / Schedule"}</Button></div>
        </form>
      </DashboardCard>
      <DashboardCard className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4"><div><h2 className="text-sm font-semibold text-white">Announcement history</h2><p className="mt-1 text-xs text-slate-500">Draft, published, scheduled, and archived records.</p></div><select aria-label="Filter announcements by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-lg border border-white/10 bg-[#111827] px-3 text-xs text-slate-200"><option value="">All statuses</option>{announcementStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
        {!data ? <p className="px-5 py-8 text-sm text-slate-500">Loading announcements…</p> : data.records.length ? <div className="divide-y divide-white/[0.05]">{data.records.map((record) => <article key={record._id} className="px-5 py-4">
          <div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium text-slate-100">{record.title}</h3><span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] capitalize text-slate-400">{record.status}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${record.priority === "urgent" ? "bg-rose-400/10 text-rose-200" : record.priority === "important" ? "bg-amber-400/10 text-amber-200" : "bg-slate-400/10 text-slate-400"}`}>{announcementPriorityLabels[record.priority]}</span></div><p className="mt-1 text-xs text-slate-500">{announcementCategoryLabels[record.category]} · {announcementAudienceLabels[record.audience]} · Publish {formatDate(record.publishAt)}</p><p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs text-slate-400">{record.message}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => edit(record)}><Pencil size={13} />Edit</Button><Button size="sm" variant="secondary" onClick={() => void toggleHistory(record._id)}><History size={13} />History</Button>{record.status !== "archived" && <Button size="sm" variant="secondary" disabled={busy === record._id} onClick={() => void archive(record)}><Archive size={13} />Archive</Button>}</div></div>
          {historyOpen === record._id && <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">{histories[record._id]?.length ? <ul className="space-y-2">{histories[record._id].map((entry, index) => <li key={`${entry.createdAt}-${index}`} className="text-xs text-slate-400"><span className="capitalize text-slate-200">{entry.action}</span> · {entry.actor?.fullName ?? "Administrator"} · {formatDate(entry.createdAt)} · {entry.newValue?.title ?? entry.previousValue?.title ?? "Announcement updated"} ({entry.previousValue?.status ?? "new"} → {entry.newValue?.status ?? "updated"})</li>)}</ul> : <p className="text-xs text-slate-500">Loading history…</p>}</div>}
        </article>)}</div> : <p className="px-5 py-10 text-center text-sm text-slate-500">No announcements match this filter.</p>}
      </DashboardCard>
    </>
  );
}
