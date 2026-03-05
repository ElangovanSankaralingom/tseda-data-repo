import { CATEGORY_LIST, isValidCategorySlug } from "@/data/categoryRegistry";
import type { CategoryKey } from "@/lib/entries/types";

export const CATEGORY_KEYS = CATEGORY_LIST as readonly CategoryKey[];

export function isCategoryKey(value: string): value is CategoryKey {
  return isValidCategorySlug(value);
}
