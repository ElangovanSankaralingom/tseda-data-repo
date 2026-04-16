"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  LogOut,
  Search,
  Shield,
  Settings,
  Flame,
  Trophy,
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
   COMMAND CENTER v9 — Three Card Types

   Mirrors the dashboard visual language:

   TYPE 1: HERO IDENTITY — like DashboardWelcome
     Lime accent bar, greeting + extending line,
     diagonal gradient bg, recessed streak pill,
     dot-grid texture, integrated status bar.

   TYPE 2: CATEGORY TILES — like CategoryCard
     Solid accent top border, solid icon box,
     corner notch clip, accent color bleed.

   TYPE 3: DATA WIDGET — Streak Pulse
     Left amber accent bar, recessed surface,
     progress ring, stat pills. Not navigation.
  ───────────────────────────────────────────────────────
*/

const SLIDE_OFF = "translateX(-360px)";
const SLIDE_ON = "translateX(0)";
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

/* Corner notch clip — matches CategoryCard */
const NOTCH_CLIP = "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)";

/* Dot grid SVG pattern */
const DOT_GRID_SVG = `url("data:image/svg+xml,%3Csvg width='16' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='0.6' fill='rgba(255,255,255,0.035)'/%3E%3C/svg%3E")`;

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

/* ── Orbit Ring (avatar) ── */
function OrbitRing({
  progress,
  size = 64,
  strokeWidth = 2.5,
  color = "var(--color-primary)",
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
        stroke="rgba(255,255,255,0.06)"
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
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      )}
    </svg>
  );
}

/* ── Streak Progress Ring ── */
function StreakRing({
  progress,
  size = 64,
  strokeWidth = 4,
  bgColor = "rgba(255,255,255,0.06)",
  fgColor = "#f59e0b",
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  bgColor?: string;
  fgColor?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bgColor} strokeWidth={strokeWidth} />
      {progress > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={fgColor}
          strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - Math.min(progress, 1) * c}
          className="transition-all duration-[1500ms] ease-out"
          style={{ filter: `drop-shadow(0 0 8px ${fgColor}50)` }}
        />
      )}
    </svg>
  );
}

/* ── Gradient Separator ── */
function SepLine({ open, idx }: { open: boolean; idx: number }) {
  return (
    <div
      className="transition-transform duration-500 mx-4"
      style={{
        transform: open ? SLIDE_ON : SLIDE_OFF,
        transitionTimingFunction: EASE,
        transitionDelay: open ? `${60 + idx * 40}ms` : "0ms",
      }}
    >
      <div className="h-px" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0.07) 70%, transparent 100%)" }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TYPE 2: CATEGORY TILE — like CategoryCard
   Corner notch, solid accent top bar, color bleed
   ═══════════════════════════════════════════════ */
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
        "group relative flex flex-col rounded-2xl h-[100px] transition-all duration-300 overflow-hidden",
        "outline-none focus-visible:ring-2 focus-visible:ring-white/30",
        "hover:-translate-y-0.5",
      )}
      style={{
        clipPath: active ? undefined : NOTCH_CLIP,
        backgroundColor: active ? accent : "rgba(0,0,0,0.30)",
        border: `1px solid ${active ? accent : "rgba(255,255,255,0.07)"}`,
        boxShadow: active
          ? `0 8px 24px ${accent}40, 0 0 0 1px ${accent}`
          : "0 4px 16px rgba(0,0,0,0.3)",
      }}
    >
      {/* Accent top bar — solid color, like CategoryCard */}
      {!active && (
        <div className="h-[2.5px] flex-shrink-0" style={{ backgroundColor: accent }} />
      )}

      {/* Color bleed gradient from left */}
      {!active && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(90deg, ${accent}08 0%, transparent 50%)`,
          }}
        />
      )}

      <div className="flex flex-col flex-1 p-3.5 pt-3">
        {/* Icon box — solid accent when inactive, frosted when active */}
        <div
          className="flex size-9 items-center justify-center rounded-xl transition-all duration-300"
          style={{
            backgroundColor: active
              ? "rgba(255,255,255,0.18)"
              : accent,
            boxShadow: active
              ? "0 2px 8px rgba(0,0,0,0.2)"
              : `0 4px 12px ${accent}40`,
          }}
        >
          <Icon
            className="size-[16px]"
            style={{ color: "#fff" }}
          />
        </div>

        <div className="flex-1" />

        {/* Label + status */}
        <div>
          <span
            className={cn(
              "block text-[12px] font-bold tracking-tight transition-colors",
              active ? "text-white" : "text-white/65 group-hover:text-white/90"
            )}
          >
            {label}
          </span>
          {status && (
            <span
              className="block mt-0.5 text-[10px] font-medium"
              style={{ color: active ? "rgba(255,255,255,0.7)" : `${accent}90` }}
            >
              {status}
            </span>
          )}
        </div>
      </div>

      {/* Badge */}
      {badge != null && badge > 0 && (
        <span
          className="absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-full text-[9px] font-black"
          style={{
            backgroundColor: active ? "#fff" : accent,
            color: active ? accent : "#000",
            boxShadow: `0 0 10px ${accent}50`,
          }}
        >
          {badge}
        </span>
      )}
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
    <button type="button" onClick={() => { onClose(); tile.action?.(); }} className="text-left w-full">
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
  } = useTiltEffect(5);

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
  const streakActivated = totals?.streakActivatedCount ?? 0;
  const streakWon = totals?.streakWonCount ?? 0;
  const streakTotal = streakActivated + streakWon;
  const totalEntries = totals?.totalEntries ?? 0;
  const streakProgress = totalEntries
    ? Math.min(streakTotal / totalEntries, 1)
    : 0;

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

  const slideStyle = (idx: number): React.CSSProperties => ({
    transform: open ? SLIDE_ON : SLIDE_OFF,
    transitionTimingFunction: EASE,
    transitionDelay: open ? `${60 + idx * 40}ms` : "0ms",
  });

  const tiles: TileDef[] = [
    {
      key: "dash",
      href: dashboard(),
      icon: LayoutDashboard,
      label: t("nav.dashboard"),
      accent: "#3b82f6",
      active: isActive(dashboard()),
      status: totals ? `${totals.totalEntries} entries` : null,
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

  const streakLabel = streakWon > 0
    ? `${streakWon} won`
    : streakActivated > 0
      ? `${streakActivated} active`
      : "No streaks yet";
  const streakPercent = Math.round(streakProgress * 100);

  /* Stagger indices */
  const sepIdx1 = 1;
  const tileStart = 2;
  const sepIdx2 = tileStart + tiles.length;
  const streakIdx = sepIdx2 + 1;
  const sepIdx3 = streakIdx + 1;
  const termIdx = sepIdx3 + 1;

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className={cn(
          "fixed inset-0 z-40 transition-all duration-500",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        style={{
          backgroundColor: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Floating Cards ── */}
      <div
        className={cn(
          "fixed z-50 top-[60px] left-0 bottom-0 overflow-y-auto overflow-x-hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        style={{ width: 340, padding: "8px 12px 16px", scrollbarWidth: "none" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Navigation menu"
      >
        <div className="flex flex-col gap-3">

          {/* ═══════════════════════════════════════════
              TYPE 1: HERO IDENTITY — DashboardWelcome style
              ═══════════════════════════════════════════ */}
          <div
            className="transition-transform duration-500"
            style={slideStyle(0)}
          >
            <div ref={tiltRef} style={tiltStyle} {...tiltHandlers}>
              <Link
                href={profile()}
                onClick={onClose}
                className="group/id relative block overflow-hidden rounded-3xl transition-shadow duration-300 hover:shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
                style={{
                  background: "linear-gradient(135deg, rgba(0,0,0,0.45) 0%, rgba(30,58,95,0.18) 50%, rgba(0,0,0,0.4) 100%)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
                }}
              >
                {/* Dot grid texture */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ backgroundImage: DOT_GRID_SVG, backgroundSize: "16px 16px" }}
                />

                {/* Holographic light */}
                <div style={{ ...lightStyle, opacity: 0.05 }} />

                {/* Lime accent top bar — matches DashboardWelcome */}
                <div className="h-[3px] bg-[var(--color-primary)]" />

                <div className="relative px-5 pt-5 pb-4">
                  {/* Greeting + extending line */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40 whitespace-nowrap">
                      {profileDesignation ?? "Faculty"}
                    </span>
                    <div className="h-px flex-1 bg-white/[0.06]" />
                  </div>

                  {/* Avatar row */}
                  <div className="mt-4 flex items-center gap-4">
                    {/* Avatar with orbit */}
                    <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
                      <OrbitRing progress={streakProgress} size={64} strokeWidth={2.5} />
                      <div
                        className="absolute overflow-hidden rounded-xl"
                        style={{
                          inset: 5,
                          border: "2px solid rgba(132,204,22,0.25)",
                          boxShadow: "0 0 14px rgba(132,204,22,0.08), 0 4px 12px rgba(0,0,0,0.35)",
                        }}
                      >
                        {profilePhoto ? (
                          <span
                            className="block h-full w-full bg-cover bg-center bg-no-repeat"
                            style={{ backgroundImage: `url("${profilePhoto}")` }}
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center bg-[#1e3a5f] text-sm font-bold text-white">
                            {profileInitials}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Name + email */}
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-black tracking-tight text-white leading-tight truncate">
                        {profileName}
                      </h2>
                      <span className="block mt-0.5 font-mono text-[10px] text-white/30 truncate">
                        {profileEmail}
                      </span>
                    </div>
                  </div>

                  {/* Streak ring gauges — recessed pill (like DashboardWelcome) */}
                  {totals && streakTotal > 0 && (
                    <div
                      className="mt-4 rounded-xl px-4 py-3 inline-flex items-center gap-4"
                      style={{
                        backgroundColor: "#0f111c",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {streakActivated > 0 && (
                        <div className="flex items-center gap-2">
                          <Flame className="size-3.5 text-amber-400" />
                          <span className="font-mono text-lg font-black text-amber-400">
                            {streakActivated}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/35">
                            active
                          </span>
                        </div>
                      )}
                      {streakActivated > 0 && streakWon > 0 && (
                        <div className="h-5 w-px bg-white/[0.08]" />
                      )}
                      {streakWon > 0 && (
                        <div className="flex items-center gap-2">
                          <Trophy className="size-3.5 text-[var(--color-primary)]" />
                          <span className="font-mono text-lg font-black text-[var(--color-primary)]">
                            {streakWon}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/35">
                            won
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Loading shimmer when no data yet */}
                  {!totals && (
                    <div className="mt-4 h-12 w-40 animate-pulse rounded-xl bg-white/[0.04]" />
                  )}
                </div>

                {/* Status bar — recessed, like DashboardWelcome */}
                <div
                  className="mx-3 mb-3 rounded-xl px-4 py-2.5 flex items-center gap-3"
                  style={{
                    backgroundColor: "#080a12",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span className="text-[var(--color-primary)] text-[10px] font-bold">{">"}</span>
                  <span className="font-mono text-[10px] font-semibold tracking-wider text-white/35">
                    TSEDA
                  </span>
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-subtle-pulse" />
                  <span className="font-mono text-[10px] font-semibold tracking-wider text-emerald-400/70">
                    ONLINE
                  </span>
                  {totals && (
                    <>
                      <div className="h-3 w-px bg-white/[0.06]" />
                      <span className="font-mono text-[10px] font-medium tracking-wider text-white/30">
                        {totalEntries}
                      </span>
                    </>
                  )}
                </div>
              </Link>
            </div>
          </div>

          {/* ── Separator 1 ── */}
          <SepLine open={open} idx={sepIdx1} />

          {/* ═══════════════════════════════════════════
              TYPE 2: NAVIGATION — CategoryCard style
              ═══════════════════════════════════════════ */}
          <nav aria-label="Navigation" className="grid grid-cols-2 gap-2.5">
            {tiles.map((tile, idx) => (
              <div
                key={tile.key}
                className={cn(
                  "transition-transform duration-500",
                  isOddCount && idx === tiles.length - 1 && "col-span-2"
                )}
                style={slideStyle(tileStart + idx)}
              >
                <NavWidget tile={tile} onClose={onClose} />
              </div>
            ))}
          </nav>

          {/* ── Separator 2 ── */}
          <SepLine open={open} idx={sepIdx2} />

          {/* ═══════════════════════════════════════════
              TYPE 3: DATA WIDGET — Streak Pulse
              ═══════════════════════════════════════════ */}
          <div
            className="transition-transform duration-500"
            style={slideStyle(streakIdx)}
          >
            <div
              className="relative overflow-hidden rounded-2xl"
              style={{
                backgroundColor: "#0f111c",
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
              }}
            >
              {/* Left accent bar */}
              <div
                className="absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full"
                style={{
                  background: "linear-gradient(180deg, #f59e0b 0%, #d97706 100%)",
                  boxShadow: "0 0 10px rgba(245,158,11,0.25)",
                }}
              />

              {/* Amber wash from left */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: "radial-gradient(ellipse at 0% 50%, rgba(245,158,11,0.03) 0%, transparent 60%)" }}
              />

              <div className="relative flex items-center gap-4 p-4 pl-5">
                {/* Progress ring */}
                <div className="relative flex-shrink-0" style={{ width: 60, height: 60 }}>
                  <StreakRing progress={streakProgress} size={60} strokeWidth={3.5} fgColor="#f59e0b" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {totals ? (
                      <>
                        <Flame className="size-3.5 text-amber-400" style={{ filter: "drop-shadow(0 0 3px rgba(245,158,11,0.3))" }} />
                        <span className="mt-0.5 text-[10px] font-black text-white/75">
                          {streakPercent}%
                        </span>
                      </>
                    ) : (
                      <span className="inline-block size-5 animate-pulse rounded-full bg-white/[0.06]" />
                    )}
                  </div>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/60">
                    Streak Pulse
                  </span>
                  <p className="mt-0.5 text-[13px] font-bold text-white/65 leading-snug">
                    {totals ? streakLabel : "Loading..."}
                  </p>
                  {totals && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold"
                        style={{ backgroundColor: "rgba(245,158,11,0.10)", color: "#fbbf24" }}
                      >
                        <Flame className="size-2.5" /> {streakActivated}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold"
                        style={{ backgroundColor: "rgba(132,204,22,0.10)", color: "#84cc16" }}
                      >
                        <Trophy className="size-2.5" /> {streakWon}
                      </span>
                      <span className="text-[9px] font-mono font-bold text-white/18">
                        / {totalEntries}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Separator 3 ── */}
          <SepLine open={open} idx={sepIdx3} />

          {/* ── Sign Out ── */}
          <div
            className="transition-transform duration-500"
            style={slideStyle(termIdx)}
          >
            <button
              type="button"
              onClick={() => { onClose(); onSignOut(); }}
              className="group/so flex w-full items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-300 hover:-translate-y-0.5"
              style={{
                backgroundColor: "rgba(0,0,0,0.25)",
                border: "1px solid rgba(239,68,68,0.10)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              }}
            >
              <LogOut className="size-4 text-red-400/40 transition-colors group-hover/so:text-red-400" />
              <span className="text-[11px] font-semibold text-white/30 group-hover/so:text-white/60 transition-colors">
                Sign out
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
