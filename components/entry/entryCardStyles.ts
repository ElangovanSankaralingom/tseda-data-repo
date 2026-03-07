import type { EntryDisplayCategory } from "@/lib/entries/displayLifecycle";
import { statusBorderClasses } from "@/components/ui/design-tokens";

export function getEntryListCardClass(category: EntryDisplayCategory, status?: string) {
  const borderLeft = status ? statusBorderClasses(status) : "";

  if (category === "completed") {
    return `rounded-lg border border-slate-200 border-l-4 ${borderLeft || "border-l-emerald-500"} bg-white p-4 hover:shadow-sm transition-all duration-200`;
  }

  if (category === "streak_active") {
    return `rounded-lg border border-slate-200 border-l-4 ${borderLeft || "border-l-amber-400"} bg-white p-4 shadow-[0_0_12px_rgba(249,115,22,0.06)] hover:shadow-sm transition-all duration-200`;
  }

  return `rounded-lg border border-slate-200 border-l-4 ${borderLeft || "border-l-slate-300"} bg-white p-4 hover:shadow-sm transition-all duration-200`;
}
