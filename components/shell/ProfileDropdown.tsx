"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings, User, Shield } from "lucide-react";
import { profile, settingsAppearance } from "@/lib/entryNavigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";

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
  const { t } = useTranslation();
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

  const menuItems = [
    { href: profile(), icon: User, label: t('nav.account'), color: "var(--color-primary)" },
    { href: settingsAppearance(), icon: Settings, label: t('nav.appearance'), color: "#60a5fa" },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-xl px-2 py-1 transition-all duration-200 cursor-pointer",
          open ? "bg-[var(--color-dropdown-hover)]" : "hover:bg-[var(--color-glass-hover)]"
        )}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {/* Avatar */}
        <span
          className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-300"
          style={{
            border: "2px solid var(--color-border-default)",
            boxShadow: open ? "0 0 12px var(--color-glow-primary)" : "none",
          }}
        >
          {photoUrl ? (
            <span
              className="h-full w-full bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url("${photoUrl}")` }}
            />
          ) : (
            <span className="flex size-full items-center justify-center bg-[var(--color-button-primary-bg)] text-xs font-bold text-[var(--color-button-primary-text)]">
              {initials}
            </span>
          )}
        </span>
        {/* Name + chevron (hidden on mobile) */}
        <span className="hidden items-center gap-1 sm:flex">
          <span className="max-w-[120px] truncate text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            {name}
          </span>
          <ChevronDown className={cn(
            "size-3 transition-transform duration-300",
            open && "rotate-180"
          )} style={{ color: "var(--color-text-tertiary)" }} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-[280px] origin-top-right overflow-hidden rounded-2xl animate-in fade-in slide-in-from-top-2"
          style={{
            background: "var(--color-dropdown-bg)",
            border: "1px solid var(--color-border-default)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px var(--color-border-subtle), inset 0 1px 0 var(--color-border-subtle)",
          }}
        >
          {/* Top accent bar */}
          <div
            className="h-[2px]"
            style={{ background: "linear-gradient(90deg, var(--color-primary), #3b82f6, var(--color-primary))" }}
          />

          {/* ── User Identity Card ── */}
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center gap-3.5">
              {/* Large avatar */}
              <span
                className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                style={{
                  border: "2px solid var(--color-border-default)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                }}
              >
                {photoUrl ? (
                  <span
                    className="h-full w-full bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url("${photoUrl}")` }}
                  />
                ) : (
                  <span
                    className="flex size-full items-center justify-center text-sm font-bold text-[var(--color-text-on-accent)]"
                    style={{ background: "var(--color-button-primary-bg)" }}
                  >
                    {initials}
                  </span>
                )}
              </span>

              {/* Name + email + badge */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-bold" style={{ color: "var(--color-text-primary)" }}>
                    {name}
                  </span>
                  {isAdmin && (
                    <span
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        background: "rgba(132,204,22,0.12)",
                        color: "var(--color-primary)",
                        border: "1px solid rgba(132,204,22,0.20)",
                      }}
                    >
                      <Shield className="size-2.5" />
                      Admin
                    </span>
                  )}
                </div>
                <span
                  className="mt-0.5 block truncate font-mono text-[11px]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {email}
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-4 h-px" style={{ background: "var(--color-divider)" }} />

          {/* ── Menu Items ── */}
          <div className="p-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="group/item flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all duration-200 hover:-translate-y-px cursor-pointer"
                  style={{ color: "var(--color-text-secondary)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--color-surface-raised)";
                    e.currentTarget.style.color = "var(--color-text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--color-text-secondary)";
                  }}
                >
                  <div
                    className="flex size-8 items-center justify-center rounded-lg transition-all duration-200"
                    style={{ background: "var(--color-surface-raised)" }}
                  >
                    <Icon className="size-4" style={{ color: item.color }} />
                  </div>
                  <span className="text-[13px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Divider */}
          <div className="mx-4 h-px" style={{ background: "var(--color-divider)" }} />

          {/* ── Sign Out ── */}
          <div className="p-2">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all duration-200 hover:-translate-y-px cursor-pointer"
              style={{ color: "var(--color-text-secondary)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--color-status-error-bg)";
                e.currentTarget.style.color = "var(--color-status-error)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--color-text-secondary)";
              }}
            >
              <div
                className="flex size-8 items-center justify-center rounded-lg transition-all duration-200"
                style={{ background: "var(--color-status-error-bg)" }}
              >
                <LogOut className="size-4 text-[var(--color-status-error)]" />
              </div>
              <span className="text-[13px] font-medium">{t('nav.signOut')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
