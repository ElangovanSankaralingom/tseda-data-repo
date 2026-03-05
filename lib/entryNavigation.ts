import { entryDetail, entryList, entryNew } from "@/lib/navigation";
import type { CategoryKey } from "@/lib/entries/types";

// Compatibility layer; use "@/lib/navigation" in new code.
export function toEntryList(category: CategoryKey) {
  return entryList(category);
}

export function toEntryNew(category: CategoryKey) {
  return entryNew(category);
}

export function toEntryEdit(category: CategoryKey, id: string) {
  return entryDetail(category, id);
}
