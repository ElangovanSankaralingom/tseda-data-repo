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
  GROUP_CARDS,
  GROUP_HEX,
  GROUP_LAYOUT,
  INNER_PANELS,
  NOTCH_CLIP,
} from "@/components/entry/entryCardStyles";
import type { EntryListGroup } from "@/lib/entryCategorization";
import type { EditTimeRemaining } from "@/lib/entries/workflow";

/*
  ─────────────────────────────────────────────────────────
   STRUCTURALLY DIFFERENT CARDS PER GROUP

   Not color swaps. Different SHAPES. Different LAYOUTS.

   HERO (streak_runners):
   ┌═══════════════════════════════════════════════┐╲
   ┃ ▌ ⚡ Title ──────── [3d 12h countdown badge]  │
   ┃ ▌   Subtitle                                  │
   ┃ ▌   ┌─ bright amber panel ──────────────────┐ │
   ┃ ▌   │ metadata · body · [dark pills]        │ │
   ┃ ▌   └──────────────────────────────────────┘ │
   ┃ ▌   time info                    [actions →] │
   ┃ ▌   ▓▓▓▓▓▓░░░░░ progress bar                │
   └══════════════════════════════════════════════━┘

   TIMER (on_the_clock):
   ┌══════════════════════════════════════════════┐
   ┃ ▌ ┌──countdown──┐  Title                     │
   ┃ ▌ │  2d 4h left  │  Subtitle                 │
   ┃ ▌ └─────────────┘  [metadata]                │
   ┃ ▌   time info                    [actions →] │
   ┃ ▌ ▓▓▓▓░░░░░░ progress                        │
   └══════════════════════════════════════════════┘

   ROW (drafts — in_the_works):
   ┊ ✏ Title · "Draft" · Created 2h ago ·····[→]

   DASHED (under_review):
   ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
   │ ┃ 🕐● Title  "Edit Requested"  Sent 1h ago  │
   │ ┃   [metadata in orange panel]               │
   └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘

   STAMP (locked_in — finalized):
   ── ✓ Title · Finalized · 3 days ago ──

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
  const color = isUrgent ? "#f87171" : isWarning ? "#fbbf24" : hex;

  // Hero cards get a fat progress bar, others get slim
  const height = layout === "hero" ? "h-1" : "h-[2px]";

  return (
    <div className={`absolute bottom-0 left-0 right-0 ${height} overflow-hidden`} style={{ background: "rgba(0,0,0,0.3)" }}>
      <div className="h-full transition-all duration-700" style={{ width: `${progress}%`, background: color }} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   HERO CARD — streak_runners
   Full card. Notch clip. Color bleed.
   Bright inner panel. Prominent structure.
   ═══════════════════════════════════════════ */
function HeroCard({
  title, href, editTime, badges, subtitle, metadata, createdAt, updatedAt, actions, children, index,
}: CardInternalProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const hex = GROUP_HEX.streak_runners;
  const cardStyle = GROUP_CARDS.streak_runners;
  const innerPanel = INNER_PANELS.streak_runners;
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
        background: cardStyle.cardBg,
        border: `1px solid ${cardStyle.cardBorder}`,
        clipPath: NOTCH_CLIP,
      }}
    >
      {/* Color bleed gradient — VISIBLE */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to right, ${hex}18 0%, ${hex}08 40%, transparent 70%)`,
          borderRadius: "inherit",
        }}
      />

      {/* Corner notch triangle */}
      <div
        className="absolute top-0 right-0 size-[20px] opacity-40"
        style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)", backgroundColor: hex }}
      />

      {/* Left accent ribbon — THICK gradient */}
      <div
        className="shrink-0 rounded-l-2xl relative"
        style={{ width: cardStyle.accentBarWidth, background: cardStyle.accentBarBg, boxShadow: `2px 0 12px ${hex}15` }}
      />

      <div className="min-w-0 flex-1 py-4 pr-4 pl-3.5 relative">
        {/* Row 1 — Icon in pill + Title + Countdown badge */}
        <div className="flex items-start gap-3">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: `${hex}30`, border: `1px solid ${hex}40` }}
          >
            <Zap className="size-3.5 text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={href} className="text-[15px] font-semibold text-[var(--color-text-primary)] hover:text-white truncate transition-colors">
                {title}
              </Link>
              {editTime?.hasEditWindow && !editTime.expired && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold text-amber-300"
                  style={{ background: `${hex}15`, border: `1px solid ${hex}25` }}
                >
                  <span className="size-1.5 rounded-full bg-amber-400 animate-subtle-pulse" />
                  {editTime.remainingLabel}
                </span>
              )}
              {badges}
            </div>
            {subtitle ? <div className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{subtitle}</div> : null}
          </div>
        </div>

        {/* Row 2 — BRIGHT INNER PANEL (L2 depth) */}
        {hasContent && (
          <div
            className="mt-3 rounded-xl px-3.5 py-3 ml-11"
            style={{ background: innerPanel.background, border: innerPanel.border }}
          >
            {children}
            {metadata && !children ? <div className="text-xs text-[var(--color-text-secondary)]">{metadata}</div> : null}
          </div>
        )}

        {/* Row 3 — Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 ml-11 mt-3">
          {time ? <span className="text-xs text-white/30">{t('entry.timeUpdated')} {time}</span> : <span />}
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
   Timer-forward layout. Countdown is DOMINANT.
   Big timer block on the left side of content.
   ═══════════════════════════════════════════ */
function TimerCard({
  title, href, editTime, badges, subtitle, metadata, createdAt, updatedAt, actions, children, index,
}: CardInternalProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const hex = GROUP_HEX.on_the_clock;
  const cardStyle = GROUP_CARDS.on_the_clock;
  const innerPanel = INNER_PANELS.on_the_clock;
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
      style={{ background: cardStyle.cardBg, border: `1px solid ${cardStyle.cardBorder}` }}
    >
      {/* Left accent bar */}
      <div className="shrink-0 rounded-l-2xl" style={{ width: cardStyle.accentBarWidth, background: cardStyle.accentBarBg }} />

      <div className="min-w-0 flex-1 py-4 pr-4 pl-3.5">
        {/* TIMER-FORWARD layout: countdown block + title side by side */}
        <div className="flex items-start gap-3">
          {/* COUNTDOWN BLOCK — dominant visual */}
          {editTime?.hasEditWindow && !editTime.expired ? (
            <div
              className="shrink-0 flex flex-col items-center justify-center rounded-xl px-3 py-2"
              style={{
                background: isUrgent ? "rgba(239,68,68,0.12)" : `${hex}12`,
                border: `1px solid ${isUrgent ? "rgba(239,68,68,0.20)" : `${hex}20`}`,
                minWidth: "72px",
              }}
            >
              <Clock className={`size-3.5 ${isUrgent ? "text-red-400 animate-subtle-pulse" : "text-blue-400"}`} />
              <span className={`mt-0.5 text-xs font-black tabular-nums ${isUrgent ? "text-red-400" : "text-blue-300"}`}>
                {editTime.remainingLabel}
              </span>
            </div>
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl" style={{ background: `${hex}12` }}>
              <Clock className="size-3.5 text-blue-400" />
            </div>
          )}

          {/* Title + content */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={href} className="text-[15px] font-semibold text-[var(--color-text-primary)] hover:text-white truncate transition-colors">
                {title}
              </Link>
              {badges}
            </div>
            {subtitle ? <div className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{subtitle}</div> : null}

            {/* Content panel */}
            {hasContent && (
              <div
                className="mt-2.5 rounded-xl px-3 py-2.5"
                style={{ background: innerPanel.background, border: innerPanel.border }}
              >
                {children}
                {metadata && !children ? <div className="text-xs text-[var(--color-text-secondary)]">{metadata}</div> : null}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          {time ? (
            <span className={`inline-flex items-center gap-1.5 text-xs ${
              isUrgent ? "text-red-400" : "text-white/30"
            }`}>
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
   Clean medium card. No notch, no clip.
   ═══════════════════════════════════════════ */
function StandardCard({
  title, href, editTime, badges, subtitle, metadata, createdAt, updatedAt, actions, children, index,
}: CardInternalProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const hex = GROUP_HEX.unlocked;
  const cardStyle = GROUP_CARDS.unlocked;
  const innerPanel = INNER_PANELS.unlocked;
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
      style={{ background: cardStyle.cardBg, border: `1px solid ${cardStyle.cardBorder}` }}
    >
      <div className="shrink-0 rounded-l-2xl" style={{ width: cardStyle.accentBarWidth, background: cardStyle.accentBarBg }} />

      <div className="min-w-0 flex-1 py-4 pr-4 pl-3.5">
        <div className="flex items-start gap-2.5">
          <Unlock className={`size-3.5 shrink-0 mt-0.5 text-purple-400`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={href} className="text-[15px] font-semibold text-[var(--color-text-primary)] hover:text-white truncate transition-colors">
                {title}
              </Link>
              {editTime?.hasEditWindow && !editTime.expired && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold text-purple-300"
                  style={{ background: `${hex}12`, border: `1px solid ${hex}18` }}
                >
                  <span className="size-1.5 rounded-full bg-purple-400" />
                  {t('entry.unlockedLabel')} · {editTime.remainingLabel}
                </span>
              )}
              {badges}
            </div>
            {subtitle ? <div className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{subtitle}</div> : null}
          </div>
        </div>

        {hasContent && (
          <div
            className="mt-3 rounded-xl px-3 py-2.5 ml-6"
            style={{ background: innerPanel.background, border: innerPanel.border }}
          >
            {children}
            {metadata && !children ? <div className="text-xs text-[var(--color-text-secondary)]">{metadata}</div> : null}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 ml-6 mt-3">
          {time ? <span className="text-xs text-white/30">{t('entry.timeUpdated')} {time}</span> : <span />}
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
   ROW — in_the_works (drafts)
   NOT A CARD. A compact single-line row.
   Dotted left edge. Minimal. Like a to-do item.
   ═══════════════════════════════════════════ */
function DraftRow({
  title, href, createdAt, actions, index,
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
      className={`group flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-white/[0.03] cursor-pointer animate-fade-in-up ${staggerClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30`}
      style={{ borderLeft: "2px dotted rgba(100,116,139,0.25)" }}
    >
      <Pencil className="size-3 shrink-0 text-[var(--color-text-muted)]" />
      <Link href={href} className="text-sm font-semibold text-[var(--color-text-primary)] hover:text-white truncate transition-colors flex-1 min-w-0">
        {title}
      </Link>
      <span className="shrink-0 rounded-md bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
        {t('entry.draft')}
      </span>
      {time ? <span className="shrink-0 text-[11px] text-white/30">{time}</span> : null}
      {actions ? (
        <div className="flex shrink-0 items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════
   DASHED CARD — under_review
   Dashed border. Pulsing orange dot.
   ═══════════════════════════════════════════ */
function DashedCard({
  title, href, badges, subtitle, metadata, createdAt, updatedAt, actions, children, index,
}: CardInternalProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const hex = GROUP_HEX.under_review;
  const cardStyle = GROUP_CARDS.under_review;
  const innerPanel = INNER_PANELS.under_review;
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
        background: cardStyle.cardBg,
        border: `1px dashed rgba(249,115,22,0.18)`,
      }}
    >
      {/* Striped accent bar — dashes pattern */}
      <div className="shrink-0 rounded-l-2xl" style={{ width: cardStyle.accentBarWidth, background: cardStyle.accentBarBg }} />

      <div className="min-w-0 flex-1 py-3.5 pr-4 pl-3.5">
        <div className="flex items-start gap-2.5">
          <div className="relative mt-0.5">
            <Clock className="size-3.5 text-orange-400" />
            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-orange-400 animate-subtle-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={href} className="text-sm font-semibold text-[var(--color-text-primary)] hover:text-white truncate transition-colors">
                {title}
              </Link>
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-400"
                style={{ background: `${hex}12` }}
              >
                {t('entry.editRequested')}
              </span>
              {badges}
            </div>
            {subtitle ? <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{subtitle}</div> : null}
          </div>
        </div>

        {hasContent && (
          <div
            className="mt-2.5 rounded-lg px-3 py-2 ml-6"
            style={{ background: innerPanel.background, border: innerPanel.border }}
          >
            {children}
            {metadata && !children ? <div className="text-xs text-[var(--color-text-secondary)]">{metadata}</div> : null}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 ml-6 mt-2.5">
          {time ? <span className="text-xs text-orange-400/50">{t('entry.timeRequested')} {time}</span> : <span />}
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
   SEALED CARD — locked_in (finalized)
   Full card with NOTCH CLIP, left green bar,
   inner detail panel, and corner seal badge.
   Feels DIFFERENT from other cards — muted but rich.

   ┌═══════════════════════════════════════╲
   ┃ ▌ ✓  Title                    #01    ╲
   ┃ ▌    Subtitle                         │
   ┃ ▌    ┌─ detail panel ──────────────┐  │
   ┃ ▌    │ metadata / body content     │  │
   ┃ ▌    └─────────────────────────────┘  │
   ┃ ▌    Finalized · 19d ago   [actions]  │
   ┗═══════════════════════════════════════━┘
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
      className={`group relative overflow-hidden flex rounded-2xl transition-all duration-300 hover:-translate-y-0.5 cursor-pointer animate-fade-in-up ${staggerClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/20`}
      style={{
        background: "rgba(0,0,0,0.25)",
        border: "1px solid rgba(34,197,94,0.08)",
        clipPath: NOTCH_CLIP,
      }}
    >
      {/* Corner notch triangle — green */}
      <div
        className="absolute top-0 right-0 size-[16px] opacity-25"
        style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)", backgroundColor: "#22c55e" }}
      />

      {/* Left accent bar — thin green gradient */}
      <div
        className="shrink-0 rounded-l-2xl"
        style={{
          width: 3,
          background: "linear-gradient(180deg, #22c55e 0%, rgba(34,197,94,0.30) 100%)",
        }}
      />

      <div className="min-w-0 flex-1 py-3.5 pr-4 pl-3.5">
        {/* Row 1 — checkmark + title + index badge */}
        <div className="flex items-start gap-2.5">
          <div
            className="flex size-6 shrink-0 items-center justify-center rounded-full mt-0.5"
            style={{
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.20)",
            }}
          >
            <Check className="size-3 text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={href} className="text-sm font-semibold text-[var(--color-text-primary)] hover:text-white truncate transition-colors">
                {title}
              </Link>
              {/* Index badge */}
              <span
                className="font-mono text-[9px] font-bold text-emerald-400/40"
              >
                #{String(index + 1).padStart(2, "0")}
              </span>
              {badges}
            </div>
            {subtitle ? <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{subtitle}</div> : null}
          </div>
        </div>

        {/* Row 2 — detail panel (if available) */}
        {hasContent && (
          <div
            className="mt-2.5 rounded-lg px-3 py-2 ml-[34px]"
            style={{
              background: "rgba(34,197,94,0.04)",
              border: "1px solid rgba(34,197,94,0.08)",
            }}
          >
            {children}
            {metadata && !children ? <div className="text-xs text-[var(--color-text-secondary)]">{metadata}</div> : null}
          </div>
        )}

        {/* Row 3 — footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 ml-[34px] mt-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-400/50">
              {t('entry.finalized')}
            </span>
            {time ? (
              <>
                <span className="text-white/10">·</span>
                <span className="text-[11px] text-white/25">{time}</span>
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
