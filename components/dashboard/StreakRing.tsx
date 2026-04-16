"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

/*
  ───────────────────────────────────────────────────────
   STREAK RING — Animated SVG arc gauge.

   A thin circular arc wraps the icon, filling based on
   a 0-1 progress value. Animates from 0 on mount.

   Tier system changes ring color + adds a tier label:
     0-2 wins  → (no tier)
     3-5 wins  → BRONZE
     6-10 wins → SILVER
     11+ wins  → GOLD

   The ring is the visual "reward" — it physically fills
   up as you complete streaks, giving a game-like feel
   that's unusual for a data collection app.
  ───────────────────────────────────────────────────────
*/

const RING_SIZE = 44; // SVG viewBox size
const STROKE_WIDTH = 2.5;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type StreakTier = { label: string; trackColor: string; fillColor: string };

function getTier(wins: number): StreakTier | null {
  if (wins >= 11) return { label: "GLD", trackColor: "rgba(251,191,36,0.15)", fillColor: "#fbbf24" };
  if (wins >= 6) return { label: "SLV", trackColor: "rgba(148,163,184,0.15)", fillColor: "#94a3b8" };
  if (wins >= 3) return { label: "BRZ", trackColor: "rgba(217,119,6,0.15)", fillColor: "#d97706" };
  return null;
}

export default function StreakRing({
  icon: Icon,
  value,
  maxValue,
  label,
  wins,
  ringColor,
  valueColor,
}: {
  icon: LucideIcon;
  value: number;
  maxValue: number;
  label: string;
  wins: number;
  ringColor: string;
  valueColor: string;
}) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const progress = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;

  useEffect(() => {
    // Animate the ring fill on mount
    const timer = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 150);
    return () => clearTimeout(timer);
  }, [progress]);

  const dashOffset = CIRCUMFERENCE * (1 - animatedProgress);
  const tier = getTier(wins);
  const effectiveRingColor = tier?.fillColor ?? ringColor;
  const effectiveTrackColor = tier?.trackColor ?? "rgba(255,255,255,0.06)";

  return (
    <div className="flex items-center gap-3">
      {/* ── Ring gauge with icon center ── */}
      <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="block -rotate-90"
        >
          {/* Track (background ring) */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={effectiveTrackColor}
            strokeWidth={STROKE_WIDTH}
          />
          {/* Fill arc */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={effectiveRingColor}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)" }}
          />
        </svg>
        {/* Icon in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="size-4" style={{ color: effectiveRingColor }} />
        </div>
      </div>

      {/* ── Value + label + tier badge ── */}
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-xl font-black tracking-tight" style={{ color: valueColor }}>
            {value}
          </span>
          {tier && (
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[7px] font-black uppercase tracking-wider"
              style={{
                color: tier.fillColor,
                backgroundColor: tier.trackColor,
              }}
            >
              {tier.label}
            </span>
          )}
        </div>
        <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-[rgba(255,255,255,0.25)]">
          {label}
        </div>
      </div>
    </div>
  );
}
