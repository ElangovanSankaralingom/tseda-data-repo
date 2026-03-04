import type { CategoryKey } from "@/lib/entries/types";

export const CATEGORY_KEYS = [
  "fdp-attended",
  "fdp-conducted",
  "case-studies",
  "guest-lectures",
  "workshops",
] as const satisfies readonly CategoryKey[];

export function isCategoryKey(value: string): value is CategoryKey {
  return CATEGORY_KEYS.includes(value as CategoryKey);
}
