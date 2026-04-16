"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
  Palette,
  Search,
  Shield,
  Trash2,
  User,
  Zap,
  Terminal,
  ArrowRight,
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

/*
  ───────────────────────────────────────────────────────
   COMMAND HUB — Not a sidebar. A cockpit.

   STRUCTURAL FEATURES (the "WHAT IF" lens):
   ① GRID TOPOLOGY — Navigation is a 2-column grid
      of large cards, not a vertical list. Your eye
      surveys a field, not scans a list.
   ② SPATIAL DEPTH — Active card is "pulled forward"
      with scale, glow, expanded data. Inactive cards
      recede into the background plane.
   ③ COCKPIT ASSEMBLY — Elements don't slide in as
      a flat panel. Each piece assembles individually
      with staggered scale + fade. Profile drops in,
      cards expand from center, status rises from below.
   ④ ORBIT RING — SVG progress ring around avatar.

   Surface depth:
   L0: Panel base #070910
   L1: Card inactive #0e1019
   L2: Card active — accent-tinted hex
   L3: Icon boxes, badges — solid accent

   Color zoning:
   PROFILE → cool blue
   GRID CARDS → each card has its own accent world
   BOTTOM → recessed, utility
   STATUS → emerald terminal
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

/* ── SVG Orbit Ring ── */
function OrbitRing({
  progress,
  size = 60,
  strokeWidth = 2.5,
  color = "#3b82f6",
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(progress, 1) * circumference);

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
        r={radius}
        fill="none"
        stroke="rgba(59,130,246,0.12)"
        strokeWidth={strokeWidth}
      />
      {progress > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      )}
      {progress > 0 && progress < 1 && (
        <circle
          cx={size / 2 + radius * Math.cos(2 * Math.PI * progress)}
          cy={size / 2 + radius * Math.sin(2 * Math.PI * progress)}
          r={strokeWidth}
          fill={color}
          className="animate-subtle-pulse"
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      )}
    </svg>
  );
}

/* ── Hub Card ── */
function HubCard({
  href,
  icon: Icon,
  label,
  accent,
  activeBg,
  active,
  open,
  delay,
  meta,
  badge,
  onClose,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  accent: string;
  activeBg: string;
  active: boolean;
  open: boolean;
  delay: number;
  meta?: string | null;
  badge?: number | null;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className={cn(
        "group relative flex flex-col rounded-2xl p-4 transition-all duration-400 outline-none",
        "focus-visible:ring-2 focus-visible:ring-white/30",
        open ? "opacity-100 scale-100" : "opacity-0 scale-[0.85]",
      )}
      style={{
        transitionDelay: open ? `${delay}ms` : "0ms",
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        backgroundColor: active ? activeBg : "#0e1019",
        border: active
          ? `1px solid ${accent}40`
          : "1px solid rgba(255,255,255,0.08)",
        boxShadow: active
          ? `0 8px 24px ${accent}20, inset 0 1px 0 ${accent}15`
          : "0 2px 8px rgba(0,0,0,0.3)",
        transform: active && open ? "scale(1.02)" : undefined,
      }}
    >
      {/* Active top accent bar */}
      {active && (
        <div
          className="absolute top-0 left-3 right-3 h-[2px] rounded-b-full"
          style={{
            backgroundColor: accent,
            boxShadow: `0 0 12px ${accent}60`,
          }}
        />
      )}

      {/* Icon + Arrow row */}
      <div className="flex items-start justify-between mb-3">
        <div
          className="flex size-11 items-center justify-center rounded-xl transition-all duration-300"
          style={{
            backgroundColor: active ? accent : "#181c28",
            boxShadow: active ? `0 4px 16px ${accent}50` : "none",
          }}
        >
          <Icon
            className="size-5"
            style={{ color: active ? "#fff" : "rgba(255,255,255,0.35)" }}
          />
        </div>
        <ArrowRight
          className={cn(
            "size-4 transition-all duration-300",
            active
              ? "opacity-60 translate-x-0"
              : "opacity-0 -translate-x-2 group-hover:opacity-40 group-hover:translate-x-0"
          )}
          style={{ color: active ? accent : "rgba(255,255,255,0.5)" }}
        />
      </div>

      {/* Label */}
      <span
        className={cn(
          "text-sm font-bold tracking-tight transition-colors duration-300",
          active ? "text-white" : "text-[rgba(255,255,255,0.55)] group-hover:text-white"
        )}
      >
        {label}
      </span>

      {/* Meta line — live data */}
      {meta && (
        <span
          className="mt-1.5 font-mono text-[11px] font-bold transition-colors duration-300"
          style={{ color: active ? accent : "rgba(255,255,255,0.3)" }}
        >
          {meta}
        </span>
      )}

      {/* Badge */}
      {badge != null && badge > 0 && (
        <div
          className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full text-[10px] font-black text-black"
          style={{
            backgroundColor: accent,
            boxShadow: `0 0 10px ${accent}60`,
          }}
        >
          {badge}
        </div>
      )}

      {/* Hover glow — bottom edge */}
      {!active && (
        <div
          className="absolute bottom-0 left-4 right-4 h-[1px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ backgroundColor: accent }}
        />
      )}
    </Link>
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

  const { data: overview } = useApi<OverviewResponse>(open ? "/api/me/data-entry-overview" : null);
  const { data: adminUnread } = useApi<UnreadResponse>(
    open && canAccessAdmin ? "/api/admin/notifications/unread-count" : null
  );

  const totals = overview?.data?.totals;
  const adminPendingCount = adminUnread?.count ?? 0;
  const firstName = profileName.split(/\s+/)[0] ?? profileName;

  const streakTotal = (totals?.streakActivatedCount ?? 0) + (totals?.streakWonCount ?? 0);
  const streakProgress = totals?.totalEntries
    ? Math.min(streakTotal / totals.totalEntries, 1)
    : 0;

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

  type HubItem = {
    href: string;
    icon: LucideIcon;
    label: string;
    accent: string;
    activeBg: string;
    meta?: string | null;
    badge?: number | null;
  };

  const hubItems: HubItem[] = [
    {
      href: dashboard(),
      icon: LayoutDashboard,
      label: t("nav.dashboard"),
      accent: "#3b82f6",
      activeBg: "#101e30",
      meta: totals
        ? `${totals.totalEntries} entries · ${totals.streakActivatedCount} streaks`
        : null,
    },
    {
      href: dataEntrySearch(),
      icon: Search,
      label: t("nav.search"),
      accent: "#10b981",
      activeBg: "#0a1a16",
    },
    {
      href: profile(),
      icon: User,
      label: t("nav.account"),
      accent: "#a855f7",
      activeBg: "#160e28",
      meta: profileDesignation ?? null,
    },
    ...(canAccessAdmin
      ? [
          {
            href: adminHome(),
            icon: Shield,
            label: t("nav.admin"),
            accent: "#f59e0b",
            activeBg: "#1a1508",
            meta: adminPendingCount > 0 ? `${adminPendingCount} pending` : null,
            badge: adminPendingCount > 0 ? adminPendingCount : null,
          },
        ]
      : []),
  ];

  // Active card color for ambient effects
  const activeAccent = hubItems.find((i) => isActive(i.href))?.accent ?? "#3b82f6";

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-lg transition-opacity duration-400",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — wider to accommodate the grid */}
      <div
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-full flex-col transition-transform duration-400 sm:w-[340px]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          backgroundColor: "#070910",
        }}
        role="dialog"
        aria-label="Navigation menu"
      >
        {/* ── Right edge gradient — shifts with active accent ── */}
        <div
          className="absolute right-0 top-0 bottom-0 w-[2px] transition-all duration-600"
          style={{
            background: `linear-gradient(180deg, ${activeAccent}50 0%, ${activeAccent}08 60%, transparent 100%)`,
          }}
        />

        {/* ╔═══════════════════════════════════════════╗
           ║  IDENTITY CARD — Centered command badge     ║
           ║  WHAT IF the profile wasn't avatar-left,    ║
           ║  text-right? What if it was a centered      ║
           ║  identity card like a sci-fi access badge?  ║
           ║  FEATURE ④: Orbit ring + centered layout.   ║
           ╚═══════════════════════════════════════════╝ */}
        <div
          className="relative overflow-hidden"
          style={{
            background: "linear-gradient(170deg, #14243e 0%, #0e1828 50%, #070910 100%)",
            borderBottom: "1px solid rgba(59,130,246,0.15)",
          }}
        >
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500/80 animate-bar-draw" />

          {/* Radial glow behind avatar */}
          <div
            className="absolute left-1/2 top-8 -translate-x-1/2 size-40 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
            }}
          />

          {/* Centered layout */}
          <div className="relative flex flex-col items-center pt-7 pb-5 px-5">
            {/* Avatar with orbit ring — centered, larger */}
            <div
              className={cn(
                "relative transition-all duration-500",
                open ? "opacity-100 scale-100" : "opacity-0 scale-90"
              )}
              style={{ width: 80, height: 80, transitionDelay: open ? "60ms" : "0ms" }}
            >
              <OrbitRing progress={streakProgress} size={80} strokeWidth={2.5} />
              <div
                className="absolute overflow-hidden rounded-2xl"
                style={{
                  inset: 6,
                  border: "2px solid rgba(59,130,246,0.35)",
                  boxShadow: "0 0 24px rgba(59,130,246,0.15)",
                }}
              >
                {profilePhoto ? (
                  <span
                    className="block h-full w-full bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url("${profilePhoto}")` }}
                  />
                ) : (
                  <span className="flex size-full items-center justify-center bg-[#1e3a5f] text-xl font-bold text-white">
                    {profileInitials}
                  </span>
                )}
              </div>
              {/* Streak % badge */}
              {streakProgress > 0 && (
                <div
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[9px] font-black"
                  style={{
                    backgroundColor: streakProgress >= 1 ? "#fbbf24" : "#3b82f6",
                    color: streakProgress >= 1 ? "#000" : "#fff",
                    boxShadow: `0 0 10px ${streakProgress >= 1 ? "#fbbf2480" : "#3b82f680"}`,
                  }}
                >
                  {Math.round(streakProgress * 100)}%
                </div>
              )}
            </div>

            {/* Name — centered, dramatic */}
            <h2
              className={cn(
                "mt-4 text-2xl font-black tracking-tight text-white leading-none text-center transition-all duration-400",
                open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
              )}
              style={{ transitionDelay: open ? "120ms" : "0ms" }}
            >
              {firstName}
            </h2>

            {/* Email */}
            <div
              className={cn(
                "mt-1.5 font-mono text-[10px] text-[rgba(255,255,255,0.35)] text-center truncate max-w-full transition-all duration-400",
                open ? "opacity-100" : "opacity-0"
              )}
              style={{ transitionDelay: open ? "160ms" : "0ms" }}
            >
              {profileEmail}
            </div>

            {/* ── Data strip — recessed horizontal stat bar ── */}
            <div
              className={cn(
                "mt-4 w-full rounded-xl flex items-center justify-center gap-3 px-4 py-2.5 transition-all duration-400",
                open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
              )}
              style={{
                transitionDelay: open ? "200ms" : "0ms",
                backgroundColor: "#0a0f1e",
                border: "1px solid rgba(59,130,246,0.12)",
              }}
            >
              {profileDesignation && (
                <>
                  <span
                    className="rounded-md px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest"
                    style={{ backgroundColor: "#1e3a5f", color: "#93c5fd" }}
                  >
                    {profileDesignation}
                  </span>
                  {totals && totals.streakActivatedCount > 0 && (
                    <div className="h-4 w-px bg-white/[0.1]" />
                  )}
                </>
              )}
              {totals && totals.streakActivatedCount > 0 && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[9px] font-bold"
                  style={{ backgroundColor: "#78350f", color: "#fbbf24" }}
                >
                  <Zap className="size-2.5" />
                  {totals.streakActivatedCount} streaks
                </span>
              )}
              {totals && (
                <>
                  <div className="h-4 w-px bg-white/[0.1]" />
                  <span className="font-mono text-[10px] font-bold text-[rgba(255,255,255,0.4)]">
                    {totals.totalEntries}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ╔═══════════════════════════════════════════╗
           ║  COMMAND HUB GRID                           ║
           ║  FEATURE ①: 2-col grid, not a list.         ║
           ║  FEATURE ②: Active card pulled forward.     ║
           ║  FEATURE ③: Cockpit assembly animation.     ║
           ╚═══════════════════════════════════════════╝ */}
        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4">
          {/* Section label */}
          <div className="flex items-center gap-3 mb-4 px-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[rgba(255,255,255,0.25)]">
              Command Hub
            </span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* The Grid */}
          <nav
            aria-label="Main navigation"
            className="grid grid-cols-2 gap-3"
          >
            {hubItems.map((item, idx) => (
              <HubCard
                key={item.href}
                {...item}
                active={isActive(item.href)}
                open={open}
                delay={120 + idx * 70}
                onClose={onClose}
              />
            ))}
          </nav>
        </div>

        {/* ╔═══════════════════════════════════════════╗
           ║  UTILITY DOCK — recessed, minimal           ║
           ╚═══════════════════════════════════════════╝ */}
        <div
          style={{
            backgroundColor: "rgba(0,0,0,0.4)",
            boxShadow: "0 -6px 24px rgba(0,0,0,0.5)",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          {/* Compact utility row — icon buttons, not full-width links */}
          <div className="px-4 pt-3 pb-2 flex items-center gap-1">
            <Link
              href={settingsAppearance()}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[12px] font-semibold transition-all duration-200",
                isActive(settingsAppearance())
                  ? "text-white bg-[#1a1530]"
                  : "text-[rgba(255,255,255,0.35)] hover:text-white hover:bg-white/[0.06]"
              )}
            >
              <Palette className="size-4" style={{ color: isActive(settingsAppearance()) ? "#818cf8" : undefined }} />
              <span>{t("nav.appearance")}</span>
            </Link>

            <div className="flex-1" />

            {canAccessAdmin && (
              <Link
                href="/reset"
                onClick={onClose}
                className="group flex size-9 items-center justify-center rounded-xl text-[rgba(255,255,255,0.25)] hover:text-red-400 hover:bg-red-500/[0.08] transition-all duration-200"
                aria-label="Reset test data"
              >
                <Trash2 className="size-4 group-hover:text-red-400 transition-colors" />
              </Link>
            )}

            <button
              type="button"
              onClick={() => { onClose(); onSignOut(); }}
              className="group flex size-9 items-center justify-center rounded-xl text-[rgba(255,255,255,0.25)] hover:text-red-400 hover:bg-red-500/[0.08] transition-all duration-200"
              aria-label={t("nav.signOut")}
            >
              <LogOut className="size-4 group-hover:text-red-400 transition-colors" />
            </button>
          </div>

          {/* ── Terminal Status ── */}
          <div
            className="relative mx-4 mb-3 mt-1 overflow-hidden rounded-lg"
            style={{
              backgroundColor: "#071a14",
              border: "1px solid rgba(16,185,129,0.15)",
            }}
          >
            <div className="animate-scan-sweep" />
            <div className="relative px-3.5 py-2 flex items-center gap-2.5">
              <Terminal className="size-3 text-emerald-400/50" />
              <span className="font-mono text-[10px] font-bold tracking-wider text-emerald-400/60">
                TSEDA
              </span>
              <span className="size-1.5 rounded-full bg-emerald-400 animate-subtle-pulse" />
              <span className="font-mono text-[10px] font-bold tracking-wider text-emerald-400/60">
                ONLINE
              </span>
              {totals && (
                <>
                  <div className="flex-1" />
                  <span className="font-mono text-[10px] font-bold text-emerald-400/35">
                    {totals.totalEntries}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
