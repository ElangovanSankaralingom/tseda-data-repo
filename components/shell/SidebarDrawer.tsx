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

/*
  ───────────────────────────────────────────────────────
   COMMAND HUB — Integrated with dashboard design system.

   Uses the SAME surface colors and patterns as:
   - DashboardWelcome (gradient, accent bar, mono fonts)
   - DashboardClient (card surfaces, accent treatments)

   Surface staircase (shared with dashboard):
   L0: Panel base     #070910
   L1: Container      #0e1019  (border rgba(255,255,255,0.10))
   L2: Cards inactive #141620  (border rgba(255,255,255,0.14))
   L3: Cards active   accent-tinted
   L4: Icon boxes     solid accent

   Split into category sections:
   ① IDENTITY — styled like DashboardWelcome title card
   ② NAVIGATE — Dashboard + Search (core workflow)
   ③ PERSONAL — Account + Appearance (user settings)
   ④ ADMIN    — warm amber zone (if authorized)
   ⑤ STATUS   — emerald terminal readout
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
  size = 72,
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
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth={strokeWidth} />
      {progress > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color}
          strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      )}
    </svg>
  );
}

/* ── Nav Card — matches dashboard category card style ── */
function NavCard({
  href, icon: Icon, label, accent, active, meta, badge, onClose,
}: {
  href: string; icon: LucideIcon; label: string; accent: string;
  active: boolean; meta?: string | null; badge?: number | null;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="group relative flex items-center gap-3.5 rounded-xl px-4 py-3.5 transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      style={{
        backgroundColor: active ? `${accent}20` : "#141620",
        border: active ? `1px solid ${accent}40` : "1px solid rgba(255,255,255,0.10)",
        boxShadow: active ? `inset 3px 0 0 ${accent}, 0 4px 16px ${accent}15` : "none",
      }}
    >
      {/* Icon box — solid accent when active, dark when inactive */}
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300"
        style={{
          backgroundColor: active ? accent : "#1c1e2a",
          boxShadow: active ? `0 4px 12px ${accent}40` : "none",
        }}
      >
        <Icon className="size-[18px]" style={{ color: active ? "#fff" : "rgba(255,255,255,0.4)" }} />
      </div>

      {/* Label + meta */}
      <div className="min-w-0 flex-1">
        <span className={cn(
          "block text-[13px] font-semibold truncate transition-colors duration-300",
          active ? "text-white" : "text-[rgba(255,255,255,0.55)] group-hover:text-white"
        )}>
          {label}
        </span>
        {meta && (
          <span
            className="block font-mono text-[10px] font-bold mt-0.5 transition-colors duration-300"
            style={{ color: active ? accent : "rgba(255,255,255,0.3)" }}
          >
            {meta}
          </span>
        )}
      </div>

      {/* Badge or arrow */}
      {badge != null && badge > 0 ? (
        <span
          className="flex size-6 items-center justify-center rounded-full text-[10px] font-black text-black"
          style={{ backgroundColor: accent, boxShadow: `0 0 10px ${accent}50` }}
        >
          {badge}
        </span>
      ) : (
        <ArrowRight
          className={cn(
            "size-4 shrink-0 transition-all duration-300",
            active ? "opacity-50" : "opacity-0 group-hover:opacity-30"
          )}
          style={{ color: active ? accent : "#fff" }}
        />
      )}
    </Link>
  );
}

/* ── Section Header — mono label with line ── */
function SectionLabel({ label, accent }: { label: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3 mb-2.5 px-1">
      <span
        className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]"
        style={{ color: accent ? `${accent}90` : "rgba(255,255,255,0.3)" }}
      >
        {label}
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: accent ? `${accent}20` : "rgba(255,255,255,0.06)" }} />
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

  const streakTotal = (totals?.streakActivatedCount ?? 0) + (totals?.streakWonCount ?? 0);
  const streakProgress = totals?.totalEntries
    ? Math.min(streakTotal / totals.totalEntries, 1)
    : 0;

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

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

      {/* ── Floating Panel ── */}
      <div
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden transition-all duration-400",
          "left-0 top-0 w-full h-full",
          "sm:left-3 sm:top-3 sm:w-[340px] sm:h-[calc(100dvh-24px)] sm:rounded-3xl",
          open ? "translate-x-0" : "-translate-x-full sm:-translate-x-[360px]"
        )}
        style={{
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          backgroundColor: "#070910",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: open
            ? "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)"
            : "none",
          maxHeight: "100dvh",
        }}
        role="dialog"
        aria-label="Navigation menu"
      >

        {/* ═══════════════════════════════════════════
            IDENTITY — styled like DashboardWelcome.
            Same gradient, same accent bar, same
            surface tokens. They're the same card.
           ═══════════════════════════════════════════ */}
        <div
          className="relative overflow-hidden sm:rounded-t-3xl"
          style={{
            background: "linear-gradient(135deg, rgba(0,0,0,0.45) 0%, rgba(30,58,95,0.18) 50%, rgba(0,0,0,0.4) 100%)",
            borderBottom: "1px solid rgba(59,130,246,0.15)",
          }}
        >
          {/* 3px accent bar — same as DashboardWelcome */}
          <div className="h-[3px] bg-[var(--color-primary)] animate-bar-draw" />

          {/* Radial glow behind avatar */}
          <div
            className="absolute left-1/2 top-10 -translate-x-1/2 size-44 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(30,58,95,0.25) 0%, transparent 70%)" }}
          />

          <div className="relative flex flex-col items-center pt-6 pb-5 px-5">
            {/* Avatar with orbit ring */}
            <div className="relative" style={{ width: 72, height: 72 }}>
              <OrbitRing progress={streakProgress} size={72} />
              <div
                className="absolute overflow-hidden rounded-2xl"
                style={{
                  inset: 5,
                  border: "2px solid rgba(59,130,246,0.3)",
                  boxShadow: "0 0 20px rgba(59,130,246,0.12)",
                }}
              >
                {profilePhoto ? (
                  <span
                    className="block h-full w-full bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url("${profilePhoto}")` }}
                  />
                ) : (
                  <span className="flex size-full items-center justify-center bg-[#1e3a5f] text-lg font-bold text-white">
                    {profileInitials}
                  </span>
                )}
              </div>
            </div>

            {/* Name — centered, same font weight as dashboard */}
            <h2 className="mt-3 text-xl font-black tracking-tight text-white leading-none text-center animate-text-reveal">
              {profileName}
            </h2>

            {/* Email — mono, like dashboard date display */}
            <span className="mt-1.5 font-mono text-[10px] text-[rgba(255,255,255,0.35)] text-center truncate max-w-full">
              {profileEmail}
            </span>

            {/* Data strip — matches dashboard's inset panels (#0f111c) */}
            <div
              className="mt-4 w-full rounded-2xl flex items-center justify-center gap-3 px-4 py-3"
              style={{
                backgroundColor: "#0f111c",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span
                className="rounded-lg px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest"
                style={{ backgroundColor: "#1e3a5f", color: "#93c5fd" }}
              >
                {profileDesignation ?? "Faculty"}
              </span>

              <div className="h-4 w-px bg-white/[0.1]" />

              <span
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-bold"
                style={{ backgroundColor: "#78350f", color: "#fbbf24" }}
              >
                <Zap className="size-2.5" />
                {totals?.streakActivatedCount ?? 0}
              </span>

              <div className="h-4 w-px bg-white/[0.1]" />

              <span className="font-mono text-[11px] font-black text-[rgba(255,255,255,0.5)]">
                {totals?.totalEntries ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            NAVIGATION SECTIONS — split by category.
            Cards use dashboard surface tokens:
            #141620 inactive, accent-tinted active,
            #1c1e2a icon boxes.
           ═══════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-3 space-y-4">

          {/* ── Section: Navigate ── */}
          <div>
            <SectionLabel label="Navigate" />
            <nav aria-label="Main navigation" className="space-y-2">
              <NavCard
                href={dashboard()}
                icon={LayoutDashboard}
                label={t("nav.dashboard")}
                accent="#3b82f6"
                active={isActive(dashboard())}
                meta={totals ? `${totals.totalEntries} entries · ${totals.streakActivatedCount} streaks` : null}
                onClose={onClose}
              />
              <NavCard
                href={dataEntrySearch()}
                icon={Search}
                label={t("nav.search")}
                accent="#10b981"
                active={isActive(dataEntrySearch())}
                onClose={onClose}
              />
            </nav>
          </div>

          {/* ── Section: Personal ── */}
          <div>
            <SectionLabel label="Personal" accent="#a855f7" />
            <nav aria-label="Personal" className="space-y-2">
              <NavCard
                href={profile()}
                icon={User}
                label={t("nav.account")}
                accent="#a855f7"
                active={isActive(profile())}
                meta={profileDesignation ?? null}
                onClose={onClose}
              />
              <NavCard
                href={settingsAppearance()}
                icon={Settings}
                label={t("nav.appearance")}
                accent="#818cf8"
                active={isActive(settingsAppearance())}
                onClose={onClose}
              />
            </nav>
          </div>

          {/* ── Section: Admin (warm amber zone) ── */}
          {canAccessAdmin && (
            <div
              className="rounded-2xl p-3"
              style={{
                backgroundColor: "#12100a",
                border: "1px solid rgba(245,158,11,0.18)",
              }}
            >
              <SectionLabel label="Admin" accent="#f59e0b" />
              <nav aria-label="Admin navigation" className="space-y-2">
                <NavCard
                  href={adminHome()}
                  icon={Shield}
                  label={t("nav.admin")}
                  accent="#f59e0b"
                  active={isActive(adminHome())}
                  meta={adminPendingCount > 0 ? `${adminPendingCount} pending` : null}
                  badge={adminPendingCount > 0 ? adminPendingCount : null}
                  onClose={onClose}
                />
              </nav>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════
            BOTTOM DOCK — solid #0e1019 (same as
            dashboard container surface).
           ═══════════════════════════════════════════ */}
        <div
          className="sm:rounded-b-3xl"
          style={{
            backgroundColor: "#0e1019",
            borderTop: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
          }}
        >
          {/* Utility row */}
          <div className="px-4 pt-3 pb-2 flex items-center gap-2">
            {canAccessAdmin && (
              <Link
                href="/reset"
                onClick={onClose}
                className="group flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-semibold text-[rgba(255,255,255,0.4)] hover:text-red-400 transition-all duration-200"
                style={{ backgroundColor: "#141620", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Trash2 className="size-3.5 group-hover:text-red-400 transition-colors" />
                <span>Reset</span>
              </Link>
            )}

            <div className="flex-1" />

            <button
              type="button"
              onClick={() => { onClose(); onSignOut(); }}
              className="group flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-semibold text-[rgba(255,255,255,0.4)] hover:text-red-400 transition-all duration-200"
              style={{ backgroundColor: "#141620", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <LogOut className="size-3.5 group-hover:text-red-400 transition-colors" />
              <span className="text-left">{t("nav.signOut")}</span>
            </button>
          </div>

          {/* Terminal status — same as dashboard status bar (#080a12) */}
          <div
            className="relative mx-4 mb-3 mt-1 overflow-hidden rounded-xl"
            style={{
              backgroundColor: "#080a12",
              border: "1px solid rgba(16,185,129,0.20)",
            }}
          >
            <div className="animate-scan-sweep" />
            <div className="relative px-4 py-2.5 flex items-center gap-2.5">
              <Terminal className="size-3.5 text-emerald-400/70" />
              <span className="font-mono text-[10px] font-bold tracking-wider text-emerald-400/80">
                TSEDA
              </span>
              <span className="size-1.5 rounded-full bg-emerald-400 animate-subtle-pulse" />
              <span className="font-mono text-[10px] font-bold tracking-wider text-emerald-400/80">
                ONLINE
              </span>
              {totals && (
                <>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-emerald-400/50">
                      {totals.totalEntries} entries
                    </span>
                    <div className="h-2.5 w-px bg-emerald-400/25" />
                    <span className="font-mono text-[10px] font-bold text-emerald-400/50">
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
