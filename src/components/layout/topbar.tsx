"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown, LogOut, Menu, UserRound } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function Topbar({
  title,
  name,
  email,
  isAdmin,
  profileHref,
  onMenuClick,
}: {
  title: string;
  name: string;
  email: string;
  isAdmin: boolean;
  profileHref?: string;
  onMenuClick: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (event.target instanceof Node && !profileRef.current?.contains(event.target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-white/[0.065] bg-canvas/78 px-4 shadow-[0_12px_40px_rgba(3,1,7,0.08)] backdrop-blur-2xl sm:px-7 lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuClick}
          className="rounded-xl border border-white/10 p-2.5 text-slate-300 hover:bg-white/[0.05] lg:hidden"
        >
          <Menu size={18} />
        </button>
        <div>
          <p className="hidden text-[9px] font-semibold uppercase tracking-[0.22em] text-violet-300/50 sm:block">Arclivo / Internal portal</p>
          <h1 className="truncate text-base font-semibold tracking-[-0.01em] text-white sm:mt-0.5 sm:text-lg">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <NotificationBell isAdmin={isAdmin} />
        <span className="hidden h-8 w-px bg-white/[0.08] sm:block" />
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((open) => !open)}
            className="flex items-center gap-2.5 rounded-xl border border-transparent p-1.5 text-left transition hover:border-white/[0.05] hover:bg-white/[0.04]"
          >
            <UserAvatar name={name} className="size-9 text-xs" />
            <span className="hidden max-w-36 sm:block">
              <span className="block truncate text-xs font-medium text-slate-100">{name}</span>
              <span className="mt-0.5 block truncate text-[11px] text-slate-500">{email}</span>
            </span>
            <ChevronDown size={15} className="hidden text-slate-500 sm:block" />
          </button>
          {profileOpen && (
            <div role="menu" className="absolute right-0 top-[calc(100%+10px)] w-56 rounded-2xl border border-white/10 bg-[#17121f]/98 p-2 shadow-[0_24px_70px_rgba(3,1,7,0.55)] backdrop-blur-xl">
              <div className="border-b border-white/[0.06] px-3 py-2.5">
                <p className="truncate text-sm font-medium text-white">{name}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{email}</p>
              </div>
              {profileHref ? (
                <Link
                  role="menuitem"
                  href={profileHref}
                  onClick={() => setProfileOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.05]"
                >
                  <UserRound size={15} /> My profile
                </Link>
              ) : (
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  disabled
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-400 opacity-60"
                  title="Profile editing is coming in a later phase"
                >
                  <UserRound size={15} /> Profile
                  <span className="ml-auto text-[10px]">Later</span>
                </button>
              )}
              <button
                role="menuitem"
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-rose-300 transition hover:bg-rose-400/10"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
