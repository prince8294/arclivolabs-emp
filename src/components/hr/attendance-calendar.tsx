"use client";

import { CalendarDays } from "lucide-react";

export interface AttendanceCalendarDay {
  date: string;
  recordedWorkMs: number;
  breakMs: number;
  approvedLeave: boolean;
  pendingCorrections: number;
  status: string;
}

function formatHours(milliseconds: number) {
  if (!milliseconds) return "";
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function AttendanceCalendar({
  month,
  days,
  selectedDate,
  onSelect,
}: {
  month: string;
  days: AttendanceCalendarDay[];
  selectedDate?: string;
  onSelect: (date: string) => void;
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const offset = monthStart.getUTCDay();
  const dayMap = new Map(days.map((day) => [day.date, day]));
  const title = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  const cells = Array.from({ length: offset + daysInMonth }, (_, index) => {
    if (index < offset) return null;
    const date = `${month}-${String(index - offset + 1).padStart(2, "0")}`;
    return { date, day: dayMap.get(date) };
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-white">{title}</h2><p className="mt-1 text-xs text-slate-500">Calendar dates use UTC.</p></div><CalendarDays className="text-violet-200" size={18} /></div>
      <div className="grid grid-cols-7 gap-1.5 text-center sm:gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => <span key={weekday} className="py-1 text-[10px] font-medium text-slate-500 sm:text-xs">{weekday}</span>)}
        {cells.map((cell, index) => cell ? <button
          key={cell.date}
          type="button"
          onClick={() => onSelect(cell.date)}
          aria-label={`${cell.date}${cell.day?.approvedLeave ? ", approved leave" : ""}${cell.day?.recordedWorkMs ? `, ${formatHours(cell.day.recordedWorkMs)} recorded` : ", no recorded work"}`}
          className={`min-h-[58px] rounded-xl border p-1.5 text-left transition sm:min-h-[68px] sm:p-2 ${cell.date === selectedDate ? "border-accent/70 bg-accent/10" : "border-white/[0.05] bg-white/[0.02] hover:border-white/15"}`}
        >
          <span className="block text-xs text-slate-300">{Number(cell.date.slice(-2))}</span>
          {cell.day?.recordedWorkMs ? <span className="mt-2 block truncate text-[9px] font-medium text-emerald-200 sm:text-[10px]">{formatHours(cell.day.recordedWorkMs)}</span> : <span className="mt-2 block text-[9px] text-slate-600">—</span>}
          {cell.day?.approvedLeave && <span className="mt-1 block truncate text-[9px] text-sky-200">Leave</span>}
          {cell.day?.pendingCorrections ? <span className="mt-1 block truncate text-[9px] text-amber-200">Review</span> : null}
        </button> : <span key={`empty-${index}`} className="min-h-[58px] sm:min-h-[68px]" />)}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-emerald-300" />Recorded work</span><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-sky-300" />Approved leave</span><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-amber-300" />Pending review</span><span>No session is not a confirmed absence.</span></div>
    </div>
  );
}
