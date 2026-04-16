"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
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
import { useTiltEffect } from "@/hooks/useTiltEffect";

/*
  ───────────────────────────────────────────────────────
   COMMAND HUB v4 — Split floating cards.

   The sidebar is NOT one panel. It's a STACK of
   separate floating cards with gaps between them.
   The backdrop blur shows through the gaps.
   Each card is its own visual world.

   ┌─────────────┐
   │  Identity   │  ← blue gradient, tilt
   └─────────────┘
        gap (backdrop visible)
   ┌─────────────┐
   │  Nav tiles  │  ← dark neutral, 2-col grid
   └─────────────┘
        gap
   ┌─────────────┐
   │  Personal   │  ← violet tint
   │  + Admin    │  ← amber tint (if authorized)
   └─────────────┘
        gap
   ┌─────────────┐
   │  Terminal   │  ← emerald status
   └─────────────┘

   Each card has its own rounded corners, border,
   background, and shadow. They're separate islands.
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
function OrbitRing({ progress, size = 72, strokeWidth = 2.5, color = "#3b82f6" }: {
  progress: number; size?: number; strokeWidth?: number; color?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="absolute inset-0" style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth={strokeWidth} />
      {progress > 0 && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
          strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - Math.min(progress, 1) * c}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      )}
    </svg>
  );
}

/* ── Tile Card ── */
function TileCard({ href, icon: Icon, label, accent, activeBg, active, meta, badge, onClose }: {
  href: string; icon: LucideIcon; label: string; accent: string; activeBg: string;
  active: boolean; meta?: string | null; badge?: number | null; onClose: () => void;
}) {
  return (
    <Link href={href} onClick={onClose}
      className="group relative flex flex-col rounded-xl p-3.5 transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      style={{
        backgroundColor: active ? activeBg : "#141620",
        border: active ? `1px solid ${accent}40` : "1px solid rgba(255,255,255,0.10)",
        boxShadow: active ? `0 6px 20px ${accent}18, inset 0 1px 0 ${accent}12` : "0 2px 6px rgba(0,0,0,0.3)",
      }}>
      {active && <div className="absolute top-0 left-3 right-3 h-[2px] rounded-b-full" style={{ backgroundColor: accent, boxShadow: `0 0 10px ${accent}50` }} />}
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex size-10 items-center justify-center rounded-xl transition-all duration-300"
          style={{ backgroundColor: active ? accent : "#1c1e2a", boxShadow: active ? `0 4px 12px ${accent}40` : "none" }}>
          <Icon className="size-[18px]" style={{ color: active ? "#fff" : "rgba(255,255,255,0.4)" }} />
        </div>
        {badge != null && badge > 0 ? (
          <span className="flex size-5 items-center justify-center rounded-full text-[9px] font-black text-black" style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}50` }}>{badge}</span>
        ) : (
          <ArrowRight className={cn("size-3.5 transition-all duration-300", active ? "opacity-50" : "opacity-0 group-hover:opacity-30")} style={{ color: active ? accent : "#fff" }} />
        )}
      </div>
      <span className={cn("text-[13px] font-bold tracking-tight transition-colors", active ? "text-white" : "text-[rgba(255,255,255,0.55)] group-hover:text-white")}>{label}</span>
      {meta && <span className="mt-1 font-mono text-[10px] font-bold" style={{ color: active ? accent : "rgba(255,255,255,0.3)" }}>{meta}</span>}
    </Link>
  );
}

export default function SidebarDrawer({
  open, onClose, canAccessAdmin, profileName, profileEmail,
  profilePhoto, profileInitials, profileDesignation, onSignOut,
}: {
  open: boolean; onClose: () => void; canAccessAdmin: boolean;
  profileName: string; profileEmail: string; profilePhoto: string;
  profileInitials: string; profileDesignation: string | null; onSignOut: () => void;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { ref: tiltRef, style: tiltStyle, lightStyle, handlers: tiltHandlers } = useTiltEffect(2.5);

  const { data: overview } = useApi<OverviewResponse>(open ? "/api/me/data-entry-overview" : null);
  const { data: adminUnread } = useApi<UnreadResponse>(
    open && canAccessAdmin ? "/api/admin/notifications/unread-count" : null
  );

  const totals = overview?.data?.totals;
  const adminPendingCount = adminUnread?.count ?? 0;
  const streakTotal = (totals?.streakActivatedCount ?? 0) + (totals?.streakWonCount ?? 0);
  const streakProgress = totals?.totalEntries ? Math.min(streakTotal / totals.totalEntries, 1) : 0;

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

  // Staggered card animations
  const cardDelay = (idx: number) => ({
    transitionDelay: open ? `${80 + idx * 60}ms` : "0ms",
  });

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

      {/* ── Card Stack Container ──
          NOT a solid panel. Just a positioned flex column.
          No background — the backdrop shows through gaps. */}
      <div
        className={cn(
          "fixed z-50 flex flex-col gap-2.5 transition-all duration-400",
          "left-3 top-3 w-[calc(100%-24px)] sm:w-[330px]",
          open ? "translate-x-0" : "-translate-x-[calc(100%+24px)]"
        )}
        style={{
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          maxHeight: "calc(100dvh - 24px)",
        }}
        role="dialog"
        aria-label="Navigation menu"
      >

        {/* ════════════════════════════════════
            CARD 1: IDENTITY — Blue gradient, tilt.
            Standalone floating card.
           ════════════════════════════════════ */}
        <div
          className={cn("transition-all duration-400", open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3")}
          style={cardDelay(0)}
        >
          <div ref={tiltRef} style={tiltStyle} {...tiltHandlers}>
            <div
              className="relative overflow-hidden rounded-2xl"
              style={{
                background: "linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(30,58,95,0.25) 50%, rgba(0,0,0,0.45) 100%)",
                border: "1px solid rgba(59,130,246,0.22)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              }}
            >
              {/* Holographic light */}
              <div style={{ ...lightStyle, opacity: 0.04 }} />
              {/* 3px accent bar */}
              <div className="h-[3px] bg-[var(--color-primary)] animate-bar-draw" />

              <div className="relative flex flex-col items-center pt-5 pb-4 px-5">
                {/* Avatar + orbit */}
                <div className="relative" style={{ width: 68, height: 68 }}>
                  <OrbitRing progress={streakProgress} size={68} />
                  <div className="absolute overflow-hidden rounded-2xl" style={{ inset: 5, border: "2px solid rgba(59,130,246,0.3)", boxShadow: "0 0 20px rgba(59,130,246,0.12)" }}>
                    {profilePhoto ? (
                      <span className="block h-full w-full bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url("${profilePhoto}")` }} />
                    ) : (
                      <span className="flex size-full items-center justify-center bg-[#1e3a5f] text-lg font-bold text-white">{profileInitials}</span>
                    )}
                  </div>
                </div>

                <h2 className="mt-3 text-lg font-black tracking-tight text-white leading-none text-center">{profileName}</h2>
                <span className="mt-1 font-mono text-[10px] text-[rgba(255,255,255,0.35)] truncate max-w-full">{profileEmail}</span>

                {/* Data strip */}
                <div className="mt-3 w-full rounded-xl flex items-center justify-center gap-2.5 px-3 py-2" style={{ backgroundColor: "#0f111c", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ backgroundColor: "#1e3a5f", color: "#93c5fd" }}>{profileDesignation ?? "Faculty"}</span>
                  <div className="h-3.5 w-px bg-white/[0.1]" />
                  <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-bold" style={{ backgroundColor: "#78350f", color: "#fbbf24" }}>
                    <Zap className="size-2.5" />{totals?.streakActivatedCount ?? 0}
                  </span>
                  <div className="h-3.5 w-px bg-white/[0.1]" />
                  <span className="font-mono text-[10px] font-black text-[rgba(255,255,255,0.5)]">{totals?.totalEntries ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════
            CARD 2: NAVIGATE — Dark neutral.
            2-column tile grid.
           ════════════════════════════════════ */}
        <div
          className={cn("transition-all duration-400", open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3")}
          style={cardDelay(1)}
        >
          <div
            className="rounded-2xl p-3"
            style={{
              backgroundColor: "#0a0c14",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <div className="flex items-center gap-3 mb-2 px-1">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[rgba(255,255,255,0.3)]">Navigate</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
            <nav aria-label="Main navigation" className="grid grid-cols-2 gap-2">
              <TileCard href={dashboard()} icon={LayoutDashboard} label={t("nav.dashboard")} accent="#3b82f6" activeBg="#101e30"
                active={isActive(dashboard())} meta={totals ? `${totals.totalEntries} entries` : null} onClose={onClose} />
              <TileCard href={dataEntrySearch()} icon={Search} label={t("nav.search")} accent="#10b981" activeBg="#0a1a16"
                active={isActive(dataEntrySearch())} onClose={onClose} />
            </nav>
          </div>
        </div>

        {/* ════════════════════════════════════
            CARD 3: PERSONAL — Violet tinted.
           ════════════════════════════════════ */}
        <div
          className={cn("transition-all duration-400", open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3")}
          style={cardDelay(2)}
        >
          <div
            className="rounded-2xl p-3"
            style={{
              backgroundColor: "#0c0a16",
              border: "1px solid rgba(168,85,247,0.18)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <div className="flex items-center gap-3 mb-2 px-1">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[rgba(168,85,247,0.6)]">Personal</span>
              <div className="flex-1 h-px bg-[rgba(168,85,247,0.12)]" />
            </div>
            <nav aria-label="Personal" className="grid grid-cols-2 gap-2">
              <TileCard href={profile()} icon={User} label={t("nav.account")} accent="#a855f7" activeBg="#160e28"
                active={isActive(profile())} meta={profileDesignation ?? null} onClose={onClose} />
              <TileCard href={settingsAppearance()} icon={Settings} label={t("nav.appearance")} accent="#818cf8" activeBg="#141030"
                active={isActive(settingsAppearance())} onClose={onClose} />
            </nav>
          </div>
        </div>

        {/* ════════════════════════════════════
            CARD 4: ADMIN — Warm amber.
            (only if authorized)
           ════════════════════════════════════ */}
        {canAccessAdmin && (
          <div
            className={cn("transition-all duration-400", open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3")}
            style={cardDelay(3)}
          >
            <div
              className="rounded-2xl p-3"
              style={{
                backgroundColor: "#110f08",
                border: "1px solid rgba(245,158,11,0.22)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              <div className="flex items-center gap-3 mb-2 px-1">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[rgba(245,158,11,0.6)]">Admin</span>
                <div className="flex-1 h-px bg-[rgba(245,158,11,0.12)]" />
                {adminPendingCount > 0 && (
                  <span className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ backgroundColor: "#78350f", color: "#fbbf24" }}>
                    <span className="size-1.5 rounded-full bg-amber-400 animate-subtle-pulse" />{adminPendingCount}
                  </span>
                )}
              </div>
              <nav aria-label="Admin">
                <TileCard href={adminHome()} icon={Shield} label={t("nav.admin")} accent="#f59e0b" activeBg="#1a1508"
                  active={isActive(adminHome())} meta={adminPendingCount > 0 ? `${adminPendingCount} pending` : null}
                  badge={adminPendingCount > 0 ? adminPendingCount : null} onClose={onClose} />
              </nav>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════
            CARD 5: DOCK — Utility + Terminal.
           ════════════════════════════════════ */}
        <div
          className={cn("transition-all duration-400", open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3")}
          style={cardDelay(canAccessAdmin ? 4 : 3)}
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              backgroundColor: "#0a0c14",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            {/* Utility row */}
            <div className="px-3 py-2.5 flex items-center gap-2">
              {canAccessAdmin && (
                <Link href="/reset" onClick={onClose}
                  className="group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[rgba(255,255,255,0.4)] hover:text-red-400 transition-all"
                  style={{ backgroundColor: "#141620", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Trash2 className="size-3 group-hover:text-red-400 transition-colors" /><span>Reset</span>
                </Link>
              )}
              <div className="flex-1" />
              <button type="button" onClick={() => { onClose(); onSignOut(); }}
                className="group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[rgba(255,255,255,0.4)] hover:text-red-400 transition-all"
                style={{ backgroundColor: "#141620", border: "1px solid rgba(255,255,255,0.08)" }}>
                <LogOut className="size-3 group-hover:text-red-400 transition-colors" /><span>{t("nav.signOut")}</span>
              </button>
            </div>

            {/* Terminal status */}
            <div className="relative mx-3 mb-3 overflow-hidden rounded-xl" style={{ backgroundColor: "#071a14", border: "1px solid rgba(16,185,129,0.20)" }}>
              <div className="animate-scan-sweep" />
              <div className="relative px-3.5 py-2 flex items-center gap-2">
                <Terminal className="size-3 text-emerald-400/70" />
                <span className="font-mono text-[9px] font-bold tracking-wider text-emerald-400/80">TSEDA</span>
                <span className="size-1.5 rounded-full bg-emerald-400 animate-subtle-pulse" />
                <span className="font-mono text-[9px] font-bold tracking-wider text-emerald-400/80">ONLINE</span>
                {totals && (
                  <><div className="flex-1" /><span className="font-mono text-[9px] font-bold text-emerald-400/50">{totals.totalEntries}</span></>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
