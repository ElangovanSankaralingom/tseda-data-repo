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
   VISIBLE LAYERED SURFACE SYSTEM

   THE RULE: If you can't SEE the difference between two
   depth levels, they're not different levels. Every layer
   must be VISIBLY distinct from its parent.

   L0: Page body — darkest (#0a0c14 range)
   L1: Section containers — VISIBLY tinted with group color
       (8-15% opacity, not 3%)
   L2: Cards inside containers — darker than container
       (creates the "inset" effect)
   L3: Bright inner panels inside cards — ACTUALLY BRIGHT
       (white/0.10+, not 0.04)
   L4: Dark micro-elements inside bright panels
       (creating the nesting rhythm)

   The contrast between each level should be OBVIOUS,
   not something you need to squint to see.
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

/** Group container — VISIBLE tinted wrappers */
export type GroupContainerStyle = {
  background: string;
  border: string;
  padding: string;
  hasContainer: boolean;
};

export const GROUP_CONTAINERS: Record<EntryListGroup, GroupContainerStyle> = {
  /* Warm amber — softer tint */
  streak_runners: {
    background: `linear-gradient(135deg, rgba(251,191,36,0.06) 0%, rgba(251,191,36,0.02) 100%)`,
    border: "1px solid rgba(251,191,36,0.10)",
    padding: "p-5",
    hasContainer: true,
  },
  /* Blue — gentle */
  on_the_clock: {
    background: `linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(59,130,246,0.02) 100%)`,
    border: "1px solid rgba(59,130,246,0.08)",
    padding: "p-5",
    hasContainer: true,
  },
  /* Purple — gentle */
  unlocked: {
    background: `linear-gradient(135deg, rgba(168,85,247,0.05) 0%, rgba(168,85,247,0.02) 100%)`,
    border: "1px solid rgba(168,85,247,0.08)",
    padding: "p-5",
    hasContainer: true,
  },
  /* Drafts: no container */
  in_the_works: {
    background: "transparent",
    border: "none",
    padding: "",
    hasContainer: false,
  },
  /* Dashed orange — softer */
  under_review: {
    background: "rgba(249,115,22,0.03)",
    border: "1px dashed rgba(249,115,22,0.12)",
    padding: "p-5",
    hasContainer: true,
  },
  /* Green recessed — much softer */
  locked_in: {
    background: "rgba(34,197,94,0.025)",
    border: "1px solid rgba(34,197,94,0.06)",
    padding: "p-4",
    hasContainer: true,
  },
};

/** Bright inner panels — ACTUALLY BRIGHT, visibly lighter than card */
export type InnerPanelStyle = {
  background: string;
  border: string;
  hasPanel: boolean;
};

export const INNER_PANELS: Record<EntryListGroup, InnerPanelStyle> = {
  streak_runners: {
    background: `rgba(255,255,255,0.08)`,
    border: "1px solid rgba(251,191,36,0.18)",
    hasPanel: true,
  },
  on_the_clock: {
    background: `rgba(255,255,255,0.07)`,
    border: "1px solid rgba(59,130,246,0.18)",
    hasPanel: true,
  },
  unlocked: {
    background: `rgba(255,255,255,0.06)`,
    border: "1px solid rgba(168,85,247,0.15)",
    hasPanel: true,
  },
  in_the_works: {
    background: "transparent",
    border: "none",
    hasPanel: false,
  },
  under_review: {
    background: "rgba(249,115,22,0.06)",
    border: "1px solid rgba(249,115,22,0.15)",
    hasPanel: true,
  },
  locked_in: {
    background: "transparent",
    border: "none",
    hasPanel: false,
  },
};

/** Card styles per group */
export type GroupCardStyle = {
  cardBg: string;
  cardBorder: string;
  accentBarBg: string;
  accentBarWidth: number;
  hoverClass: string;
  extraClass: string;
};

export const GROUP_CARDS: Record<EntryListGroup, GroupCardStyle> = {
  streak_runners: {
    cardBg: "rgba(0,0,0,0.40)",
    cardBorder: "rgba(251,191,36,0.15)",
    accentBarBg: "linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)",
    accentBarWidth: 5,
    hoverClass: "hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(251,191,36,0.12)]",
    extraClass: "",
  },
  on_the_clock: {
    cardBg: "rgba(0,0,0,0.40)",
    cardBorder: "rgba(59,130,246,0.12)",
    accentBarBg: "linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%)",
    accentBarWidth: 4,
    hoverClass: "hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(59,130,246,0.12)]",
    extraClass: "",
  },
  unlocked: {
    cardBg: "rgba(0,0,0,0.35)",
    cardBorder: "rgba(168,85,247,0.12)",
    accentBarBg: "linear-gradient(180deg, #c084fc 0%, #a855f7 100%)",
    accentBarWidth: 4,
    hoverClass: "hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(168,85,247,0.08)]",
    extraClass: "",
  },
  in_the_works: {
    cardBg: "transparent",
    cardBorder: "transparent",
    accentBarBg: "transparent",
    accentBarWidth: 0,
    hoverClass: "hover:bg-white/[0.03]",
    extraClass: "",
  },
  under_review: {
    cardBg: "rgba(0,0,0,0.25)",
    cardBorder: "rgba(249,115,22,0.12)",
    accentBarBg: "repeating-linear-gradient(180deg, #fb923c 0px, #fb923c 4px, transparent 4px, transparent 8px)",
    accentBarWidth: 3,
    hoverClass: "hover:-translate-y-0.5",
    extraClass: "",
  },
  locked_in: {
    cardBg: "transparent",
    cardBorder: "transparent",
    accentBarBg: "transparent",
    accentBarWidth: 0,
    hoverClass: "",
    extraClass: "",
  },
};

/** Corner-notch clip path */
export const NOTCH_CLIP = "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)";

export function getGroupCardClass(group: EntryListGroup): string {
  const layout = GROUP_LAYOUT[group];
  const s = GROUP_CARDS[group];

  if (layout === "row") {
    return [
      "relative flex items-center rounded-lg transition-all duration-200 cursor-pointer",
      s.hoverClass,
      s.extraClass,
    ].filter(Boolean).join(" ");
  }

  if (layout === "stamp") {
    return [s.hoverClass, s.extraClass].filter(Boolean).join(" ");
  }

  if (layout === "hero") {
    return [
      "relative overflow-hidden flex rounded-2xl transition-all duration-300",
      s.hoverClass,
      s.extraClass,
    ].filter(Boolean).join(" ");
  }

  return [
    "relative overflow-hidden flex rounded-2xl transition-all duration-300",
    s.hoverClass,
    s.extraClass,
  ].filter(Boolean).join(" ");
}
