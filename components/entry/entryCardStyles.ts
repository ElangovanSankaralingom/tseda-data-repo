import type { EntryDisplayCategory } from "@/lib/entries/displayLifecycle";
import type { EntryListGroup } from "@/lib/entryCategorization";
import { statusBorderClasses } from "@/components/ui/design-tokens";

export function getEntryListCardClass(category: EntryDisplayCategory, status?: string) {
  const borderLeft = status ? statusBorderClasses(status) : "";

  if (category === "completed") {
    return `rounded-lg border border-slate-200 border-l-4 ${borderLeft || "border-l-emerald-500"} bg-white p-4 hover:shadow-md hover:ring-1 hover:ring-emerald-200 transition-all duration-200`;
  }

  if (category === "streak_active") {
    return `rounded-lg border border-slate-200 border-l-4 ${borderLeft || "border-l-amber-400"} bg-white p-4 shadow-[0_0_12px_rgba(249,115,22,0.06)] hover:shadow-md hover:ring-1 hover:ring-amber-200 transition-all duration-200`;
  }

  return `rounded-lg border border-slate-200 border-l-4 ${borderLeft || "border-l-slate-300"} bg-white p-4 hover:shadow-md hover:ring-1 hover:ring-slate-200 transition-all duration-200`;
}

const GROUP_CARD_STYLES: Record<EntryListGroup, { border: string; bg: string; ring: string; extra?: string }> = {
  streak_runners: {
    border: "border-l-amber-500",
    bg: "bg-gradient-to-r from-amber-50/50 to-white",
    ring: "hover:ring-2 hover:ring-amber-200",
  },
  on_the_clock: {
    border: "border-l-blue-500",
    bg: "bg-white",
    ring: "hover:ring-2 hover:ring-blue-200",
  },
  unlocked: {
    border: "border-l-purple-500",
    bg: "bg-gradient-to-r from-purple-50/50 to-white",
    ring: "hover:ring-2 hover:ring-purple-200",
  },
  in_the_works: {
    border: "border-l-slate-300",
    bg: "bg-white",
    ring: "hover:ring-2 hover:ring-slate-200",
  },
  under_review: {
    border: "border-l-amber-400",
    bg: "bg-white",
    ring: "hover:ring-2 hover:ring-amber-100",
  },
  locked_in: {
    border: "border-l-emerald-500",
    bg: "bg-slate-50/50",
    ring: "hover:ring-2 hover:ring-emerald-200",
    extra: "opacity-90",
  },
};

export function getGroupCardClass(group: EntryListGroup): string {
  const s = GROUP_CARD_STYLES[group];
  return [
    "rounded-xl border border-slate-200 border-l-4 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
    s.border,
    s.bg,
    s.ring,
    s.extra ?? "",
  ].filter(Boolean).join(" ");
}
