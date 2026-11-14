"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Check, CheckCheck } from "lucide-react";

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: string;
  readAt: string | null;
  createdAt: string;
  href: string;
}

interface NotificationResponse {
  records: NotificationItem[];
  unreadCount: number;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

async function parseResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not update notifications.");
  return result;
}

export function NotificationBell({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationResponse | null>(null);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const historyHref = isAdmin ? "/admin/notifications" : "/employee/notifications";

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/notifications?limit=8", { signal: controller.signal, cache: "no-store" })
      .then(parseResponse)
      .then((result: NotificationResponse) => {
        setData(result);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(loadError instanceof Error ? loadError.message : "Could not load notifications.");
        }
      });
    return () => controller.abort();
  }, [pathname]);

  useEffect(() => {
    function closeOutside(event: MouseEvent) {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);

  async function markRead(notification: NotificationItem) {
    if (!notification.readAt) {
      try {
        await parseResponse(await fetch(`/api/notifications/${notification._id}`, { method: "PATCH" }));
        setData((current) => current && ({
          ...current,
          unreadCount: Math.max(0, current.unreadCount - 1),
          records: current.records.map((item) => item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item),
        }));
      } catch (markError) {
        setError(markError instanceof Error ? markError.message : "Could not mark notification as read.");
        return;
      }
    }
    setOpen(false);
    router.push(notification.href);
  }

  async function markAllRead() {
    try {
      await parseResponse(await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      }));
      setData((current) => current && ({
        ...current,
        unreadCount: 0,
        records: current.records.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
      }));
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Could not mark notifications as read.");
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-label={data?.unreadCount ? `${data.unreadCount} unread notifications` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative rounded-xl p-2.5 text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-200"
      >
        <Bell size={18} strokeWidth={1.8} />
        {!!data?.unreadCount && <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[9px] font-semibold leading-4 text-white">{data.unreadCount > 99 ? "99+" : data.unreadCount}</span>}
      </button>
      {open && <div role="dialog" aria-label="Notifications" className="absolute right-0 top-[calc(100%+12px)] z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-white/10 bg-[#151d2b] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div><h2 className="text-sm font-semibold text-white">Notifications</h2><p className="mt-0.5 text-[11px] text-slate-500">{data?.unreadCount ?? 0} unread</p></div>
          <button type="button" onClick={() => void markAllRead()} disabled={!data?.unreadCount} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-violet-200 hover:bg-white/5 disabled:opacity-40"><CheckCheck size={14} />Mark all read</button>
        </div>
        {error && <p role="alert" className="border-b border-rose-400/10 px-4 py-2 text-xs text-rose-200">{error}</p>}
        <div className="max-h-[min(65vh,420px)] overflow-y-auto">
          {data?.records.length ? data.records.map((notification) => <button key={notification._id} type="button" onClick={() => void markRead(notification)} className={`flex w-full gap-3 border-b border-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.04] ${notification.readAt ? "opacity-75" : ""}`}>
            <span className={`mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg ${notification.readAt ? "bg-white/[0.04] text-slate-500" : "bg-accent/15 text-violet-200"}`}>{notification.readAt ? <Check size={14} /> : <Bell size={14} />}</span>
            <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-slate-100">{notification.title}</span><span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-slate-400">{notification.message}</span><span className="mt-1.5 block text-[10px] text-slate-600">{formatTime(notification.createdAt)}</span></span>
          </button>) : <p className="px-4 py-8 text-center text-xs text-slate-500">{data ? "You’re all caught up." : "Loading notifications…"}</p>}
        </div>
        <Link href={historyHref} onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-center border-t border-white/[0.06] text-xs font-medium text-violet-200 hover:bg-white/[0.03]">View notification history</Link>
      </div>}
    </div>
  );
}
