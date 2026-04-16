"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { useTiltEffect } from "@/hooks/useTiltEffect";
import { getCategoryConfig } from "@/data/categoryRegistry";
import { getCategoryIcon } from "@/lib/ui/categoryIcons";
import { type StatusPill } from "./dashboardTypes";

/*
  ───────────────────────────────────────────────────────
   CATEGORY CARD — Holographic tilt card with color identity.

   Each card lives in its own color world:
   - Color bleed: faint accent gradient from left bar into the card
   - Accent-tinted bright panel: the counter surface is tinted
   - Colored counter number: the big number uses the accent color
   - Corner notch + 3D tilt + specular light
   - 3-depth mixed surfaces (dark → accent-tinted bright → dark)
  ───────────────────────────────────────────────────────
*/

/* Corner-notch clip path — cuts the top-right corner */
const NOTCH_CLIP = "polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%)";

/*
  Raw hex values for inline style gradients.
  Tailwind classes can't be used in CSS gradient strings,
  so we map slug → hex for the color bleed effect.
*/
const ACCENT_HEX: Record<string, string> = {
  "fdp-attended": "#3b82f6",
  "fdp-conducted": "#10b981",
  "guest-lectures": "#f59e0b",
  "case-studies": "#a855f7",
  "workshops": "#f43f5e",
};

export type CategoryCardData = {
  slug: string;
  label: string;
  href: string;
  total: number;
  draftCount: number;
  generatedCount: number;
  editRequestedCount: number;
  editGrantedCount: number;
  /** Grid index for stagger entrance delay (0-based) */
  index?: number;
};

/* Stagger class lookup — avoids string interpolation for Tailwind */
const STAGGER: Record<number, string> = {
  0: "stagger-dash-1",
  1: "stagger-dash-2",
  2: "stagger-dash-3",
  3: "stagger-dash-4",
  4: "stagger-dash-5",
  5: "stagger-dash-6",
  6: "stagger-dash-7",
  7: "stagger-dash-8",
};

function CategoryCard({
  slug,
  label,
  href,
  total,
  draftCount,
  editRequestedCount,
  editGrantedCount,
  index = 0,
}: CategoryCardData) {
  const config = getCategoryConfig(slug);
  const color = config.color;
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const Icon = useMemo(() => getCategoryIcon(config.icon), [config.icon]);
  const accent = { bg: color.bg, iconColor: color.text, cta: color.cta };
  const hex = ACCENT_HEX[slug] ?? "#ffffff";
  const displayCount = useCountUp(total);
  const isEmpty = total === 0;
  const { ref, style: tiltStyle, lightStyle, handlers } = useTiltEffect();

  const pills: StatusPill[] = [
    { label: "DRF", count: draftCount, className: "text-[rgba(255,255,255,0.5)] bg-[rgba(0,0,0,0.4)]" },
    { label: "REQ", count: editRequestedCount, className: "text-amber-400 bg-amber-400/10" },
    { label: "EDT", count: editGrantedCount, className: "text-[var(--color-primary)] bg-[var(--color-primary)]/10" },
  ].filter((p) => p.count > 0);

  return (
    <div
      ref={ref}
      style={tiltStyle}
      {...handlers}
      className={cn("animate-card-lift", STAGGER[index] ?? "")}
    >
      <Link
        href={href}
        className={cn(
          "group relative flex overflow-hidden rounded-2xl border cursor-pointer",
          isEmpty
            ? "border-dashed border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.2)]"
            : "border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.3)]"
        )}
        style={{ clipPath: isEmpty ? undefined : NOTCH_CLIP }}
      >
        {/* ── Holographic light reflection overlay ── */}
        <div style={lightStyle} />

        {/* ── Color bleed — faint accent gradient from left into card ── */}
        {!isEmpty && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to right, ${hex}12 0%, ${hex}06 30%, transparent 60%)`,
              borderRadius: "inherit",
            }}
          />
        )}

        {/* ── Corner notch accent triangle — subtle, not loud ── */}
        {!isEmpty && (
          <div
            className="absolute top-0 right-0 size-[24px] opacity-40"
            style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)", backgroundColor: hex }}
          />
        )}

        {/* ── Thick left accent bar ── */}
        <div className={cn("w-1.5 shrink-0", isEmpty ? "bg-[rgba(255,255,255,0.04)]" : color.bg)} />

        <div className="flex-1 p-4 relative">
          {/* ── Header: Icon pill + Label + Arrow ── */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full pl-1 pr-3 py-1 border",
                isEmpty && "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]"
              )}
              style={isEmpty ? undefined : {
                borderColor: `${hex}20`,
                backgroundColor: `${hex}08`,
              }}
            >
              <div className={cn("flex size-7 items-center justify-center rounded-full", accent.bg)}>
                {/* eslint-disable-next-line react-hooks/static-components */}
                <Icon className={cn("size-3.5", accent.iconColor)} />
              </div>
              <span className="text-xs font-bold text-[var(--color-text-primary)] tracking-tight">{label}</span>
            </div>
            <div className="flex-1" />
            {/* ── Keyboard shortcut badge ── */}
            <span className="flex size-5 items-center justify-center rounded font-mono text-[9px] font-bold text-[rgba(255,255,255,0.15)] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] transition-colors duration-200 group-hover:text-[rgba(255,255,255,0.4)] group-hover:border-[rgba(255,255,255,0.1)]">
              {index + 1}
            </span>
          </div>

          {/* ── BRIGHT counter panel — accent-tinted surface ── */}
          <div
            className={cn(
              "mt-3 overflow-hidden rounded-xl border px-4 py-3",
              isEmpty
                ? "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.04)]"
                : "border-[rgba(255,255,255,0.06)]"
            )}
            style={isEmpty ? undefined : {
              backgroundColor: `color-mix(in srgb, ${hex} 6%, rgba(255,255,255,0.04))`,
              borderColor: `${hex}18`,
            }}
          >
            <div className="flex items-end justify-between">
              <div>
                <span
                  className="font-mono text-4xl font-black tracking-tighter leading-none"
                  style={{ color: isEmpty ? "rgba(255,255,255,0.15)" : hex }}
                >
                  {displayCount}
                </span>
                <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.25em] text-[rgba(255,255,255,0.25)]">
                  {isEmpty ? "entries" : total === 1 ? "entry" : "entries"}
                </div>
              </div>

              {/* ── Dark micro-pills stacked (dark inside bright = depth 3) ── */}
              {!isEmpty && pills.length > 0 && (
                <div className="flex flex-col gap-1 items-end">
                  {pills.map((pill) => (
                    <span
                      key={pill.label}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[9px] font-bold border border-[rgba(255,255,255,0.04)]",
                        pill.className
                      )}
                    >
                      {pill.count}
                      <span className="text-[7px] uppercase tracking-wider opacity-60">{pill.label}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Empty state CTA */}
          {isEmpty && (
            <div className={cn("mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors duration-200", accent.cta)}>
              Start entering data
              <ArrowUpRight className="size-3" />
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}

export default React.memo(CategoryCard);
