"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, User } from "lucide-react";
import { profile } from "@/lib/entryNavigation";
import { cn } from "@/lib/utils";

export default function ProfileDropdown({
  name,
  email,
  photoUrl,
  initials,
  isAdmin,
  onSignOut,
}: {
  name: string;
  email: string;
  photoUrl: string;
  initials: string;
  isAdmin: boolean;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-slate-100 cursor-pointer"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {/* Avatar */}
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-slate-100">
          {photoUrl ? (
            <span
              className="h-full w-full bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url("${photoUrl}")` }}
            />
          ) : (
            <span className="flex size-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-bold text-white">
              {initials}
            </span>
          )}
        </span>
        {/* Name + chevron (hidden on mobile) */}
        <span className="hidden items-center gap-1 sm:flex">
          <span className="max-w-[120px] truncate text-sm font-medium text-slate-700">{name}</span>
          <ChevronDown className={cn(
            "size-3 text-slate-400 transition-transform duration-200",
            open && "rotate-180"
          )} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-xl border border-slate-200 bg-white py-2 shadow-2xl animate-scale-in"
        >
          {/* User info */}
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">{name}</div>
            <div className="truncate font-mono text-xs text-slate-500">{email}</div>
            {isAdmin && (
              <span className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                Admin
              </span>
            )}
          </div>

          {/* Navigation items */}
          <Link
            href={profile()}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mx-1 flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
          >
            <User className="size-4" />
            My Account
          </Link>

          <div className="my-1 h-px bg-slate-100" />

          {/* Sign out */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
          >
            <LogOut className="size-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
