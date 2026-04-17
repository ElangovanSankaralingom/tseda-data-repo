import type { EntryDisplayCategory } from "@/lib/entries/displayLifecycle";
import type { EntryListGroup } from "@/lib/entryCategorization";
import { statusBorderClasses } from "@/components/ui/design-tokens";

export function getEntryListCardClass(category: EntryDisplayCategory, status?: string) {
  const borderLeft = status ? statusBorderClasses(status) : "";

  if (category === "completed") {
    return `rounded-lg border border-[var(--color-glass-border)] border-l-4 ${borderLeft || "border-l-[var(--color-primary)]"} bg-[var(--color-glass-bg)] backdrop-blur-sm p-4 hover:shadow-lg hover:shadow-black/20 transition-all duration-300`;
  }

  if (category === "streak_active") {
    return `rounded-lg border border-[var(--color-glass-border)] border-l-4 ${borderLeft || "border-l-amber-400"} bg-[var(--color-glass-bg)] backdrop-blur-sm p-4 shadow-[0_0_12px_rgba(249,115,22,0.06)] hover:shadow-lg hover:shadow-black/20 transition-all duration-300`;
  }

  return `rounded-lg border border-[var(--color-glass-border)] border-l-4 ${borderLeft || "border-l-[var(--color-text-muted)]"} bg-[var(--color-glass-bg)] backdrop-blur-sm p-4 hover:shadow-lg hover:shadow-black/20 transition-all duration-300`;
}

/*
  ─────────────────────────────────────────────────────────
   CARD DESIGN v3 — NO GLASS, TOP-STRIPE ARCHITECTURE

   THE OLD PROBLEM: every card had rgba(0,0,0,0.40) glass bg
   + left accent bar + inner panel = identical template.

   THE NEW DESIGN:
   - Cards are defined by BORDER, not fill
   - Interior is transparent — page background shows through
   - TOP GRADIENT STRIPE replaces left accent bar
   - Each group has genuinely different SHAPE
   - Locked_in = flat rows, NOT cards

   Active cards:
   ┌─ colored border ──────────────────────────┐╲
   ████ gradient top stripe ████████████████████ ╲
   │                                             │
   │  icon  Title          countdown badge       │
   │        subtitle                             │
   │        [pill] [pill] [pill] [pill]          │
   │        [attachment badges]                  │
   │        time · actions                       │
   │ ▓▓▓▓░░░░ progress bar                      │
   └─────────────────────────────────────────────┘

   Locked_in rows:
   ✓  Title  #01  ·  AY 2025 · EVEN · National
      FINALIZED · 19d ago
   ──────────────────────────────────────────────

  ─────────────────────────────────────────────────────────
*/

/** Hex colors for each group */
export const GROUP_HEX: Record<EntryListGroup, string> = {
  streak_runners: "#fbbf24",
  on_the_clock: "#3b82f6",
  unlocked: "#a855f7",
  in_the_works: "#64748b",
  under_review: "#f97316",
  locked_in: "#22c55e",
};

export type CardLayout =
  | "hero"
  | "timer"
  | "standard"
  | "row"
  | "dashed"
  | "stamp"
  ;

export const GROUP_LAYOUT: Record<EntryListGroup, CardLayout> = {
  streak_runners: "hero",
  on_the_clock: "timer",
  unlocked: "standard",
  in_the_works: "row",
  under_review: "dashed",
  locked_in: "stamp",
};

/** Group container styles (used by GroupedEntrySections) */
export type GroupContainerStyle = {
  background: string;
  border: string;
  padding: string;
  hasContainer: boolean;
};

export const GROUP_CONTAINERS: Record<EntryListGroup, GroupContainerStyle> = {
  streak_runners: {
    background: "rgba(251,191,36,0.03)",
    border: "1px solid rgba(251,191,36,0.08)",
    padding: "p-4",
    hasContainer: true,
  },
  on_the_clock: {
    background: "rgba(59,130,246,0.03)",
    border: "1px solid rgba(59,130,246,0.08)",
    padding: "p-4",
    hasContainer: true,
  },
  unlocked: {
    background: "rgba(168,85,247,0.02)",
    border: "1px solid rgba(168,85,247,0.06)",
    padding: "p-4",
    hasContainer: true,
  },
  in_the_works: { background: "transparent", border: "none", padding: "", hasContainer: false },
  under_review: {
    background: "rgba(249,115,22,0.02)",
    border: "1px dashed rgba(249,115,22,0.12)",
    padding: "p-4",
    hasContainer: true,
  },
  locked_in: {
    background: "rgba(34,197,94,0.03)",
    border: "1px solid rgba(34,197,94,0.08)",
    padding: "p-4 pt-3",
    hasContainer: true,
  },
};

/** Card border + top stripe config per group */
export type GroupCardStyle = {
  cardBorder: string;
  topStripeBg: string;
  topStripeHeight: number;
  hoverShadow: string;
};

export const GROUP_CARDS: Record<EntryListGroup, GroupCardStyle> = {
  streak_runners: {
    cardBorder: "rgba(251,191,36,0.15)",
    topStripeBg: "linear-gradient(90deg, #fbbf24 0%, #f59e0b 60%, transparent 100%)",
    topStripeHeight: 3,
    hoverShadow: "0 4px 20px rgba(251,191,36,0.10)",
  },
  on_the_clock: {
    cardBorder: "rgba(59,130,246,0.15)",
    topStripeBg: "linear-gradient(90deg, #60a5fa 0%, #3b82f6 60%, transparent 100%)",
    topStripeHeight: 3,
    hoverShadow: "0 4px 20px rgba(59,130,246,0.10)",
  },
  unlocked: {
    cardBorder: "rgba(168,85,247,0.12)",
    topStripeBg: "linear-gradient(90deg, #c084fc 0%, #a855f7 60%, transparent 100%)",
    topStripeHeight: 2,
    hoverShadow: "0 4px 20px rgba(168,85,247,0.08)",
  },
  in_the_works: {
    cardBorder: "transparent",
    topStripeBg: "transparent",
    topStripeHeight: 0,
    hoverShadow: "none",
  },
  under_review: {
    cardBorder: "rgba(249,115,22,0.18)",
    topStripeBg: "linear-gradient(90deg, #fb923c 0%, #f97316 40%, transparent 100%)",
    topStripeHeight: 2,
    hoverShadow: "0 4px 16px rgba(249,115,22,0.08)",
  },
  locked_in: {
    cardBorder: "transparent",
    topStripeBg: "transparent",
    topStripeHeight: 0,
    hoverShadow: "none",
  },
};

/** Corner-notch clip path */
export const NOTCH_CLIP = "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)";

export function getGroupCardClass(group: EntryListGroup): string {
  const layout = GROUP_LAYOUT[group];

  // Drafts: blueprint card with dashed border
  if (layout === "row") {
    return "relative transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_2px_12px_rgba(100,116,139,0.06)]";
  }

  // Locked_in: flat record row — no card, no rounding, no elevation
  if (layout === "stamp") {
    return "relative transition-all duration-200 cursor-pointer";
  }

  // Active card types: two-zone architecture with bold presence
  return "relative overflow-hidden rounded-2xl transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-lg";
}
