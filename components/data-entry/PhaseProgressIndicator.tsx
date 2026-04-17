"use client";

import { memo } from "react";
import { FileText, Upload, Lock, Zap, Check } from "lucide-react";
import { getCategoryConfig } from "@/data/categoryRegistry";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { AutoSavePhase } from "@/hooks/useAutoSave";

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
  /** Auto-save indicator phase */
  autoSavePhase?: AutoSavePhase;
};

const PhaseProgressIndicator = memo(function PhaseProgressIndicator({
  category,
  stage1,
  stage2,
  isGenerated,
  streakEligible,
  autoSavePhase,
}: PhaseProgressIndicatorProps) {
  const { t } = useTranslation();
  const config = getCategoryConfig(category);
  const accent = config?.color ?? { bar: "from-[var(--color-text-muted)] to-[var(--color-text-secondary)]" };

  const stage1Complete = stage1.filled >= stage1.total && stage1.total > 0;
  const stage2Complete = stage2.filled >= stage2.total && stage2.total > 0;
  const totalFields = stage1.total + (isGenerated ? stage2.total : 0);
  const totalFilled = stage1.filled + (isGenerated ? stage2.filled : 0);
  const overallPercent = totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0;

  // Phase 1 bar width (proportion of overall)
  const phase1Weight = totalFields > 0 ? stage1.total / totalFields : 1;
  const phase1Percent = stage1.total > 0 ? Math.round((stage1.filled / stage1.total) * 100) : 0;
  const phase2Percent = stage2.total > 0 ? Math.round((stage2.filled / stage2.total) * 100) : 0;

  return (
    <div className="mb-5">
      {/* Phase labels row */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Phase 1 */}
          <div className="flex items-center gap-1.5">
            <div
              className="flex size-5 items-center justify-center rounded"
              style={{
                background: stage1Complete
                  ? "rgba(34,197,94,0.15)"
                  : "var(--color-surface-raised)",
              }}
            >
              {stage1Complete ? (
                <Check className="size-3 text-emerald-500" strokeWidth={3} />
              ) : (
                <FileText className="size-3" style={{ color: "var(--color-icon-default)" }} />
              )}
            </div>
            <span
              className="text-xs font-medium"
              style={{ color: stage1Complete ? "rgb(34,197,94)" : "var(--color-text-secondary)" }}
            >
              {t('entry.fields')}
            </span>
            <span
              className="text-xs tabular-nums"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {stage1.filled}/{stage1.total}
            </span>
          </div>

          {/* Phase 2 */}
          <div className="flex items-center gap-1.5">
            <div
              className="flex size-5 items-center justify-center rounded"
              style={{
                background: isGenerated && stage2Complete
                  ? "rgba(34,197,94,0.15)"
                  : "var(--color-surface-raised)",
              }}
            >
              {!isGenerated ? (
                <Lock className="size-3" style={{ color: "var(--color-text-muted)" }} />
              ) : stage2Complete ? (
                <Check className="size-3 text-emerald-500" strokeWidth={3} />
              ) : (
                <Upload className="size-3" style={{ color: "var(--color-icon-default)" }} />
              )}
            </div>
            <span
              className="text-xs font-medium"
              style={{
                color: !isGenerated
                  ? "var(--color-text-muted)"
                  : stage2Complete
                    ? "rgb(34,197,94)"
                    : "var(--color-text-secondary)",
              }}
            >
              {t('entry.supportingDocuments')}
            </span>
            {isGenerated ? (
              <span
                className="text-xs tabular-nums"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {stage2.filled}/{stage2.total}
              </span>
            ) : (
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t('entry.generate')}
              </span>
            )}
          </div>
        </div>

        {/* Right side: streak badge + auto-save + overall */}
        <div className="flex items-center gap-3">
          {streakEligible ? (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-500">
              <Zap className="size-3" />
              {t('entry.streakEntry')}
            </span>
          ) : null}

          {autoSavePhase === "saving" ? (
            <span
              className="text-[10px] uppercase tracking-wider animate-pulse"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {t('entry.saving')}
            </span>
          ) : autoSavePhase === "saved" ? (
            <span
              className="text-[10px] uppercase tracking-wider"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {t('entry.saved')}
            </span>
          ) : null}

          <span
            className="text-xs font-semibold tabular-nums"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {overallPercent}%
          </span>
        </div>
      </div>

      {/* Segmented progress bar */}
      <div className="flex gap-1 h-1.5">
        {/* Phase 1 segment */}
        <div
          className="relative flex-1 rounded-full overflow-hidden"
          style={{
            background: "var(--color-surface-raised)",
            flex: phase1Weight,
          }}
        >
          <div
            className={`h-full rounded-full bg-gradient-to-r ${accent.bar} transition-all duration-500 ease-out`}
            style={{ width: `${phase1Percent}%` }}
          />
        </div>

        {/* Phase 2 segment */}
        <div
          className="relative rounded-full overflow-hidden transition-all duration-500"
          style={{
            background: isGenerated ? "var(--color-surface-raised)" : "var(--color-surface-inset)",
            flex: 1 - phase1Weight,
            opacity: isGenerated ? 1 : 0.4,
          }}
        >
          {isGenerated ? (
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ease-out"
              style={{ width: `${phase2Percent}%` }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-px w-3"
                style={{ background: "var(--color-text-muted)" }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default PhaseProgressIndicator;
