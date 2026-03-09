"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { profile as profileRoute, signin } from "@/lib/entryNavigation";
import type { ProfileSummary } from "@/components/shell/shellTypes";

function getInitials(name: string, email: string) {
  const source = name.trim() || email.split("@")[0] || "U";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export default function AvatarMenu({ refreshKey = 0, showName = false }: { refreshKey?: number; showName?: boolean }) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        const payload = (await response.json()) as ProfileSummary;
        if (!ignore && response.ok) {
          setProfile(payload);
        }
      } catch {
        // Keep fallback initials state only.
      }
    })();

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const name = useMemo(
    () =>
      String(
        profile?.officialName ??
          profile?.userPreferredName ??
          profile?.googleName ??
          profile?.email?.split("@")[0] ??
          "User"
      ).trim(),
    [profile]
  );
  const email = String(profile?.email ?? "").trim();
  const photoUrl = String(profile?.googlePhotoURL ?? "").trim();
  const initials = getInitials(name, email);
  const displayName = useMemo(() => {
    const resolved = String(
      profile?.officialName ?? profile?.userPreferredName ?? profile?.googleName ?? ""
    ).trim();
    return resolved || "";
  }, [profile]);

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-2">
        {showName && displayName ? (
          <span className="hidden text-sm font-medium text-slate-700 sm:inline">{displayName}</span>
        ) : null}
        <button
        ref={buttonRef}
        type="button"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700 transition-transform transition-shadow duration-200 ease-out hover:scale-[1.03] hover:bg-slate-50 hover:shadow-sm hover:ring-2 hover:ring-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]/20"
      >
        {photoUrl ? (
          <span
            aria-hidden="true"
            className="h-full w-full bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url("${photoUrl}")` }}
          />
        ) : (
          <span>{initials}</span>
        )}
      </button>
      </div>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
            <Link
            href={profileRoute()}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm transition hover:bg-slate-50"
          >
            My Account
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: signin() });
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50"
          >
            Sign Out
          </button>
        </div>
      ) : null}
    </div>
  );
}
