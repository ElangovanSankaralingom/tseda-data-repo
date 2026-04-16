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
  Activity,
  Terminal,
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
   SIDEBAR DRAWER — Command Panel v2

   "WHAT IF" structural features:
   ① ORBIT RING — SVG progress ring around avatar
      showing streak completion as animated arc.
   ② CIRCUIT TOPOLOGY — vertical trunk line + node
      dots connecting nav items. Active node pulses.
   ③ EXPANDING ACTIVE — active nav item opens a
      contextual live-data micro-panel beneath it.

   Surface depth (4 levels):
   L0: Panel base #080a12
   L1: Zone containers — tinted hex (#142030, #1a1506)
   L2: Interactive elements — accent hex
   L3: Bright accents — solid glow

   Color zoning by temperature:
   PROFILE → cool blue (#1a2c4a)
   NAV     → neutral dark (#0d0f18)
   ADMIN   → warm amber (#1a1506)
   BOTTOM  → recessed black
   STATUS  → emerald terminal
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
  size = 76,
  strokeWidth = 3,
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
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(59,130,246,0.12)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
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
      {/* Orbital dot at the arc tip */}
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

/* ── Circuit Node Dot ── */
function CircuitNode({ color, active }: { color: string; active: boolean }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 10, height: 10 }}>
      <div
        className={cn("rounded-full transition-all duration-300", active ? "size-3" : "size-1.5")}
        style={{
          backgroundColor: active ? color : "rgba(255,255,255,0.2)",
          boxShadow: active ? `0 0 10px ${color}, 0 0 20px ${color}40` : "none",
        }}
      />
      {active && (
        <div
          className="absolute inset-0 rounded-full animate-glow-pulse"
          style={{ backgroundColor: `${color}20`, transform: "scale(2.5)" }}
        />
      )}
    </div>
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

  // Streak progress for orbit ring
  const streakTotal = (totals?.streakActivatedCount ?? 0) + (totals?.streakWonCount ?? 0);
  const streakProgress = totals?.totalEntries
    ? Math.min(streakTotal / totals.totalEntries, 1)
    : 0;

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

  type NavItem = {
    href: string;
    icon: LucideIcon;
    label: string;
    accent: string;
    activeBg: string;
    expandedStats?: { label: string; value: string | number; icon: LucideIcon }[];
  };

  const mainItems: NavItem[] = [
    {
      href: dashboard(),
      icon: LayoutDashboard,
      label: t("nav.dashboard"),
      accent: "#3b82f6",
      activeBg: "#142030",
      expandedStats: totals ? [
        { label: "Entries", value: totals.totalEntries, icon: Activity },
        { label: "Streaks", value: totals.streakActivatedCount, icon: Zap },
      ] : undefined,
    },
    {
      href: dataEntrySearch(),
      icon: Search,
      label: t("nav.search"),
      accent: "#10b981",
      activeBg: "#0a1f18",
    },
    {
      href: profile(),
      icon: User,
      label: t("nav.account"),
      accent: "#a855f7",
      activeBg: "#1a1030",
    },
  ];

  const adminItems: NavItem[] = [
    {
      href: adminHome(),
      icon: Shield,
      label: t("nav.admin"),
      accent: "#f59e0b",
      activeBg: "#1f1a08",
      expandedStats: adminPendingCount > 0 ? [
        { label: "Pending", value: adminPendingCount, icon: Activity },
      ] : undefined,
    },
  ];

  let delay = 0;

  // Find the currently active zone color for the floating indicator
  const activeAccent = [...mainItems, ...adminItems].find(i => isActive(i.href))?.accent ?? "#3b82f6";

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

      {/* Panel */}
      <div
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-full flex-col transition-transform duration-400 sm:w-[320px]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          backgroundColor: "#080a12",
        }}
        role="dialog"
        aria-label="Navigation menu"
      >
        {/* ── Accent edge — thin gradient strip on the right edge ── */}
        <div
          className="absolute right-0 top-0 bottom-0 w-[2px]"
          style={{
            background: `linear-gradient(180deg, ${activeAccent}60 0%, ${activeAccent}10 50%, transparent 100%)`,
            transition: "background 0.6s ease",
          }}
        />

        {/* ╔═══════════════════════════════════════════╗
           ║  ZONE 1: PROFILE HERO                      ║
           ║  FEATURE ①: Orbit ring around avatar        ║
           ╚═══════════════════════════════════════════╝ */}
        <div
          className="relative p-6 pb-6"
          style={{
            background: "linear-gradient(165deg, #1a2c4a 0%, #14203a 40%, #0d1425 100%)",
            boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
          }}
        >
          {/* Blue accent top bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500 animate-bar-draw" />

          <div className="flex items-start gap-5">
            {/* Avatar with orbit ring */}
            <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
              <OrbitRing progress={streakProgress} />
              <div
                className="absolute overflow-hidden rounded-2xl"
                style={{
                  inset: 6,
                  border: "2px solid rgba(59,130,246,0.35)",
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
              {/* Streak completion micro-badge */}
              {streakProgress > 0 && (
                <div
                  className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full text-[9px] font-black text-black"
                  style={{
                    backgroundColor: streakProgress >= 1 ? "#fbbf24" : "#3b82f6",
                    boxShadow: `0 0 8px ${streakProgress >= 1 ? "#fbbf2480" : "#3b82f680"}`,
                  }}
                >
                  {Math.round(streakProgress * 100)}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 pt-2">
              <div className="animate-text-reveal">
                <h2 className="text-2xl font-black tracking-tight text-white leading-none">
                  {firstName}
                </h2>
              </div>
              <div className="truncate font-mono text-[11px] text-[rgba(255,255,255,0.45)] mt-2.5">
                {profileEmail}
              </div>
            </div>
          </div>

          {/* Designation + streak pills */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {profileDesignation && (
              <span
                className="rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest"
                style={{ backgroundColor: "#1e3a5f", color: "#93c5fd" }}
              >
                {profileDesignation}
              </span>
            )}
            {totals && totals.streakActivatedCount > 0 && (
              <span
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold"
                style={{ backgroundColor: "#78350f", color: "#fbbf24" }}
              >
                <Zap className="size-3" />
                {totals.streakActivatedCount} streaks
              </span>
            )}
          </div>

          {/* Zone bleed gradient — blue fading into dark */}
          <div
            className="absolute left-0 right-0 -bottom-4 h-4 pointer-events-none"
            style={{ background: "linear-gradient(180deg, #0d1425 0%, #080a12 100%)" }}
          />
        </div>

        {/* ╔═══════════════════════════════════════════╗
           ║  ZONE 2: NAVIGATION                        ║
           ║  FEATURE ②: Circuit connector topology      ║
           ║  FEATURE ③: Expanding active item           ║
           ╚═══════════════════════════════════════════╝ */}
        <div className="flex-1 overflow-y-auto pt-5">
          <div className="px-4 pb-2">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-4 px-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[rgba(255,255,255,0.3)]">
                Navigate
              </span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Nav items with circuit connector */}
            <nav aria-label="Main navigation" className="relative">
              {/* ── Circuit trunk line ── */}
              <div
                className="absolute left-[33px] top-5 bottom-5 w-px"
                style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
              />
              {/* Active segment glow on the trunk */}
              {mainItems.map((item, idx) => {
                if (!isActive(item.href)) return null;
                const top = idx * 64 + 20;
                return (
                  <div
                    key={`glow-${item.href}`}
                    className="absolute left-[32px] w-[3px] rounded-full transition-all duration-500"
                    style={{
                      top,
                      height: 24,
                      backgroundColor: item.accent,
                      boxShadow: `0 0 12px ${item.accent}80`,
                    }}
                  />
                );
              })}

              <div className="space-y-1.5">
                {mainItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  const d = delay;
                  delay += 60;
                  return (
                    <div key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition-all duration-300",
                          active ? "text-white" : "text-[rgba(255,255,255,0.5)] hover:text-white",
                          open ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-6"
                        )}
                        style={{
                          transitionDelay: open ? `${d}ms` : "0ms",
                          backgroundColor: active ? item.activeBg : "transparent",
                          border: active ? `1px solid ${item.accent}25` : "1px solid transparent",
                        }}
                      >
                        {/* Circuit node dot — left of icon */}
                        <div className="flex items-center" style={{ width: 24, justifyContent: "center" }}>
                          <CircuitNode color={item.accent} active={active} />
                        </div>

                        {/* Icon box */}
                        <div
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg transition-all duration-300"
                          style={{
                            backgroundColor: active ? item.accent : "#151820",
                            boxShadow: active ? `0 4px 12px ${item.accent}40` : "none",
                          }}
                        >
                          <Icon className="size-[18px]" style={{ color: active ? "#fff" : "rgba(255,255,255,0.4)" }} />
                        </div>

                        <span className="flex-1 truncate">{item.label}</span>

                        {/* Hover strip for inactive */}
                        {!active && (
                          <div
                            className="absolute right-0 top-[20%] bottom-[20%] w-[2px] rounded-l-full opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ backgroundColor: item.accent }}
                          />
                        )}
                      </Link>

                      {/* FEATURE ③: Expanded contextual data panel */}
                      {active && item.expandedStats && item.expandedStats.length > 0 && (
                        <div
                          className="ml-[57px] mr-3 mt-1 mb-1 flex gap-2 animate-detail-slide"
                        >
                          {item.expandedStats.map((stat) => {
                            const StatIcon = stat.icon;
                            return (
                              <div
                                key={stat.label}
                                className="flex items-center gap-2 rounded-lg px-3 py-2"
                                style={{
                                  backgroundColor: "#0c0e16",
                                  border: `1px solid ${item.accent}20`,
                                }}
                              >
                                <StatIcon className="size-3.5" style={{ color: item.accent }} />
                                <span className="font-mono text-sm font-black" style={{ color: item.accent }}>
                                  {stat.value}
                                </span>
                                <span className="text-[10px] font-semibold text-[rgba(255,255,255,0.35)]">
                                  {stat.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </nav>
          </div>

          {/* ╔═══════════════════════════════════════════╗
             ║  ZONE 3: ADMIN — warm amber tint            ║
             ║  Completely different color temperature.     ║
             ╚═══════════════════════════════════════════╝ */}
          {canAccessAdmin && (
            <div
              className="mx-4 mt-3 rounded-2xl p-4"
              style={{
                backgroundColor: "#1a1506",
                border: "1px solid rgba(245,158,11,0.2)",
                boxShadow: "inset 0 1px 0 rgba(245,158,11,0.08)",
              }}
            >
              <div className="flex items-center gap-3 mb-3 px-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[rgba(245,158,11,0.6)]">
                  Admin
                </span>
                <div className="flex-1 h-px bg-[rgba(245,158,11,0.12)]" />
                {adminPendingCount > 0 && (
                  <span
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
                    style={{ backgroundColor: "#78350f", color: "#fbbf24" }}
                  >
                    <span className="size-1.5 rounded-full bg-amber-400 animate-subtle-pulse" />
                    {adminPendingCount}
                  </span>
                )}
              </div>

              <nav aria-label="Admin navigation">
                {adminItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  const d = delay;
                  delay += 60;
                  return (
                    <div key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "group flex items-center gap-3.5 rounded-xl px-4 py-3.5 text-[13px] font-semibold transition-all duration-300",
                          active ? "text-white" : "text-[rgba(255,255,255,0.55)] hover:text-white",
                          open ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                        )}
                        style={{
                          transitionDelay: open ? `${d}ms` : "0ms",
                          backgroundColor: active ? "rgba(245,158,11,0.2)" : "transparent",
                          boxShadow: active ? "inset 3px 0 0 #f59e0b" : "none",
                        }}
                      >
                        <div
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg transition-all duration-300"
                          style={{
                            backgroundColor: active ? "#f59e0b" : "#2a1f0a",
                            boxShadow: active ? "0 4px 12px rgba(245,158,11,0.3)" : "none",
                          }}
                        >
                          <Icon className="size-[18px]" style={{ color: active ? "#fff" : "#f59e0b" }} />
                        </div>
                        <span className="flex-1">{item.label}</span>
                        {item.expandedStats?.[0] && active && (
                          <span
                            className="flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-black"
                            style={{ backgroundColor: "#fbbf24", boxShadow: "0 0 12px rgba(251,191,36,0.4)" }}
                          >
                            {item.expandedStats[0].value}
                          </span>
                        )}
                        {!active && adminPendingCount > 0 && (
                          <span
                            className="flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-black"
                            style={{ backgroundColor: "#fbbf24", boxShadow: "0 0 12px rgba(251,191,36,0.4)" }}
                          >
                            {adminPendingCount}
                          </span>
                        )}
                      </Link>

                      {/* Expanded stats for admin when active */}
                      {active && item.expandedStats && item.expandedStats.length > 0 && (
                        <div className="ml-14 mr-2 mt-1 mb-1 animate-detail-slide">
                          {item.expandedStats.map((stat) => {
                            const StatIcon = stat.icon;
                            return (
                              <div
                                key={stat.label}
                                className="flex items-center gap-2 rounded-lg px-3 py-2"
                                style={{
                                  backgroundColor: "#140f02",
                                  border: "1px solid rgba(245,158,11,0.15)",
                                }}
                              >
                                <StatIcon className="size-3.5 text-amber-400" />
                                <span className="font-mono text-sm font-black text-amber-400">
                                  {stat.value}
                                </span>
                                <span className="text-[10px] font-semibold text-[rgba(255,255,255,0.35)]">
                                  {stat.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* ╔═══════════════════════════════════════════╗
           ║  ZONE 4: BOTTOM — recessed utility zone    ║
           ╚═══════════════════════════════════════════╝ */}
        <div
          style={{
            backgroundColor: "rgba(0,0,0,0.45)",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div className="px-4 pt-4 pb-2 space-y-0.5">
            <Link
              href={settingsAppearance()}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-semibold transition-all duration-200",
                isActive(settingsAppearance())
                  ? "text-white"
                  : "text-[rgba(255,255,255,0.4)] hover:text-white hover:bg-white/[0.06]"
              )}
              style={isActive(settingsAppearance()) ? {
                backgroundColor: "#1a1530",
                border: "1px solid rgba(129,140,248,0.2)",
              } : {}}
            >
              <Palette className="size-[18px]" style={{ color: isActive(settingsAppearance()) ? "#818cf8" : undefined }} />
              <span className="flex-1">{t("nav.appearance")}</span>
            </Link>
            {canAccessAdmin && (
              <Link
                href="/reset"
                onClick={onClose}
                className="group flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-semibold text-[rgba(255,255,255,0.3)] hover:text-red-400 hover:bg-red-500/[0.08] transition-all duration-200"
              >
                <Trash2 className="size-[18px] group-hover:text-red-400 transition-colors" />
                <span className="flex-1">Reset Test Data</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => { onClose(); onSignOut(); }}
              className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-semibold text-[rgba(255,255,255,0.3)] hover:text-red-400 hover:bg-red-500/[0.08] transition-all duration-200"
            >
              <LogOut className="size-[18px] group-hover:text-red-400 transition-colors" />
              <span className="flex-1 text-left">{t("nav.signOut")}</span>
            </button>
          </div>

          {/* ── Terminal Status Bar ── */}
          <div
            className="relative mx-4 mb-4 mt-1 overflow-hidden rounded-lg"
            style={{
              backgroundColor: "#071a14",
              border: "1px solid rgba(16,185,129,0.18)",
            }}
          >
            {/* Scan sweep animation overlay */}
            <div className="animate-scan-sweep" />

            <div className="relative px-4 py-2.5 flex items-center gap-3">
              <Terminal className="size-3 text-emerald-400/60" />
              <span className="font-mono text-[10px] font-bold tracking-wider text-[rgba(16,185,129,0.7)]">
                TSEDA
              </span>
              <span className="size-1.5 rounded-full bg-emerald-400 animate-subtle-pulse" />
              <span className="font-mono text-[10px] font-bold tracking-wider text-emerald-400/70">
                ONLINE
              </span>
              {totals && (
                <>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-emerald-400/40">
                      {totals.totalEntries} entries
                    </span>
                    <div className="h-2.5 w-px bg-emerald-400/20" />
                    <span className="font-mono text-[10px] font-bold text-emerald-400/40">
                      {totals.streakActivatedCount} streaks
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
