"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Award, Flame, CircleCheckBig } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useTiltEffect } from "@/hooks/useTiltEffect";
import { useApi } from "@/hooks/useApi";
import type { AwardScore } from "@/lib/awards/scoring";
import type { TranslationKey } from "@/lib/i18n";

/*
  ───────────────────────────────────────────────────────
   COMMAND STRIP — identity + ACTION (2026-07 redesign).

   Numbers were repeated three times on the dashboard (hero rings, hero
   counter panel, analytics cards). Ruling: the HERO carries identity and
   the next action; the ANALYTICS STRIP owns every number. So the hero
   shows the greeting and "continue where you left off" — the running
   entries a click away — and nothing that the cards below restate.
  ───────────────────────────────────────────────────────
*/

export type ContinueRow = {
  id: string;
  categoryLabel: string;
  route: string;
};

type AwardsResponse = { data?: { years: string[]; score: AwardScore | null } };

/** One hook, two surfaces: the identity chip (when the continue card is
 *  busy) or the split-up card (when all caught up). Same SWR key as the
 *  award panel below — one request, deduped, refreshed by the update bus. */
function useAwardScore(): AwardScore | null {
  const { data: body } = useApi<AwardsResponse>("/api/me/awards");
  return body?.data?.score ?? null;
}

/** Headline award number (Elan, 2026-07): total points for the latest
 *  award year, right in the hero — shown only while the right card is
 *  occupied by continue-links, so the number never appears twice. */
function HeroAwardPoints({ score }: { score: AwardScore | null }) {
  const { t } = useTranslation();
  if (!score) return null;
  return (
    <div className="mt-5 inline-flex items-center gap-3 rounded-2xl border border-[var(--color-surface-on-accent)] bg-[var(--color-surface-on-accent)] px-4 py-2.5">
      <span className="flex size-8 items-center justify-center rounded-xl bg-[var(--color-status-warning)]/20">
        <Award className="size-4 text-[var(--color-status-warning)]" />
      </span>
      <div>
        <div className="font-mono text-xl font-black leading-none tabular-nums text-[var(--color-text-on-accent)]">
          {score.totalPoints}
        </div>
        <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-on-accent-muted)]">
          {t("dashboard.awardPoints")} · {score.academicYear.replace("Academic Year ", "")}
        </div>
      </div>
    </div>
  );
}

/** All-caught-up card body (Elan: "have total point here, like a split up"):
 *  the freed-up card shows the award total + per-section breakdown. Section
 *  labels come from the T'SEDA rulebook data (same source the award panel
 *  renders), so the split can never disagree with the panel below. */
function AwardSplitBody({ score }: { score: AwardScore }) {
  const { t } = useTranslation();
  return (
    <div className="mt-3">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-3xl font-black leading-none tabular-nums text-[var(--color-text-primary)]">
          {score.totalPoints}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
          {t("dashboard.awardPoints")} · {score.academicYear.replace("Academic Year ", "")}
        </span>
      </div>
      <div className="mt-3 space-y-1 border-t border-[var(--color-divider)] pt-3">
        {score.sections.map((section) => {
          const scored = section.points > 0;
          return (
            <div key={section.section} className="flex items-baseline justify-between gap-3 text-xs">
              <span
                className={`min-w-0 flex-1 truncate ${scored ? "font-medium text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]"}`}
                title={section.label}
              >
                {section.label}
              </span>
              <span
                className={`shrink-0 font-mono font-bold tabular-nums ${scored ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}`}
              >
                {section.points}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardWelcome({
  greetingKey,
  firstName,
  hasAnyEntries,
  streakActivated,
  streakWins,
  continueRows = [],
}: {
  greetingKey: string;
  firstName: string;
  hasAnyEntries: boolean;
  streakActivated: number;
  streakWins: number;
  /** Running (activated) entries — the hero's call to action. */
  continueRows?: ContinueRow[];
}) {
  const { t } = useTranslation();
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

  const rows = continueRows.slice(0, 3);
  const score = useAwardScore();
  // One home per number: with continue-links in the card, the total rides
  // the identity chip; caught up, the card owns total + split-up instead.
  const showSplitCard = rows.length === 0 && !!score;

  return (
    <div className="animate-fade-in-up">
    <div ref={ref} style={tiltStyle} {...handlers}>
    <div
      className="relative overflow-hidden rounded-3xl border border-[var(--color-surface-on-accent)]"
      style={{
        background:
          "linear-gradient(135deg, var(--color-band-from) 0%, var(--color-band-to) 100%)",
        boxShadow:
          "0 1px 2px rgba(20,30,70,0.05), 0 12px 28px -22px rgba(42,72,206,0.22)",
      }}
    >
      {/* Holographic light */}
      <div style={boostedLightStyle} />
      {/* ── Accent top bar (brass on the lapis band) ── */}
      <div className="h-[3px] bg-[var(--color-status-warning)] animate-bar-draw" />

      <div className="p-8 sm:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-10">

          {/* ═══ LEFT: Identity ═══ */}
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-on-accent-muted)]">
                {greeting}
              </p>
              <div className="h-px flex-1 bg-[var(--color-surface-on-accent)]" />
              <span className="font-mono text-xs font-semibold tracking-wider text-[var(--color-text-on-accent-muted)]">
                {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase()}
              </span>
            </div>
            <div className="mt-4 animate-text-reveal">
              <h1 className="text-[36px] font-extrabold tracking-[-0.03em] text-[var(--color-text-on-accent)] sm:text-[42px]">
                {firstName}
              </h1>
            </div>
            <p className="mt-3 text-sm text-[var(--color-text-on-accent-muted)] font-medium max-w-sm leading-relaxed">
              {welcomeSubtext}
            </p>
            {hasAnyEntries && !showSplitCard && <HeroAwardPoints score={score} />}
          </div>

          {/* ═══ RIGHT: Continue where you left off — ACTION, not numbers ═══ */}
          {hasAnyEntries && (
            <div className="lg:w-96 shrink-0">
              <div className="h-full overflow-hidden rounded-2xl bg-[var(--color-surface-panel-tile)] border border-[var(--color-border-default)] flex flex-col" style={{ boxShadow: "0 7px 16px -12px rgba(10,16,42,0.16)" }}>
                <div className="h-[2px] bg-[var(--color-status-warning)] opacity-60" />
                <div className="flex-1 p-5">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
                    {rows.length > 0 ? <Flame className="size-3.5 text-[var(--color-status-warning)]" /> : <CircleCheckBig className="size-3.5 text-[var(--color-status-success)]" />}
                    {rows.length > 0 ? t("dashboard.continueTitle") : t("dashboard.allCaughtUpTitle")}
                  </div>

                  {rows.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {rows.map((row) => (
                        <Link
                          key={row.id}
                          href={row.route}
                          className="group flex items-center gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-3.5 py-2.5 transition-all hover:border-[var(--color-border-strong)] hover:-translate-y-px"
                        >
                          <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-status-warning)] animate-subtle-pulse" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text-primary)]">
                            {row.categoryLabel}
                          </span>
                          <span className="shrink-0 text-[11px] font-semibold text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)]">
                            {t("dashboard.finishIt")}
                          </span>
                          <ArrowRight className="size-3.5 shrink-0 text-[var(--color-icon-muted)] transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      ))}
                    </div>
                  ) : showSplitCard && score ? (
                    <AwardSplitBody score={score} />
                  ) : (
                    <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-tertiary)]">
                      {t("dashboard.allCaughtUpBody")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Status bar — ambient ticker, no repeated stats ── */}
        <div className="mt-8 rounded-xl px-5 py-3.5 flex items-center gap-4" style={{ backgroundColor: "var(--color-surface-inset)", borderColor: "var(--color-border-subtle)", borderWidth: "1px", boxShadow: "0 6px 18px -10px rgba(10,16,42,0.30)" }}>
          <span className="text-[var(--color-primary)] text-xs font-bold">{">"}</span>
          <span className="font-mono text-[11px] font-semibold tracking-wider text-[var(--color-text-tertiary)]">
            TSEDA
          </span>
          <span className="size-1.5 rounded-full bg-[var(--color-status-success)] animate-subtle-pulse" />
          <span className="font-mono text-[11px] font-semibold tracking-wider text-[var(--color-status-success)]/70">
            ONLINE
          </span>
        </div>
      </div>
    </div>
    </div>
    </div>
  );
}
