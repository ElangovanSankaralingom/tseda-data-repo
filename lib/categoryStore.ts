import { CATEGORY_LIST } from "@/data/categoryRegistry";
import type { CategoryKey } from "@/lib/entries/types";

export const CATEGORY_STORE_FILES = CATEGORY_LIST.reduce<Record<CategoryKey, string>>(
  (next, categoryKey) => {
    next[categoryKey] = `${categoryKey}.json`;
    return next;
  },
  {} as Record<CategoryKey, string>
);
