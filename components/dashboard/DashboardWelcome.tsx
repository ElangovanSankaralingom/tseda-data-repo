"use client";

import React from "react";
import { Flame, Trophy, FileText, Clock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { formatNumber } from "@/lib/i18n/locale";
import { useTiltEffect } from "@/hooks/useTiltEffect";
import type { TranslationKey } from "@/lib/i18n";
import StreakRing from "./StreakRing";

/*
  ───────────────────────────────────────────────────────
   COMMAND STRIP — Formal institutional hero bar.

   Surface depth system (4 levels):
   L0: Body bg (deepest)
   L1: Card bg — subtle primary wash gradient
   L2: Inset panels — white/[0.06-0.08]
   L3: Bright panels — white/[0.12-0.16]
   L4: Hero elements — accent-colored backgrounds

   Colors are functional, not decorative.
  ───────────────────────────────────────────────────────
*/

export default function DashboardWelcome({
  greetingKey,
  firstName,
  totalEntries,
  streakActivated,
  streakWins,
  hasAnyEntries,
  draftCount,
  editRequestedCount,
}: {
  greetingKey: string;
  firstName: string;
  totalEntries: number;
  streakActivated: number;
  streakWins: number;
  hasAnyEntries: boolean;
  draftCount: number;
  editRequestedCount: number;
}) {
  const { t, language } = useTranslation();
  const greeting = t(`dashboard.${greetingKey}` as TranslationKey);

  const welcomeSubtext = !hasAnyEntries
    ? t("dashboard.startFirstEntry")
    : streakActivated > 0
    ? `${streakActivated} ${streakActivated === 1 ? t("dashboard.entryToComplete") : t("dashboard.entriesToComplete")}`
    : streakWins > 0
    ? t("dashboard.allEntriesComplete")
    : t("dashboard.heresYourProgress");

  const { ref, style: tiltStyle, lightStyle, isHovered, handlers } = useTiltEffect(1.5);

  const boostedLightStyle: React.CSSProperties = {
    ...lightStyle,
    opacity: isHovered ? 0.04 : 0,
  };

  return (
    <div className="animate-fade-in-up">
    <div ref={ref} style={tiltStyle} {...handlers}>
    <div
      className="relative overflow-hidden rounded-3xl border border-white/[0.1]"
      style={{
        background: "linear-gradient(135deg, rgba(0,0,0,0.45) 0%, rgba(30,58,95,0.18) 50%, rgba(0,0,0,0.4) 100%)",
      }}
    >
      {/* Holographic light */}
      <div style={boostedLightStyle} />
      {/* ── Accent top bar ── */}
      <div className="h-[3px] bg-[var(--color-primary)] animate-bar-draw" />

      <div className="p-8 sm:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-10">

          {/* ═══ LEFT: Identity ═══ */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-[rgba(255,255,255,0.45)]">
                  {greeting}
                </p>
                <div className="h-px flex-1 bg-white/[0.06]" />
                <span className="font-mono text-xs font-semibold tracking-wider text-[rgba(255,255,255,0.35)]">
                  {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase()}
                </span>
              </div>
              <div className="mt-4 animate-text-reveal">
                <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                  {firstName}
                </h1>
              </div>
              <p className="mt-3 text-sm text-[rgba(255,255,255,0.55)] font-medium max-w-sm leading-relaxed">
                {welcomeSubtext}
              </p>
            </div>

            {/* ── Streak ring gauges — raised surface ── */}
            {hasAnyEntries && (streakActivated > 0 || streakWins > 0) && (
              <div className="mt-7 rounded-2xl px-5 py-4 inline-flex items-center gap-6 self-start" style={{ backgroundColor: "#0f111c", border: "1px solid rgba(255,255,255,0.08)" }}>
                {streakActivated > 0 && (
                  <StreakRing
                    icon={Flame}
                    value={streakActivated}
                    maxValue={Math.max(totalEntries, streakActivated)}
                    label={t("streak.activated")}
                    wins={streakWins}
                    ringColor="#fbbf24"
                    valueColor="#fbbf24"
                  />
                )}
                {streakActivated > 0 && streakWins > 0 && (
                  <div className="h-10 w-px bg-white/[0.1]" />
                )}
                {streakWins > 0 && (
                  <StreakRing
                    icon={Trophy}
                    value={streakWins}
                    maxValue={Math.max(streakActivated, streakWins)}
                    label={t("streak.won")}
                    wins={streakWins}
                    ringColor="var(--color-primary)"
                    valueColor="var(--color-primary)"
                  />
                )}
              </div>
            )}
          </div>

          {/* ═══ RIGHT: Bright counter panel (L3) ═══ */}
          {hasAnyEntries && (
            <div className="lg:w-72 shrink-0">
              <div className="h-full overflow-hidden rounded-2xl bg-white/[0.14] border border-white/[0.18] flex flex-col">
                <div className="h-[2px] bg-[var(--color-primary)] opacity-50" />

                <div className="flex-1 p-6 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-[rgba(255,255,255,0.55)]">
                      {t("dashboard.totalEntries")}
                    </div>
                    <div className="mt-2 font-mono text-5xl font-black tracking-tighter text-white leading-none">
                      {formatNumber(totalEntries, language)}
                    </div>
                  </div>

                  {/* Dark inset micro-stats (L1 inside L3 — creates depth) */}
                  <div className="mt-6 flex gap-3">
                    <div className="flex-1 rounded-xl px-4 py-3" style={{ backgroundColor: "#0c0e16", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-[rgba(255,255,255,0.45)]" />
                        <span className="font-mono text-lg font-black text-[rgba(255,255,255,0.75)]">
                          {formatNumber(draftCount, language)}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-[rgba(255,255,255,0.45)]">
                        {t("dashboard.drafts")}
                      </div>
                    </div>
                    {editRequestedCount > 0 && (
                      <div
                        className="flex-1 rounded-xl px-4 py-3"
                        style={{ backgroundColor: "#1c1306", border: "1px solid rgba(217,119,6,0.25)" }}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="size-4 text-amber-400/80" />
                          <span className="font-mono text-lg font-black text-amber-400">
                            {formatNumber(editRequestedCount, language)}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] font-semibold text-amber-400/50">
                          {t("dashboard.editRequested")}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Status bar — own surface ── */}
        <div className="mt-8 rounded-xl px-5 py-3.5 flex items-center gap-4" style={{ backgroundColor: "#080a12", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-[var(--color-primary)] text-xs font-bold">{">"}</span>
          <span className="font-mono text-[11px] font-semibold tracking-wider text-[rgba(255,255,255,0.35)]">
            TSEDA
          </span>
          <span className="size-1.5 rounded-full bg-emerald-400 animate-subtle-pulse" />
          <span className="font-mono text-[11px] font-semibold tracking-wider text-emerald-400/70">
            ONLINE
          </span>
          <div className="h-3 w-px bg-white/[0.08]" />
          <span className="font-mono text-[11px] font-medium tracking-wider text-[rgba(255,255,255,0.35)]">
            {totalEntries} ENTRIES
          </span>
          <div className="h-3 w-px bg-white/[0.08]" />
          <span className="font-mono text-[11px] font-medium tracking-wider text-[rgba(255,255,255,0.35)]">
            {streakActivated + streakWins} STREAKS
          </span>
        </div>
      </div>
    </div>
    </div>
    </div>
  );
}
