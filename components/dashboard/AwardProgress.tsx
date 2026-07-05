"use client";

import { useMemo, useState } from "react";
import { Award, Sparkles, Target, CircleDashed, FileDown, GraduationCap, Loader2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useTranslation } from "@/lib/i18n/useTranslation";
import SelectDropdown from "@/components/controls/SelectDropdown";
import type { AwardScore, MetricScore } from "@/lib/awards/scoring";
import type { FeedbackYearClaim } from "@/lib/awards/feedback";

type AwardsResponse = {
  data?: { years: string[]; score: AwardScore | null };
};

type FeedbackResponse = {
  data?: { years: Record<string, FeedbackYearClaim> };
};

/**
 * "My Progress" — the faculty member's self-reflection panel for the award
 * year: points scored, section breakdown, strengths, quick wins, and an
 * honest note on which metrics are auto-tracked today. Self-view only by
 * design (admins have their own surface).
 */
export default function AwardProgress() {
  const { t } = useTranslation();
  const [year, setYear] = useState<string>("");

  const endpoint = year
    ? `/api/me/awards?year=${encodeURIComponent(year)}`
    : "/api/me/awards";
  const { data: body, mutate: refreshScore } = useApi<AwardsResponse>(endpoint);
  const { data: feedbackBody, mutate: refreshFeedback } = useApi<FeedbackResponse>("/api/me/feedback");

  const score = body?.data?.score ?? null;

  const yearOptions = useMemo(() => {
    const years = body?.data?.years ?? [];
    return years.map((value) => ({ label: value, value }));
  }, [body]);

  // Nothing recorded at all yet — the dashboard's empty state already guides
  // the first entry; this panel stays out of the way.
  if (!score) return null;

  const trackedNote = t("awards.coverageNote")
    .replace("{tracked}", String(score.coverage.tracked))
    .replace("{total}", String(score.coverage.total));

  return (
    <section
      aria-label={t("awards.sectionTitle")}
      className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-panel)] p-5 sm:p-6 animate-fade-in-up"
    >
      {/* ── Header row: title + year selector + total ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--color-primary)]/15">
            <Award className="size-4.5 text-[var(--color-primary)]" />
          </span>
          <div>
            <h2 className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
              {t("awards.sectionTitle")}
            </h2>
            <p className="text-xs text-[var(--color-text-tertiary)]">{trackedNote}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* One-click appraisal: the official submission document, filled
              from the same committed data this panel scores. */}
          <a
            href={`/api/me/awards/report?year=${encodeURIComponent(score.academicYear)}`}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border-strong)] px-3.5 py-2 text-xs font-bold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-raised)]"
            title={t("awards.downloadReportHint")}
          >
            <FileDown className="size-4" />
            {t("awards.downloadReport")}
          </a>
          <div className="w-56">
            <SelectDropdown
              value={score.academicYear}
              onChange={(value) => setYear(value)}
              options={yearOptions}
              placeholder={score.academicYear}
            />
          </div>
          <div className="rounded-xl bg-[var(--color-button-primary-bg)] px-4 py-2 text-center shadow-[0_0_12px_var(--color-glow-primary)]">
            <div className="text-xl font-black leading-none text-[var(--color-button-primary-text)]">
              {score.totalPoints}
            </div>
            <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-on-accent-muted)]">
              {t("awards.points")}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section bars ── */}
      <div className="mt-5 space-y-2">
        {score.sections.map((section) => {
          const sectionMax = score.metrics
            .filter((m) => m.section === section.section)
            .reduce((sum, m) => sum + m.maxPointsPerInstance, 0);
          const pct = sectionMax > 0 ? Math.min(100, (section.points / sectionMax) * 100) : 0;
          return (
            <div key={section.section} className="flex items-center gap-3">
              <div className="w-44 shrink-0 truncate text-xs font-medium text-[var(--color-text-secondary)]" title={section.label}>
                {section.label}
              </div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-inset)]">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="w-10 shrink-0 text-right text-xs font-bold text-[var(--color-text-primary)]">
                {section.points}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Student-feedback claim (S3): ODD/EVEN %, averaged into the tier ── */}
      <FeedbackClaimStrip
        academicYear={score.academicYear}
        claim={feedbackBody?.data?.years?.[score.academicYear] ?? null}
        onSaved={async () => {
          await Promise.all([refreshScore(), refreshFeedback()]);
        }}
      />

      {/* ── Insight chips: strengths / quick wins / not yet tracked ── */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <InsightGroup
          icon={<Sparkles className="size-3.5 text-[var(--color-status-success)]" />}
          title={t("awards.strengths")}
          emptyText={t("awards.noStrengthsYet")}
          items={score.strengths}
          renderPoints={(m) => `+${m.points}`}
        />
        <InsightGroup
          icon={<Target className="size-3.5 text-[var(--color-status-warning)]" />}
          title={t("awards.quickWins")}
          emptyText={t("awards.noQuickWins")}
          items={score.quickWins}
          renderPoints={(m) => t("awards.upTo").replace("{n}", String(m.maxPointsPerInstance))}
        />
        <InsightGroup
          icon={<CircleDashed className="size-3.5 text-[var(--color-text-muted)]" />}
          title={t("awards.notTracked")}
          emptyText={t("awards.allTracked")}
          items={score.metrics.filter((m) => m.status === "untracked").slice(0, 3)}
          renderPoints={(m) => t("awards.upTo").replace("{n}", String(m.maxPointsPerInstance))}
        />
      </div>
    </section>
  );
}

/**
 * S3 claim strip (Elan's ruling): enter the CAMU feedback percentage for
 * ODD/EVEN of the selected award year — the average drives the tier.
 * Keyed remount on updatedAt keeps inputs in sync without effects.
 */
function FeedbackClaimStrip({
  academicYear,
  claim,
  onSaved,
}: {
  academicYear: string;
  claim: FeedbackYearClaim | null;
  onSaved: () => Promise<void>;
}) {
  return (
    <FeedbackClaimForm
      key={`${academicYear}:${claim?.updatedAt ?? "none"}`}
      academicYear={academicYear}
      claim={claim}
      onSaved={onSaved}
    />
  );
}

function FeedbackClaimForm({
  academicYear,
  claim,
  onSaved,
}: {
  academicYear: string;
  claim: FeedbackYearClaim | null;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [odd, setOdd] = useState<string>(typeof claim?.odd === "number" ? String(claim.odd) : "");
  const [even, setEven] = useState<string>(typeof claim?.even === "number" ? String(claim.even) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validPercent = (v: string) => v.trim() === "" || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100);
  const valid = validPercent(odd) && validPercent(even) && (odd.trim() !== "" || even.trim() !== "");
  const dirty =
    odd !== (typeof claim?.odd === "number" ? String(claim.odd) : "") ||
    even !== (typeof claim?.even === "number" ? String(claim.even) : "");

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/feedback", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYear,
          odd: odd.trim() === "" ? null : Number(odd),
          even: even.trim() === "" ? null : Number(even),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? t("common.error"));
        return;
      }
      await onSaved();
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-20 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-inset)] px-2.5 py-1.5 text-xs font-bold text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-border-strong)]";

  return (
    <div className="mt-5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel-raised)] p-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          <GraduationCap className="size-3.5" />
          {t("awards.feedbackTitle")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
            {t("awards.feedbackOdd")}
            <input
              type="number" inputMode="decimal" min={0} max={100} step={0.1}
              value={odd || ""}
              onChange={(e) => setOdd(e.target.value)}
              disabled={busy}
              placeholder="92"
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
            {t("awards.feedbackEven")}
            <input
              type="number" inputMode="decimal" min={0} max={100} step={0.1}
              value={even || ""}
              onChange={(e) => setEven(e.target.value)}
              disabled={busy}
              placeholder="88"
              className={inputClass}
            />
          </label>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !valid || !dirty}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-button-primary-bg)] px-3 py-1.5 text-xs font-bold text-[var(--color-button-primary-text)] transition-opacity disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {t("awards.feedbackSave")}
          </button>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">
        {error ?? t("awards.feedbackHint")}
      </p>
    </div>
  );
}

function InsightGroup({
  icon,
  title,
  emptyText,
  items,
  renderPoints,
}: {
  icon: React.ReactNode;
  title: string;
  emptyText: string;
  items: MetricScore[];
  renderPoints: (m: MetricScore) => string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel-raised)] p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
        {icon}
        {title}
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">{emptyText}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((m) => (
            <li key={m.id} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate text-[var(--color-text-secondary)]" title={m.label}>
                {m.label}
              </span>
              <span className="shrink-0 font-bold text-[var(--color-text-primary)]">
                {renderPoints(m)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
