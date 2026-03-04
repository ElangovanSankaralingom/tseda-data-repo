import type { EntryDisplayCategory } from "@/lib/entries/lifecycle";

export function getEntryListCardClass(category: EntryDisplayCategory) {
  if (category === "completed") {
    return "rounded-2xl border border-orange-200 bg-white/70 bg-gradient-to-br from-orange-50/80 to-transparent p-6";
  }

  if (category === "streak_active") {
    return "rounded-2xl border border-orange-300/80 bg-white/70 p-6 shadow-[0_0_18px_rgba(249,115,22,0.08)] transition-all duration-200 hover:scale-[1.01]";
  }

  return "rounded-xl border border-border p-4";
}
