import type { CategoryKey } from "@/lib/entries/types";

export function toEntryList(category: CategoryKey) {
  return `/data-entry/${category}`;
}

export function toEntryNew(category: CategoryKey) {
  return `${toEntryList(category)}/new`;
}

export function toEntryEdit(category: CategoryKey, id: string) {
  return `${toEntryList(category)}/${encodeURIComponent(id)}`;
}
