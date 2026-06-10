"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Pencil,
  Unlock,
  Zap,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { formatRelativeTime } from "@/lib/i18n/relativeTime";
import {
  getGroupCardClass,
  GROUP_HEX,
  GROUP_LAYOUT,
  NOTCH_CLIP,
} from "@/components/entry/entryCardStyles";
import type { EntryListGroup } from "@/lib/entryCategorization";
import type { EditTimeRemaining } from "@/lib/entries/workflow";

/*
  ─────────────────────────────────────────────────────────
   CARD DESIGN v4 — TWO-ZONE ARCHITECTURE

   Active cards have TWO DISTINCT ZONES:

   ┌──────────────────────────────────────────┐╲
   │▓▓▓▓▓▓▓▓▓ COLORED HEADER BAND ▓▓▓▓▓▓▓▓▓▓│ ╲
   │▓▓  ⚡ Title                    ● 11d  ▓▓│  │
   │▓▓     Subtitle                        ▓▓│  │
   │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  │
   │                                          │  │
   │  [pill] [pill] [pill] [pill] [pill]      │  │
   │  [attachment] [attachment]                │  │
   │  Updated 2h ago              [actions →] │  │
   │ ▓▓▓░░░░ progress                         │  │
   └──────────────────────────────────────────────┘

   The header band has a visible gradient tint.
   The content zone is clean, no background.
   This creates REAL visual hierarchy.

   Locked_in = flat record rows (no card).

  ─────────────────────────────────────────────────────────
*/


/* ── Progress Bar ── */
function EditWindowProgressBar({ group, editTime }: { group: EntryListGroup; editTime?: EditTimeRemaining }) {
  if (!editTime?.hasEditWindow || editTime.expired) return null;
  const layout = GROUP_LAYOUT[group];
  if (layout === "row" || layout === "stamp") return null;

  const hex = GROUP_HEX[group];
  const totalWindowMs = editTime.remainingMs < 3 * 24 * 60 * 60 * 1000
    ? 3 * 24 * 60 * 60 * 1000
    : editTime.remainingMs * 1.5;
  const elapsed = totalWindowMs - editTime.remainingMs;
  const progress = Math.min(100, Math.max(0, (elapsed / totalWindowMs) * 100));
  const isUrgent = progress > 75;
  const isWarning = progress > 50;
  const color = isUrgent ? "var(--color-status-error)" : isWarning ? "var(--color-status-warning)" : hex;
  const height = layout === "hero" ? "h-1.5" : "h-1";

  return (
    <div className={`absolute bottom-0 left-0 right-0 ${height} overflow-hidden`} style={{ background: "var(--color-surface-raised)" }}>
      <div className="h-full transition-all duration-700" style={{ width: `${progress}%`, background: color }} />
    </div>
  );
}


/* ═══════════════════════════════════════════
   HERO CARD — streak_runners

   Clean dark card. The CONTENT brings the color,
   not the background. A thin amber top edge and
   border provide identity. The pills, icon, and
   countdown badge are where the energy lives.

   The card is a stage — not the performance.
   ═══════════════════════════════════════════ */
function HeroCard({
  title, href, editTime, badges, subtitle, metadata, createdAt, updatedAt, actions, children, index,
}: CardInternalProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const staggerClass = index < 8 ? `stagger-${index + 1}` : "";
  const hasContent = !!(children || metadata);
  const time = formatRelativeTime(updatedAt || createdAt, language);

  return (
    <div
      data-entry-card
      tabIndex={0}
      aria-label={`${title} entry`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(href); } }}
      className={`${getGroupCardClass("streak_runners")} group animate-fade-in-up ${staggerClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/30`}
      style={{
        border: "1px solid rgba(251,191,36,0.18)",
        clipPath: NOTCH_CLIP,
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        "--glow-color": "rgba(251,191,36,0.25)",
      } as React.CSSProperties}
    >
      {/* Corner notch — amber accent */}
      <div
        className="absolute top-0 right-0 size-[20px] opacity-70"
        style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)", background: "linear-gradient(135deg, #fbbf24, #f59e0b)" }}
      />

      {/* Top accent edge — thin solid amber line */}
      <div
        className="absolute top-0 left-0 right-[20px] h-[2px]"
        style={{ background: "linear-gradient(90deg, #fbbf24 0%, #f59e0b 50%, transparent 100%)" }}
      />

      {/* ── ZONE 1: Header — subtle warm tint, not brown ── */}
      <div
        className="px-5 pt-4 pb-3.5"
        style={{
          background: "linear-gradient(135deg, rgba(251,191,36,0.08) 0%, transparent 70%)",
          borderBottom: "1px solid rgba(251,191,36,0.10)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: "rgba(251,191,36,0.15)",
              border: "1px solid rgba(251,191,36,0.25)",
            }}
          >
            <Zap className="size-4 text-[var(--color-status-warning)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={href} className="text-lg font-bold text-[var(--color-text-primary)] truncate transition-colors">
                {title}
              </Link>
              {editTime?.hasEditWindow && !editTime.expired && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[var(--color-status-warning)] animate-status-glow"
                  style={{
                    background: "rgba(251,191,36,0.12)",
                    border: "1px solid rgba(251,191,36,0.22)",
                    "--glow-color": "rgba(251,191,36,0.30)",
                  } as React.CSSProperties}
                >
                  <span className="size-1.5 rounded-full bg-[var(--color-status-warning)] animate-subtle-pulse" />
                  {editTime.remainingLabel}
                </span>
              )}
              {badges}
            </div>
            {subtitle ? <div className="mt-1 text-sm text-[var(--color-text-tertiary)]">{subtitle}</div> : null}
          </div>
        </div>
      </div>

      {/* ── ZONE 2: Content — clean dark ── */}
      <div className="px-5 py-3.5">
        {hasContent && (
          <div>
            {children}
            {metadata && !children ? <div className="text-sm text-[var(--color-text-tertiary)]">{metadata}</div> : null}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          {time ? <span className="text-sm text-[var(--color-text-muted)]">{t('entry.timeUpdated')} {time}</span> : <span />}
          {actions ? (
            <div className="flex shrink-0 items-center gap-2 sm:opacity-0 sm:translate-x-2 sm:group-hover:opacity-100 sm:group-hover:translate-x-0 transition-all duration-200">
              {actions}
            </div>
          ) : null}
        </div>
      </div>

      <EditWindowProgressBar group="streak_runners" editTime={editTime} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   TIMER CARD — on_the_clock
   Two-zone: blue header with countdown + body.
   ═══════════════════════════════════════════ */
function TimerCard({
  title, href, editTime, badges, subtitle, metadata, createdAt, updatedAt, actions, children, index,
}: CardInternalProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const hex = GROUP_HEX.on_the_clock;
  const staggerClass = index < 8 ? `stagger-${index + 1}` : "";
  const hasContent = !!(children || metadata);
  const time = formatRelativeTime(updatedAt || createdAt, language);
  const isUrgent = editTime?.hasEditWindow && !editTime.expired && editTime.remainingMs < 24 * 60 * 60 * 1000;

  return (
    <div
      data-entry-card
      tabIndex={0}
      aria-label={`${title} entry`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(href); } }}
      className={`${getGroupCardClass("on_the_clock")} group animate-fade-in-up ${staggerClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/30`}
      style={{
        border: "1px solid rgba(59,130,246,0.18)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        "--glow-color": "rgba(59,130,246,0.25)",
      } as React.CSSProperties}
    >
      {/* Top accent edge — thin solid blue line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, #60a5fa 0%, #3b82f6 60%, transparent 100%)" }}
      />

      {/* ── ZONE 1: Blue header — subtle cool tint ── */}
      <div
        className="px-5 pt-4 pb-3.5"
        style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.08) 0%, transparent 70%)",
          borderBottom: "1px solid rgba(59,130,246,0.10)",
        }}
      >
        <div className="flex items-start gap-3">
          {editTime?.hasEditWindow && !editTime.expired ? (
            <div
              className={`shrink-0 flex flex-col items-center justify-center rounded-xl px-3 py-2 ${isUrgent ? "animate-status-glow" : ""}`}
              style={{
                background: isUrgent ? "rgba(239,68,68,0.10)" : `${hex}10`,
                border: `1px solid ${isUrgent ? "rgba(239,68,68,0.18)" : `${hex}18`}`,
                minWidth: "72px",
                "--glow-color": isUrgent ? "rgba(239,68,68,0.35)" : `${hex}30`,
              } as React.CSSProperties}
            >
              <Clock className={`size-3.5 ${isUrgent ? "text-[var(--color-status-error)] animate-subtle-pulse" : "text-[var(--color-status-info)]"}`} />
              <span className={`mt-0.5 text-xs font-black tabular-nums ${isUrgent ? "text-[var(--color-status-error)]" : "text-[var(--color-status-info)]"}`}>
                {editTime.remainingLabel}
              </span>
            </div>
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl" style={{ background: `${hex}10`, border: `1px solid ${hex}15` }}>
              <Clock className="size-3.5 text-[var(--color-status-info)]" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={href} className="text-base font-bold text-[var(--color-text-primary)] truncate transition-colors">
                {title}
              </Link>
              {badges}
            </div>
            {subtitle ? <div className="mt-0.5 text-sm text-[var(--color-text-tertiary)]">{subtitle}</div> : null}
          </div>
        </div>
      </div>

      {/* ── ZONE 2: Content area ── */}
      <div className="px-5 py-3">
        {hasContent && (
          <div>
            {children}
            {metadata && !children ? <div className="text-sm text-[var(--color-text-tertiary)]">{metadata}</div> : null}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          {time ? (
            <span className={`inline-flex items-center gap-1.5 text-sm ${isUrgent ? "text-[var(--color-status-error)]" : "text-[var(--color-text-muted)]"}`}>
              {isUrgent && <Clock className="size-3 animate-subtle-pulse" />}
              {isUrgent ? t('entry.expiresToday') : `${t('entry.timeUpdated')} ${time}`}
            </span>
          ) : <span />}
          {actions ? (
            <div className="flex shrink-0 items-center gap-2 sm:opacity-0 sm:translate-x-2 sm:group-hover:opacity-100 sm:group-hover:translate-x-0 transition-all duration-200">
              {actions}
            </div>
          ) : null}
        </div>
      </div>

      <EditWindowProgressBar group="on_the_clock" editTime={editTime} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   STANDARD CARD — unlocked
   Two-zone: purple header + clean body.
   ═══════════════════════════════════════════ */
function StandardCard({
  title, href, editTime, badges, subtitle, metadata, createdAt, updatedAt, actions, children, index,
}: CardInternalProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const hex = GROUP_HEX.unlocked;
  const staggerClass = index < 8 ? `stagger-${index + 1}` : "";
  const hasContent = !!(children || metadata);
  const time = formatRelativeTime(updatedAt || createdAt, language);

  return (
    <div
      data-entry-card
      tabIndex={0}
      aria-label={`${title} entry`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(href); } }}
      className={`${getGroupCardClass("unlocked")} group animate-fade-in-up ${staggerClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/30`}
      style={{
        border: "1px solid rgba(168,85,247,0.15)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        "--glow-color": "rgba(168,85,247,0.25)",
      } as React.CSSProperties}
    >
      {/* Top accent edge — thin purple line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, #c084fc 0%, #a855f7 60%, transparent 100%)" }}
      />

      {/* ── ZONE 1: Purple header — subtle tint ── */}
      <div
        className="px-5 pt-4 pb-3.5"
        style={{
          background: "linear-gradient(135deg, rgba(168,85,247,0.07) 0%, transparent 70%)",
          borderBottom: "1px solid rgba(168,85,247,0.08)",
        }}
      >
        <div className="flex items-start gap-2.5">
          <Unlock className="size-4 shrink-0 mt-0.5 text-purple-400" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={href} className="text-base font-bold text-[var(--color-text-primary)] truncate transition-colors">
                {title}
              </Link>
              {editTime?.hasEditWindow && !editTime.expired && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold text-purple-300"
                  style={{ background: `${hex}10`, border: `1px solid ${hex}15` }}
                >
                  <span className="size-1.5 rounded-full bg-purple-400" />
                  {t('entry.unlockedLabel')} · {editTime.remainingLabel}
                </span>
              )}
              {badges}
            </div>
            {subtitle ? <div className="mt-0.5 text-sm text-[var(--color-text-tertiary)]">{subtitle}</div> : null}
          </div>
        </div>
      </div>

      {/* ── ZONE 2: Content area ── */}
      <div className="px-5 py-3">
        {hasContent && (
          <div>
            {children}
            {metadata && !children ? <div className="text-sm text-[var(--color-text-tertiary)]">{metadata}</div> : null}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          {time ? <span className="text-sm text-[var(--color-text-muted)]">{t('entry.timeUpdated')} {time}</span> : <span />}
          {actions ? (
            <div className="flex shrink-0 items-center gap-2 sm:opacity-0 sm:translate-x-2 sm:group-hover:opacity-100 sm:group-hover:translate-x-0 transition-all duration-200">
              {actions}
            </div>
          ) : null}
        </div>
      </div>

      <EditWindowProgressBar group="unlocked" editTime={editTime} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   BLUEPRINT CARD — in_the_works (drafts)
   All-around dashed border = "unfinished."
   Icon in a circle. More visual presence
   than a plain row, but clearly incomplete.

   ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
   │ [✏] Title                   DRAFT  2h ago│
   │      Subtitle                    [→]     │
   └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
   ═══════════════════════════════════════════ */
function DraftRow({
  title, href, subtitle, createdAt, actions, index,
}: CardInternalProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const staggerClass = index < 8 ? `stagger-${index + 1}` : "";
  const time = formatRelativeTime(createdAt, language);

  return (
    <div
      data-entry-card
      tabIndex={0}
      aria-label={`${title} draft entry`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(href); } }}
      className={`${getGroupCardClass("in_the_works")} group rounded-xl animate-fade-in-up ${staggerClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/20`}
      style={{
        border: "2px dashed rgba(148,163,184,0.22)",
        background: "linear-gradient(135deg, rgba(148,163,184,0.04) 0%, rgba(100,116,139,0.02) 100%)",
        "--glow-color": "rgba(148,163,184,0.15)",
      } as React.CSSProperties}
    >
      <div className="px-4 py-3.5 flex items-center gap-3.5">
        {/* Pencil icon — construction feel */}
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: "linear-gradient(135deg, rgba(148,163,184,0.12) 0%, rgba(100,116,139,0.06) 100%)",
            border: "1px dashed rgba(148,163,184,0.15)",
          }}
        >
          <Pencil className="size-3.5 text-[var(--color-icon-default)]" />
        </div>

        {/* Title + subtitle */}
        <div className="min-w-0 flex-1">
          <Link href={href} className="text-sm font-bold text-[var(--color-text-primary)] truncate transition-colors block">
            {title}
          </Link>
          {subtitle ? <div className="mt-0.5 text-xs text-[var(--color-text-tertiary)] truncate">{subtitle}</div> : null}
        </div>

        {/* Right side: DRAFT badge + time + actions */}
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]"
          style={{
            border: "1.5px dashed rgba(148,163,184,0.25)",
            background: "rgba(148,163,184,0.05)",
          }}
        >
          {t('entry.draft')}
        </span>
        {time ? <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{time}</span> : null}
        {actions ? (
          <div className="flex shrink-0 items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   DASHED CARD — under_review
   Two-zone: orange header + content.
   Dashed border IS the identity.
   ═══════════════════════════════════════════ */
function DashedCard({
  title, href, badges, subtitle, metadata, createdAt, updatedAt, actions, children, index,
}: CardInternalProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const hex = GROUP_HEX.under_review;
  const staggerClass = index < 8 ? `stagger-${index + 1}` : "";
  const hasContent = !!(children || metadata);
  const time = formatRelativeTime(updatedAt || createdAt, language);

  return (
    <div
      data-entry-card
      tabIndex={0}
      aria-label={`${title} entry under review`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(href); } }}
      className={`${getGroupCardClass("under_review")} group animate-fade-in-up ${staggerClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/30`}
      style={{
        border: "1.5px dashed rgba(249,115,22,0.20)",
        "--glow-color": "rgba(249,115,22,0.25)",
      } as React.CSSProperties}
    >
      {/* ── ZONE 1: Orange header — subtle warm tint ── */}
      <div
        className="px-5 py-3.5"
        style={{
          background: "linear-gradient(135deg, rgba(249,115,22,0.08) 0%, transparent 70%)",
          borderBottom: "1px solid rgba(249,115,22,0.10)",
        }}
      >
        <div className="flex items-start gap-2.5">
          <div className="relative mt-0.5">
            <Clock className="size-4 text-[var(--color-status-warning)]" />
            <span
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[var(--color-status-warning)] animate-subtle-pulse"
              style={{ boxShadow: `0 0 6px var(--color-status-warning-bg)` }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={href} className="text-base font-bold text-[var(--color-text-primary)] truncate transition-colors">
                {title}
              </Link>
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-status-warning)]"
                style={{ background: `${hex}12`, border: `1px solid ${hex}18` }}
              >
                {t('entry.editRequested')}
              </span>
              {badges}
            </div>
            {subtitle ? <div className="mt-0.5 text-sm text-[var(--color-text-tertiary)]">{subtitle}</div> : null}
          </div>
        </div>
      </div>

      {/* ── ZONE 2: Content ── */}
      <div className="px-5 py-3">
        {hasContent && (
          <div>
            {children}
            {metadata && !children ? <div className="text-sm text-[var(--color-text-tertiary)]">{metadata}</div> : null}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
          {time ? <span className="text-sm text-[var(--color-text-tertiary)]">{t('entry.timeRequested')} {time}</span> : <span />}
          {actions ? (
            <div className="flex shrink-0 items-center gap-2 sm:opacity-0 sm:translate-x-2 sm:group-hover:opacity-100 sm:group-hover:translate-x-0 transition-all duration-200">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   FLAT RECORD ROW — locked_in (finalized)

   These have EARNED their quiet. No card, no
   borders wrapping them, no accent bars.
   Just a flat row with a bottom divider.
   The section container provides the green
   layered identity — the row stays minimal.

   ✓  Title  #01   · metadata · metadata
      FINALIZED · 19d ago         [actions →]
   ──────────────────────────────────────────
   ═══════════════════════════════════════════ */
function StampRow({
  title, href, badges, subtitle, metadata, createdAt, updatedAt, actions, children, index,
}: CardInternalProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const staggerClass = index < 8 ? `stagger-${index + 1}` : "";
  const time = formatRelativeTime(updatedAt || createdAt, language);
  const hasContent = !!(children || metadata);

  return (
    <div
      data-entry-card
      tabIndex={0}
      aria-label={`${title} finalized entry`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(href); } }}
      className={`${getGroupCardClass("locked_in")} group animate-fade-in-up ${staggerClass} py-4 px-4 hover:bg-[var(--color-status-success-bg)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-status-success-border)]`}
      style={{ borderBottom: `1px solid var(--color-status-success-border)` }}
    >
      {/* Title row */}
      <div className="flex items-center gap-2.5">
        <Check className="size-4.5 shrink-0 text-[var(--color-status-success)]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={href} className="text-[15px] font-semibold text-[var(--color-text-primary)] truncate transition-colors">
              {title}
            </Link>
            <span className="font-mono text-[10px] font-bold text-[var(--color-status-success)]/50">
              #{String(index + 1).padStart(2, "0")}
            </span>
            {badges}
          </div>
          {subtitle ? <div className="mt-0.5 text-sm text-[var(--color-text-tertiary)]">{subtitle}</div> : null}
        </div>
      </div>

      {/* Metadata — compact inline */}
      {hasContent && (
        <div className="mt-2.5 ml-[30px]">
          {children}
          {metadata && !children ? <div className="text-sm text-[var(--color-text-muted)]">{metadata}</div> : null}
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 ml-[30px] mt-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-status-success)]/70">
            {t('entry.finalized')}
          </span>
          {time ? (
            <>
              <span className="text-[var(--color-status-success)]/30">·</span>
              <span className="text-xs text-[var(--color-text-muted)]">{time}</span>
            </>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ═══ SHARED PROPS TYPE ═══ */
type CardInternalProps = {
  group: EntryListGroup;
  index: number;
  title: React.ReactNode;
  href: string;
  editTime?: EditTimeRemaining;
  badges?: React.ReactNode;
  subtitle?: React.ReactNode;
  metadata?: React.ReactNode;
  createdAt?: string;
  updatedAt?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

/* ═══ MAIN SHELL — dispatches to the right structure ═══ */
type EntryListCardShellProps = CardInternalProps;

export default function EntryListCardShell(props: EntryListCardShellProps) {
  const layout = GROUP_LAYOUT[props.group];

  switch (layout) {
    case "hero":
      return <HeroCard {...props} />;
    case "timer":
      return <TimerCard {...props} />;
    case "standard":
      return <StandardCard {...props} />;
    case "row":
      return <DraftRow {...props} />;
    case "dashed":
      return <DashedCard {...props} />;
    case "stamp":
      return <StampRow {...props} />;
    default:
      return <StandardCard {...props} />;
  }
}
