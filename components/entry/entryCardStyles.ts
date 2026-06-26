import type { EntryListGroup } from "@/lib/entryCategorization";

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

/** Group identity colors — CSS variables, mode-aware.
    Values are var() strings; for alpha tints use
    `color-mix(in srgb, ${GROUP_HEX[g]} N%, transparent)` — never \`${hex}NN\` suffixes. */
export const GROUP_HEX: Record<EntryListGroup, string> = {
  streak_runners: "var(--color-palette-amber-fg)",
  on_the_clock: "var(--color-palette-blue-fg)",
  unlocked: "var(--color-palette-blue-fg)",
  in_the_works: "var(--color-text-muted)",
  under_review: "var(--color-palette-orange-fg)",
  locked_in: "var(--color-status-success)",
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
    background: `var(--color-card-bg)`,
    border: `1px solid color-mix(in srgb, ${GROUP_HEX.streak_runners} 16%, transparent)`,
    padding: "p-4",
    hasContainer: true,
  },
  on_the_clock: {
    background: `var(--color-card-bg)`,
    border: `1px solid color-mix(in srgb, ${GROUP_HEX.on_the_clock} 12%, transparent)`,
    padding: "p-4",
    hasContainer: true,
  },
  unlocked: {
    background: `var(--color-card-bg)`,
    border: `1px solid color-mix(in srgb, ${GROUP_HEX.unlocked} 10%, transparent)`,
    padding: "p-4",
    hasContainer: true,
  },
  in_the_works: { background: "transparent", border: "none", padding: "", hasContainer: false },
  under_review: {
    background: `var(--color-card-bg)`,
    border: `1px solid color-mix(in srgb, ${GROUP_HEX.under_review} 16%, transparent)`,
    padding: "p-4",
    hasContainer: true,
  },
  locked_in: {
    background: `color-mix(in srgb, ${GROUP_HEX.locked_in} 6%, var(--color-card-bg))`,
    border: `1px solid color-mix(in srgb, ${GROUP_HEX.locked_in} 13%, transparent)`,
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
  return "relative overflow-hidden rounded-2xl transition-all duration-300 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg";
}
