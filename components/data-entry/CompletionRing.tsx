"use client";

import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { ListStats } from "./dataEntryTypes";

/*
  ─────────────────────────────────────────────────────────
   RADIAL COMPLETION RING

   An SVG donut chart that shows entry distribution
   at a glance. Each segment is proportional to the
   group count. The total sits fat in the center.

   This is the kind of premium data visualization
   you see in high-end dashboards — NOT in academic tools.

          ╭─ amber (active) ──╮
        ╱                       ╲
      ╱    ┌─────────┐           ╲
     │     │   12    │    ← green (done)
     │     │ entries │           │
      ╲    └─────────┘          ╱
        ╲                     ╱
          ╰── grey (drafts) ╯

   Segments:
   - Drafts → muted white
   - Active (streak + clock + unlocked) → amber
   - Pending → orange
   - Done → green

   Features:
   - Smooth rounded segment caps
   - Gap between segments for clarity
   - Center: total count + "entries" label
   - Accent-colored glow behind the ring
   - Animates in on mount (dashoffset transition)
  ─────────────────────────────────────────────────────────
*/

type Segment = {
  count: number;
  color: string;
  label: string;
};

const RING_SIZE = 140;
const STROKE_WIDTH = 12;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP_DEGREES = 4; // gap between segments in degrees

export default function CompletionRing({
  stats,
  accentHex,
}: {
  stats: ListStats;
  accentHex: string;
}) {
  const { t } = useTranslation();

  const segments = useMemo(() => {
    const result: Segment[] = [];
    if (stats.active > 0) result.push({ count: stats.active, color: "var(--color-palette-amber-fg)", label: t('common.active') });
    if (stats.drafts > 0) result.push({ count: stats.drafts, color: "var(--color-text-tertiary)", label: t('common.drafts') });
    if (stats.pending > 0) result.push({ count: stats.pending, color: "var(--color-palette-orange-fg)", label: t('common.pending') });
    if (stats.finalized > 0) result.push({ count: stats.finalized, color: "var(--color-status-success)", label: t('common.finalized') });
    return result;
  }, [stats, t]);

  const total = stats.total;

  // If no entries, show empty ring
  if (total === 0) {
    return (
      <div className="relative flex items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg width={RING_SIZE} height={RING_SIZE} className="rotate-[-90deg]">
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-border-subtle)"
            strokeWidth={STROKE_WIDTH}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black tabular-nums" style={{ color: "var(--color-text-muted)" }}>0</span>
        </div>
      </div>
    );
  }

  // Calculate segment arcs with gaps
  const totalGapDegrees = segments.length > 1 ? GAP_DEGREES * segments.length : 0;
  const availableDegrees = 360 - totalGapDegrees;
  let currentOffset = 0;

  const arcs = segments.map((seg) => {
    const segmentDegrees = (seg.count / total) * availableDegrees;
    const segmentLength = (segmentDegrees / 360) * CIRCUMFERENCE;
    const gapLength = (GAP_DEGREES / 360) * CIRCUMFERENCE;
    const offset = currentOffset;
    currentOffset += segmentLength + gapLength;

    return {
      ...seg,
      dasharray: `${segmentLength} ${CIRCUMFERENCE - segmentLength}`,
      dashoffset: -offset,
    };
  });

  // Completion percentage for the glow intensity
  const completionPct = total > 0 ? stats.finalized / total : 0;
  const glowOpacity = 0.08 + completionPct * 0.15;

  return (
    <div className="relative flex items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
      {/* Glow behind ring */}
      <div
        className="absolute inset-2 rounded-full"
        style={{
          background: `radial-gradient(circle, ${accentHex}${Math.round(glowOpacity * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
        }}
      />

      {/* Background track */}
      <svg width={RING_SIZE} height={RING_SIZE} className="rotate-[-90deg]" aria-hidden="true">
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-border-subtle)"
          strokeWidth={STROKE_WIDTH}
        />

        {/* Colored segments */}
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={arc.color}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={arc.dasharray}
            strokeDashoffset={arc.dashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
            style={{
              filter: arc.color === "#22c55e" ? "drop-shadow(0 0 4px rgba(34,197,94,0.3))" : undefined,
            }}
          />
        ))}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono text-3xl font-black tracking-tighter leading-none tabular-nums"
          style={{ color: accentHex }}
        >
          {total}
        </span>
        <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
          {total === 1 ? t('dashboard.entry') : t('dashboard.entries')}
        </span>
      </div>
    </div>
  );
}
