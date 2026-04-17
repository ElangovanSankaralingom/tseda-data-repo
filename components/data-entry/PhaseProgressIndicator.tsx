"use client";

import { memo, useState, useCallback } from "react";
import { FileText, Upload, Lock, Zap, Check, ChevronDown, ChevronUp, ArrowRight, Sparkles } from "lucide-react";
import { getCategoryConfig } from "@/data/categoryRegistry";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { type IncompleteField, scrollToField } from "@/lib/entries/incompleteFields";

type PhaseProgressIndicatorProps = {
  category: string;
  /** Stage 1 (pre-generate) field counts */
  stage1: { filled: number; total: number };
  /** Stage 2 (post-generate) field counts */
  stage2: { filled: number; total: number };
  /** Whether the entry has been generated (PDF exists) */
  isGenerated: boolean;
  /** Whether this entry is streak-eligible */
  streakEligible: boolean;
  /** Missing fields for stage 1 */
  missingStage1?: IncompleteField[];
  /** Missing fields for stage 2 */
  missingStage2?: IncompleteField[];
  /** Why finalise is disabled (from workflow engine) */
  finaliseDisabledReason?: string;
};

/**
 * A circular progress arc rendered as SVG.
 * Shows a ring that fills from 0–100%.
 */
function ProgressArc({
  percent,
  size = 44,
  strokeWidth = 3.5,
  accentColor,
  children,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  accentColor: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-raised)"
          strokeWidth={strokeWidth}
        />
        {/* Filled arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accentColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
          style={{
            filter: percent >= 100 ? `drop-shadow(0 0 4px ${accentColor})` : undefined,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/**
 * A clickable pill for a missing field — clicking scrolls to that field.
 */
const MissingFieldPill = memo(function MissingFieldPill({
  field,
  fieldLabel,
}: {
  field: IncompleteField;
  fieldLabel: string;
}) {
  const handleClick = useCallback(() => {
    scrollToField(field.key);
  }, [field.key]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] cursor-pointer"
      style={{
        background: "var(--color-surface-raised)",
        color: "var(--color-text-secondary)",
        border: "1px solid var(--color-border-subtle)",
      }}
      title={fieldLabel}
    >
      <span className="size-1.5 rounded-full bg-amber-400/70 shrink-0" />
      <span className="truncate max-w-[140px]">{fieldLabel}</span>
    </button>
  );
});

const PhaseProgressIndicator = memo(function PhaseProgressIndicator({
  category,
  stage1,
  stage2,
  isGenerated,
  streakEligible,
  missingStage1 = [],
  missingStage2 = [],
  finaliseDisabledReason,
}: PhaseProgressIndicatorProps) {
  const { t, fieldLabel: translateFieldLabel } = useTranslation();
  const config = getCategoryConfig(category);
  const chartHex = config?.color?.chartHex ?? "#60a5fa";
  const [expanded, setExpanded] = useState(false);

  const stage1Complete = stage1.filled >= stage1.total && stage1.total > 0;
  const stage2Complete = stage2.filled >= stage2.total && stage2.total > 0;
  const phase1Percent = stage1.total > 0 ? Math.round((stage1.filled / stage1.total) * 100) : 0;
  const phase2Percent = stage2.total > 0 ? Math.round((stage2.filled / stage2.total) * 100) : 0;

  const hasMissingFields = missingStage1.length > 0 || (isGenerated && missingStage2.length > 0);

  // Determine current milestone
  const currentMilestone = !stage1Complete ? "generate" : !isGenerated ? "generate" : !stage2Complete ? "finalise" : "done";

  return (
    <div className="mb-5">
      {/* ═══ MILESTONE TRACK ═══ */}
      <div
        className="rounded-xl border p-4 transition-all duration-300"
        style={{
          background: "var(--color-glass-bg)",
          borderColor: currentMilestone === "done"
            ? "rgba(34,197,94,0.25)"
            : "var(--color-border-default)",
        }}
      >
        {/* Two-milestone row */}
        <div className="flex items-center gap-3">
          {/* ── Milestone 1: Stage 1 → Generate ── */}
          <div className="flex flex-1 items-center gap-3">
            <ProgressArc
              percent={phase1Percent}
              accentColor={stage1Complete ? "var(--color-status-success)" : chartHex}
            >
              {stage1Complete ? (
                <Check className="size-4 text-[var(--color-status-success)]" strokeWidth={3} />
              ) : (
                <span
                  className="text-[10px] font-bold tabular-nums"
                  style={{ color: chartHex }}
                >
                  {phase1Percent}
                </span>
              )}
            </ProgressArc>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <FileText className="size-3.5 shrink-0" style={{ color: stage1Complete ? "var(--color-status-success)" : chartHex }} />
                <span
                  className="text-xs font-semibold"
                  style={{ color: stage1Complete ? "var(--color-status-success)" : "var(--color-text-primary)" }}
                >
                  {t('entry.fields')}
                </span>
                <span className="text-xs tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>
                  {stage1.filled}/{stage1.total}
                </span>
              </div>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                {stage1Complete ? t('entry.readyToGenerate') : t('entry.fillToGenerate')}
              </p>
            </div>
          </div>

          {/* ── Connector arrow ── */}
          <div className="flex shrink-0 flex-col items-center gap-0.5">
            <ArrowRight
              className="size-4"
              style={{
                color: stage1Complete ? "var(--color-status-success)" : "var(--color-text-muted)",
                opacity: stage1Complete ? 1 : 0.4,
              }}
            />
          </div>

          {/* ── Milestone 2: Stage 2 → Finalise ── */}
          <div className="flex flex-1 items-center gap-3">
            <ProgressArc
              percent={isGenerated ? phase2Percent : 0}
              accentColor={isGenerated && stage2Complete ? "var(--color-status-success)" : "rgb(16,185,129)"}
            >
              {!isGenerated ? (
                <Lock className="size-3.5" style={{ color: "var(--color-text-muted)" }} />
              ) : stage2Complete ? (
                <Check className="size-4 text-[var(--color-status-success)]" strokeWidth={3} />
              ) : (
                <span
                  className="text-[10px] font-bold tabular-nums"
                  style={{ color: "rgb(16,185,129)" }}
                >
                  {phase2Percent}
                </span>
              )}
            </ProgressArc>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {!isGenerated ? (
                  <Lock className="size-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                ) : (
                  <Upload className="size-3.5 shrink-0" style={{ color: isGenerated && stage2Complete ? "var(--color-status-success)" : "rgb(16,185,129)" }} />
                )}
                <span
                  className="text-xs font-semibold"
                  style={{
                    color: !isGenerated
                      ? "var(--color-text-muted)"
                      : stage2Complete
                        ? "var(--color-status-success)"
                        : "var(--color-text-primary)",
                  }}
                >
                  {t('entry.supportingDocuments')}
                </span>
                {isGenerated ? (
                  <span className="text-xs tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>
                    {stage2.filled}/{stage2.total}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                {!isGenerated
                  ? t('entry.generateFirst')
                  : stage2Complete
                    ? t('entry.readyToFinalise')
                    : t('entry.uploadToFinalise')}
              </p>
            </div>
          </div>

          {/* ── Right: streak badge + expand toggle ── */}
          <div className="flex shrink-0 items-center gap-2">
            {streakEligible ? (
              <span className="flex items-center gap-1 rounded-full bg-[var(--color-status-warning-bg)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-status-warning)] border border-[var(--color-status-warning-border)]">
                <Zap className="size-3" />
                {t('entry.streakEntry')}
              </span>
            ) : null}
            {hasMissingFields ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all hover:bg-[var(--color-surface-raised)] active:scale-95"
                style={{ color: "var(--color-text-secondary)" }}
                aria-expanded={expanded}
                aria-label={expanded ? "Hide missing fields" : "Show missing fields"}
              >
                {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                <span className="hidden sm:inline">{t('entry.details')}</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* ═══ COMPLETION CELEBRATION ═══ */}
        {currentMilestone === "done" ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--color-status-success-bg)" }}>
            <Sparkles className="size-4 text-[var(--color-status-success)]" />
            <span className="text-xs font-medium text-[var(--color-status-success)]">{t('entry.allFieldsComplete')}</span>
          </div>
        ) : null}

        {/* ═══ EXPANDED: MISSING FIELDS ═══ */}
        {expanded && hasMissingFields ? (
          <div
            className="mt-3 space-y-3 animate-fade-in-up rounded-lg p-3"
            style={{ background: "var(--color-surface-inset)" }}
          >
            {/* Stage 1 missing */}
            {missingStage1.length > 0 ? (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: chartHex }}>
                  {t('entry.missingForGenerate')} ({missingStage1.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {missingStage1.map((field) => (
                    <MissingFieldPill
                      key={field.key}
                      field={field}
                      fieldLabel={translateFieldLabel(field.key)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Stage 2 missing */}
            {isGenerated && missingStage2.length > 0 ? (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "rgb(16,185,129)" }}>
                  {t('entry.missingForFinalise')} ({missingStage2.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {missingStage2.map((field) => (
                    <MissingFieldPill
                      key={field.key}
                      field={field}
                      fieldLabel={translateFieldLabel(field.key)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Finalise disabled reason */}
            {isGenerated && finaliseDisabledReason && !stage2Complete ? (
              <p className="text-[11px] italic" style={{ color: "var(--color-text-tertiary)" }}>
                {finaliseDisabledReason}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
});

export default PhaseProgressIndicator;
