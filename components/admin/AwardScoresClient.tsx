"use client";
import { notifyDataChanged } from "@/lib/ui/appRefresh";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Award, FileDown, Loader2, SlidersHorizontal, UserSearch } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { formatDate } from "@/lib/i18n/locale";
import { adminAwardPoints } from "@/lib/entryNavigation";
import SelectDropdown from "@/components/controls/SelectDropdown";
import FacultySelect, { type FacultySelection } from "@/components/controls/FacultySelect";
import type { AwardScore, MetricScore, MetricScoreStatus } from "@/lib/awards/scoring";
import type { InterviewAward } from "@/lib/awards/interview";

type AwardsResponse = {
  data?: { years: string[]; score: AwardScore | null };
};

type InterviewResponse = {
  data?: { awards: Record<string, InterviewAward> };
};

/**
 * Admin faculty scores view (roadmap #15) — the surface the award chair
 * runs the award from: pick a faculty member, pick a year, read the FULL
 * per-metric breakdown (the self-view shows insight chips; the chair needs
 * every metric with counts and deriver notes), download the appraisal.
 * NO peer-visible leaderboard by design (privacy decision, 2026-07).
 */
export default function AwardScoresClient({ canAwardCommittee }: { canAwardCommittee: boolean }) {
  const { t } = useTranslation();
  const [faculty, setFaculty] = useState<FacultySelection>({ name: "", email: "" });
  const [year, setYear] = useState<string>("");

  const endpoint = faculty.email
    ? `/api/admin/awards?email=${encodeURIComponent(faculty.email)}${
        year ? `&year=${encodeURIComponent(year)}` : ""
      }`
    : null;
  const { data: body, isLoading, mutate: refreshScore } = useApi<AwardsResponse>(endpoint);

  const score = body?.data?.score ?? null;
  const yearOptions = useMemo(() => {
    const years = body?.data?.years ?? [];
    return years.map((value) => ({ label: value, value }));
  }, [body]);

  // Committee awards for the resolved year — prefills the inline editors.
  const interviewEndpoint =
    canAwardCommittee && faculty.email && score
      ? `/api/admin/awards/interview?email=${encodeURIComponent(faculty.email)}&year=${encodeURIComponent(score.academicYear)}`
      : null;
  const { data: interviewBody, mutate: refreshAwards } = useApi<InterviewResponse>(interviewEndpoint);
  const interviewAwards = interviewBody?.data?.awards ?? {};

  return (
    <div className="space-y-5">
      {/* ── Picker row: faculty + year + download ── */}
      <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-panel)] p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              {t("awardsAdmin.pickFaculty")}
            </label>
            <FacultySelect
              value={faculty}
              onChange={(next) => {
                setFaculty(next);
                setYear("");
              }}
              disabledEmails={new Set<string>()}
              placeholder={t("awardsAdmin.searchFaculty")}
            />
          </div>
          {score ? (
            <>
              <div className="w-full sm:w-56">
                <SelectDropdown
                  value={score.academicYear}
                  onChange={(value) => setYear(value)}
                  options={yearOptions}
                  placeholder={score.academicYear}
                />
              </div>
              <a
                href={`/api/admin/awards/report?email=${encodeURIComponent(faculty.email)}&year=${encodeURIComponent(score.academicYear)}`}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border-strong)] px-3.5 py-2.5 text-xs font-bold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-raised)]"
                title={t("awards.downloadReportHint")}
              >
                <FileDown className="size-4" />
                {t("awards.downloadReport")}
              </a>
            </>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {t("awardsAdmin.privacyNote")}
          </p>
          {canAwardCommittee ? (
            <Link
              href={adminAwardPoints()}
              className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              <SlidersHorizontal className="size-3.5" />
              {t("awardsAdmin.configurePoints")}
            </Link>
          ) : null}
        </div>
      </div>

      {/* ── Result panel ── */}
      {!faculty.email ? (
        <EmptyState icon={<UserSearch className="size-5" />} text={t("awardsAdmin.pickHint")} />
      ) : isLoading ? (
        <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] p-8">
          <div className="h-2 w-1/3 animate-pulse rounded-full bg-[var(--color-surface-inset)]" />
          <div className="mt-3 h-2 w-2/3 animate-pulse rounded-full bg-[var(--color-surface-inset)]" />
        </div>
      ) : !score ? (
        <EmptyState icon={<Award className="size-5" />} text={t("awardsAdmin.noActivity")} />
      ) : (
        <ScorePanel
          score={score}
          facultyEmail={faculty.email}
          canAwardCommittee={canAwardCommittee}
          interviewAwards={interviewAwards}
          onAwardSaved={async () => {
            await Promise.all([refreshScore(), refreshAwards()]);
            notifyDataChanged();
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border-default)] p-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--color-surface-raised)] text-[var(--color-icon-muted)]">
        {icon}
      </span>
      <p className="max-w-sm text-sm text-[var(--color-text-tertiary)]">{text}</p>
    </div>
  );
}

const STATUS_STYLE: Record<MetricScoreStatus, string> = {
  scored:
    "bg-[var(--color-status-success-bg)] text-[var(--color-status-success)] border-[var(--color-status-success-border)]",
  zero: "bg-[var(--color-surface-raised)] text-[var(--color-text-tertiary)] border-[var(--color-border-subtle)]",
  untracked:
    "bg-[var(--color-surface-inset)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]",
  manual:
    "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning)] border-[var(--color-status-warning-border)]",
};

type CommitteeContext = {
  facultyEmail: string;
  academicYear: string;
  interviewAwards: Record<string, InterviewAward>;
  onAwardSaved: () => Promise<void>;
};

function ScorePanel({
  score,
  facultyEmail,
  canAwardCommittee,
  interviewAwards,
  onAwardSaved,
}: {
  score: AwardScore;
  facultyEmail: string;
  canAwardCommittee: boolean;
  interviewAwards: Record<string, InterviewAward>;
  onAwardSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const committee: CommitteeContext | null = canAwardCommittee
    ? { facultyEmail, academicYear: score.academicYear, interviewAwards, onAwardSaved }
    : null;

  const statusLabel: Record<MetricScoreStatus, string> = {
    scored: t("awardsAdmin.statusScored"),
    zero: t("awardsAdmin.statusZero"),
    untracked: t("awardsAdmin.statusUntracked"),
    manual: t("awardsAdmin.statusManual"),
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Total banner */}
      <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-panel)] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--color-primary)]/15">
            <Award className="size-4.5 text-[var(--color-primary)]" />
          </span>
          <div>
            <div className="text-sm font-bold text-[var(--color-text-primary)]">
              {score.academicYear}
            </div>
            <div className="text-xs text-[var(--color-text-tertiary)]">
              {t("awards.coverageNote")
                .replace("{tracked}", String(score.coverage.tracked))
                .replace("{total}", String(score.coverage.total))}
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-[var(--color-button-primary-bg)] px-4 py-2 text-center shadow-[0_0_12px_var(--color-glow-primary)]">
          <div className="text-xl font-black leading-none text-[var(--color-button-primary-text)]">
            {score.totalPoints}
          </div>
          <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-on-accent-muted)]">
            {t("awardsAdmin.totalPoints")}
          </div>
        </div>
      </div>

      {/* One card per section: header + full metric rows */}
      {score.sections.map((section) => {
        const metrics = score.metrics.filter((m) => m.section === section.section);
        return (
          <section
            key={section.section}
            className="overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-panel)]"
          >
            <header className="flex items-center justify-between border-b border-[var(--color-divider)] bg-[var(--color-surface-panel-raised)] px-4 py-3">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{section.label}</h3>
              <span className="text-sm font-black text-[var(--color-text-primary)]">
                {section.points}
                <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  {t("awards.points")}
                </span>
              </span>
            </header>
            <ul className="divide-y divide-[var(--color-divider)]">
              {metrics.map((metric) => (
                <MetricRow
                  key={metric.id}
                  metric={metric}
                  statusLabel={statusLabel[metric.status]}
                  committee={metric.source === "interview" ? committee : null}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function MetricRow({
  metric,
  statusLabel,
  committee,
}: {
  metric: MetricScore;
  statusLabel: string;
  committee: CommitteeContext | null;
}) {
  const { t } = useTranslation();
  const award = committee?.interviewAwards[metric.id];
  return (
    <li className="px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span
          className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[metric.status]}`}
        >
          {statusLabel}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--color-text-secondary)]" title={metric.label}>
          {metric.label}
        </span>
        {metric.count > 0 ? (
          <span className="shrink-0 text-[11px] text-[var(--color-text-tertiary)]">
            {t("awardsAdmin.count")}: {metric.count}
          </span>
        ) : null}
        <span className="w-12 shrink-0 text-right text-sm font-bold text-[var(--color-text-primary)]">
          {metric.points}
        </span>
      </div>
      {metric.notes.length > 0 ? (
        <ul className="mt-1 space-y-0.5 pl-1">
          {metric.notes.map((note, index) => (
            <li key={index} className="text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
              — {note}
            </li>
          ))}
        </ul>
      ) : null}
      {committee ? (
        <CommitteeEditor
          key={`${metric.id}:${award?.awardedAt ?? "none"}`}
          metric={metric}
          award={award}
          committee={committee}
        />
      ) : null}
    </li>
  );
}

/**
 * Inline committee entry (roadmap #16) — settings-tier admins type the
 * interview points + a one-line note; the score and the appraisal document
 * pick both up immediately. Keyed remount on `awardedAt` keeps the inputs
 * in sync after each save without effect-driven state.
 */
function CommitteeEditor({
  metric,
  award,
  committee,
}: {
  metric: MetricScore;
  award: InterviewAward | undefined;
  committee: CommitteeContext;
}) {
  const { t, language } = useTranslation();
  const [points, setPoints] = useState<string>(award ? String(award.points) : "");
  const [note, setNote] = useState<string>(award?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(points);
  const valid = points.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= metric.maxPointsPerInstance;
  const dirty = points !== (award ? String(award.points) : "") || note !== (award?.note ?? "");

  async function submit(reset: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/awards/interview", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          reset
            ? { email: committee.facultyEmail, academicYear: committee.academicYear, metricId: metric.id, reset: true }
            : { email: committee.facultyEmail, academicYear: committee.academicYear, metricId: metric.id, points: parsed, note },
        ),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? t("common.error"));
        return;
      }
      await committee.onAwardSaved();
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel-raised)] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={metric.maxPointsPerInstance}
          step={0.5}
          value={points || ""}
          onChange={(e) => setPoints(e.target.value)}
          disabled={busy}
          aria-label={t("awardsAdmin.pointsCol")}
          className="w-20 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-inset)] px-2.5 py-1.5 text-xs font-bold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-strong)]"
        />
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {t("awardsAdmin.maxHint").replace("{n}", String(metric.maxPointsPerInstance))}
        </span>
        <input
          value={note || ""}
          onChange={(e) => setNote(e.target.value)}
          disabled={busy}
          maxLength={300}
          placeholder={t("awardsAdmin.committeeNotePlaceholder")}
          className="min-w-40 flex-1 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-inset)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-border-strong)]"
        />
        <button
          type="button"
          onClick={() => void submit(false)}
          disabled={busy || !valid || !dirty}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-button-primary-bg)] px-3 py-1.5 text-xs font-bold text-[var(--color-button-primary-text)] transition-opacity disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {t("awardsAdmin.saveAward")}
        </button>
        {award ? (
          <button
            type="button"
            onClick={() => void submit(true)}
            disabled={busy}
            className="rounded-lg border border-[var(--color-border-default)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] disabled:opacity-40"
          >
            {t("awardsAdmin.clearAward")}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1.5 text-[11px] text-[var(--color-status-error)]">{error}</p>
      ) : award ? (
        <p className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">
          {t("awardsAdmin.awardedByLine")
            .replace("{name}", award.awardedBy)
            .replace("{date}", formatDate(award.awardedAt, language))}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">{t("awardsAdmin.committeeHint")}</p>
      )}
    </div>
  );
}
