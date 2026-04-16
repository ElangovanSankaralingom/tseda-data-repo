"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  LogOut,
  Search,
  Shield,
  Zap,
  Terminal,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  adminHome,
  dashboard,
  dataEntrySearch,
  profile,
  settingsAppearance,
} from "@/lib/entryNavigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useApi } from "@/hooks/useApi";
import { useTiltEffect } from "@/hooks/useTiltEffect";

/*
  ───────────────────────────────────────────────────────
   COMMAND CENTER v5 — Centered Overlay Grid.

   Not a sidebar. A centered full-viewport overlay with
   a 2-column grid of live status widgets. Each widget
   shows relevant data for its destination — the content
   IS the identity. No section labels needed.

   Click the command grid → entire viewport becomes the
   navigation surface. Widgets float in the center.
   Each has its own accent glow and live status.

   ┌──────────────────────────────────────┐
   │  [Avatar]  Name · email · stats     │  col-span-2
   └──────────────────────────────────────┘
   ┌────────────────┐  ┌────────────────┐
   │  Dashboard     │  │  Search        │
   │  12 entries    │  │  ⌘K            │
   └────────────────┘  └────────────────┘
   ┌────────────────┐  ┌────────────────┐
   │  Account       │  │  Appearance    │
   │  Faculty       │  │               │
   └────────────────┘  └────────────────┘
   ┌────────────────┐  ┌────────────────┐
   │  Admin         │  │  Sign Out      │
   │  5 pending     │  │               │
   └────────────────┘  └────────────────┘
   ┌──────────────────────────────────────┐
   │  ▶ TSEDA · ONLINE · 12 entries      │  col-span-2
   └──────────────────────────────────────┘
  ───────────────────────────────────────────────────────
*/

type OverviewResponse = {
  data?: {
    totals?: {
      totalEntries: number;
      streakActivatedCount: number;
      streakWonCount: number;
    };
  };
};
type UnreadResponse = { count?: number };

type TileDef = {
  key: string;
  href?: string;
  icon: LucideIcon;
  label: string;
  accent: string;
  active?: boolean;
  badge?: number | null;
  status?: string | null;
  action?: () => void;
};

/* ── Orbit Ring ── */
function OrbitRing({
  progress,
  size = 64,
  strokeWidth = 2.5,
  color = "#3b82f6",
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0"
      style={{ transform: "rotate(-90deg)" }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={`${color}20`}
        strokeWidth={strokeWidth}
      />
      {progress > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - Math.min(progress, 1) * c}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      )}
    </svg>
  );
}

/* ── Navigation Widget ── */
function NavWidget({
  tile,
  onClose,
}: {
  tile: TileDef;
  onClose: () => void;
}) {
  const { icon: Icon, label, accent, active, badge, status } = tile;

  const inner = (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl p-4 h-[100px] transition-all duration-300",
        "outline-none focus-visible:ring-2 focus-visible:ring-white/30",
        "hover:-translate-y-0.5",
        !active && "hover:border-white/[0.15] hover:shadow-[0_6px_24px_rgba(0,0,0,0.5)]"
      )}
      style={{
        backgroundColor: active ? accent : "#0c0e18",
        border: `1px solid ${active ? accent : "rgba(255,255,255,0.07)"}`,
        boxShadow: active
          ? `0 8px 28px ${accent}50, 0 0 0 1px ${accent}`
          : "0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      {/* Icon box — frosted white when active, dark when inactive */}
      <div
        className="flex size-10 items-center justify-center rounded-xl transition-all duration-300"
        style={{
          backgroundColor: active
            ? "rgba(255,255,255,0.18)"
            : "#181a26",
          boxShadow: active
            ? "0 2px 8px rgba(0,0,0,0.2)"
            : "0 2px 8px rgba(0,0,0,0.5)",
        }}
      >
        <Icon
          className="size-[18px]"
          style={{ color: active ? "#fff" : "rgba(255,255,255,0.4)" }}
        />
      </div>

      {/* Spacer — pushes label to bottom */}
      <div className="flex-1" />

      {/* Label + live status */}
      <div className="mt-2">
        <span
          className={cn(
            "block text-[13px] font-bold tracking-tight transition-colors",
            active
              ? "text-white"
              : "text-white/50 group-hover:text-white/80"
          )}
        >
          {label}
        </span>
        {status && (
          <span
            className={cn(
              "block mt-0.5 text-[11px] font-medium",
              active ? "text-white/70" : ""
            )}
            style={active ? undefined : { color: `${accent}90` }}
          >
            {status}
          </span>
        )}
      </div>

      {/* Badge — inverted when active (white bg, accent text) */}
      {badge != null && badge > 0 && (
        <span
          className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full text-[9px] font-black"
          style={{
            backgroundColor: active ? "#fff" : accent,
            color: active ? accent : "#000",
            boxShadow: active
              ? "0 2px 8px rgba(0,0,0,0.3)"
              : `0 0 12px ${accent}60`,
          }}
        >
          {badge}
        </span>
      )}

      {/* Signal dot — white when active */}
      <span
        className="absolute bottom-3 right-3 block size-1.5 rounded-full animate-subtle-pulse"
        style={{
          backgroundColor: active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.1)",
        }}
      />
    </div>
  );

  if (tile.href) {
    return (
      <Link href={tile.href} onClick={onClose}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        onClose();
        tile.action?.();
      }}
      className="text-left w-full"
    >
      {inner}
    </button>
  );
}

export default function SidebarDrawer({
  open,
  onClose,
  canAccessAdmin,
  profileName,
  profileEmail,
  profilePhoto,
  profileInitials,
  profileDesignation,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  canAccessAdmin: boolean;
  profileName: string;
  profileEmail: string;
  profilePhoto: string;
  profileInitials: string;
  profileDesignation: string | null;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const {
    ref: tiltRef,
    style: tiltStyle,
    lightStyle,
    handlers: tiltHandlers,
  } = useTiltEffect(2.5);

  const isMac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false
  );

  const { data: overview } = useApi<OverviewResponse>(
    open ? "/api/me/data-entry-overview" : null
  );
  const { data: adminUnread } = useApi<UnreadResponse>(
    open && canAccessAdmin ? "/api/admin/notifications/unread-count" : null
  );

  const totals = overview?.data?.totals;
  const adminPendingCount = adminUnread?.count ?? 0;
  const streakTotal =
    (totals?.streakActivatedCount ?? 0) + (totals?.streakWonCount ?? 0);
  const streakProgress = totals?.totalEntries
    ? Math.min(streakTotal / totals.totalEntries, 1)
    : 0;

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

  const stagger = (idx: number): React.CSSProperties => ({
    transitionDelay: open ? `${80 + idx * 50}ms` : "0ms",
  });

  const tiles: TileDef[] = [
    {
      key: "dash",
      href: dashboard(),
      icon: LayoutDashboard,
      label: t("nav.dashboard"),
      accent: "#3b82f6",
      active: isActive(dashboard()),
      status: totals ? `${totals.totalEntries} entries · ${streakTotal} streaks` : null,
    },
    {
      key: "search",
      href: dataEntrySearch(),
      icon: Search,
      label: t("nav.search"),
      accent: "#10b981",
      active: isActive(dataEntrySearch()),
      status: isMac ? "\u2318 K" : "Ctrl K",
    },
    {
      key: "appear",
      href: settingsAppearance(),
      icon: Settings,
      label: t("nav.appearance"),
      accent: "#818cf8",
      active: isActive(settingsAppearance()),
    },
    ...(canAccessAdmin
      ? [
          {
            key: "admin",
            href: adminHome(),
            icon: Shield,
            label: t("nav.admin"),
            accent: "#f59e0b",
            active: isActive(adminHome()),
            badge: adminPendingCount > 0 ? adminPendingCount : null,
            status:
              adminPendingCount > 0 ? `${adminPendingCount} pending` : null,
          } as TileDef,
        ]
      : []),
  ];

  const isOddCount = tiles.length % 2 !== 0;

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/70 backdrop-blur-xl transition-all duration-500",
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        aria-hidden="true"
      />

      {/* ── Command Center Overlay ──
          Centered in viewport. Click empty space to close.
          Content stops propagation so tiles are clickable. */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex flex-col items-start overflow-y-auto transition-all duration-500",
          "pt-[68px] pl-3 pr-4 pb-6 sm:pl-4",
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        style={{ scrollbarWidth: "none" }}
        onClick={onClose}
        role="dialog"
        aria-label="Navigation menu"
      >
        <div
          className={cn(
            "w-full max-w-[340px] flex flex-col gap-2.5 transition-all duration-500",
            open ? "translate-x-0 translate-y-0 opacity-100" : "-translate-x-4 translate-y-2 opacity-0"
          )}
          style={{
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Identity Card — taller, centered, unique ── */}
          <div
            className={cn(
              "transition-all duration-500",
              open
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-4"
            )}
            style={stagger(0)}
          >
            <div ref={tiltRef} style={tiltStyle} {...tiltHandlers}>
              <Link
                href={profile()}
                onClick={onClose}
                className="group/id relative block overflow-hidden rounded-2xl transition-shadow duration-300 hover:shadow-[0_16px_48px_rgba(0,0,0,0.6),0_0_50px_rgba(59,130,246,0.10)]"
                style={{
                  background: "#080c1a",
                  border: "1px solid rgba(59,130,246,0.22)",
                  boxShadow:
                    "0 16px 48px rgba(0,0,0,0.6), 0 0 40px rgba(59,130,246,0.06)",
                }}
              >
                {/* Holographic light */}
                <div style={{ ...lightStyle, opacity: 0.03 }} />

                {/* ── Top accent zone — gradient header ── */}
                <div
                  className="relative px-6 pt-6 pb-5"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(59,130,246,0.10) 0%, transparent 100%)",
                  }}
                >
                  {/* Accent bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[3px] bg-blue-500"
                    style={{ boxShadow: "0 0 20px rgba(59,130,246,0.5)" }}
                  />

                  {/* Radial glow behind avatar */}
                  <div
                    className="absolute top-4 left-1/2 -translate-x-1/2 size-32 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
                    }}
                  />

                  {/* Centered avatar + orbit */}
                  <div className="relative flex justify-center">
                    <div
                      className="relative"
                      style={{ width: 88, height: 88 }}
                    >
                      <OrbitRing
                        progress={streakProgress}
                        size={88}
                        strokeWidth={3}
                      />
                      <div
                        className="absolute overflow-hidden rounded-2xl"
                        style={{
                          inset: 7,
                          border: "2px solid rgba(59,130,246,0.35)",
                          boxShadow:
                            "0 0 24px rgba(59,130,246,0.18), 0 8px 20px rgba(0,0,0,0.4)",
                        }}
                      >
                        {profilePhoto ? (
                          <span
                            className="block h-full w-full bg-cover bg-center bg-no-repeat"
                            style={{
                              backgroundImage: `url("${profilePhoto}")`,
                            }}
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center bg-[#1e3a5f] text-xl font-bold text-white">
                            {profileInitials}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Name + email centered */}
                  <h2 className="mt-3 text-center text-lg font-black tracking-tight text-white leading-tight truncate">
                    {profileName}
                  </h2>
                  <span className="block mt-1 text-center font-mono text-[11px] text-white/30 truncate">
                    {profileEmail}
                  </span>
                </div>

                {/* ── Bottom stats strip — darker inset ── */}
                <div
                  className="mx-3 mb-3 rounded-xl flex items-center justify-center gap-3 px-4 py-2.5"
                  style={{
                    backgroundColor: "#0a0e1c",
                    border: "1px solid rgba(59,130,246,0.12)",
                  }}
                >
                  <span
                    className="rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                    style={{
                      backgroundColor: "#1e3a5f",
                      color: "#93c5fd",
                    }}
                  >
                    {profileDesignation ?? "Faculty"}
                  </span>
                  <div className="h-4 w-px bg-white/[0.08]" />
                  {totals ? (
                    <>
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold"
                        style={{
                          backgroundColor: "#78350f",
                          color: "#fbbf24",
                        }}
                      >
                        <Zap className="size-3" />
                        {totals.streakActivatedCount}
                      </span>
                      <div className="h-4 w-px bg-white/[0.08]" />
                      <span className="font-mono text-[11px] font-black text-white/40">
                        {totals.totalEntries}
                      </span>
                    </>
                  ) : (
                    <span className="inline-block h-3 w-16 animate-pulse rounded bg-white/[0.06]" />
                  )}
                </div>
              </Link>
            </div>
          </div>

          {/* ── Navigation Grid — 2 columns ── */}
          <nav aria-label="Navigation" className="grid grid-cols-2 gap-2.5">
            {tiles.map((tile, idx) => (
              <div
                key={tile.key}
                className={cn(
                  "transition-all duration-500",
                  open
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-3",
                  isOddCount &&
                    idx === tiles.length - 1 &&
                    "col-span-2"
                )}
                style={stagger(idx + 1)}
              >
                <NavWidget tile={tile} onClose={onClose} />
              </div>
            ))}
          </nav>

          {/* ── Terminal Bar ── */}
          <div
            className={cn(
              "transition-all duration-500",
              open
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-3"
            )}
            style={stagger(tiles.length + 1)}
          >
            <div className="flex items-stretch gap-2.5">
              {/* Terminal status */}
              <div
                className="relative flex-1 overflow-hidden rounded-2xl"
                style={{
                  backgroundColor: "#071a14",
                  border: "1px solid rgba(16,185,129,0.22)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                }}
              >
                <div className="animate-scan-sweep" />
                <div className="relative px-4 py-2.5 flex items-center gap-2">
                  <Terminal className="size-3.5 text-emerald-400/70" />
                  <span className="font-mono text-[10px] font-bold tracking-wider text-emerald-400/80">
                    TSEDA
                  </span>
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-subtle-pulse" />
                  <span className="font-mono text-[10px] font-bold tracking-wider text-emerald-400/70">
                    ONLINE
                  </span>
                </div>
              </div>

              {/* Sign out — its own visible card */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSignOut();
                }}
                className="group/so flex items-center gap-2 rounded-2xl px-4 transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  backgroundColor: "#0c0e18",
                  border: "1px solid rgba(239,68,68,0.18)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                }}
              >
                <LogOut className="size-4 text-red-400/60 transition-colors group-hover/so:text-red-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
