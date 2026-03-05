import type { EntrySchema } from "@/data/schemas/types";
import { CATEGORY_LIST, getCategorySchema } from "@/data/categoryRegistry";
import type { CategoryKey } from "@/lib/entries/types";

export const ENTRY_SCHEMAS = CATEGORY_LIST.reduce<Record<CategoryKey, EntrySchema>>(
  (next, categoryKey) => {
    next[categoryKey] = getCategorySchema(categoryKey);
    return next;
  },
  {} as Record<CategoryKey, EntrySchema>
);

export type { EntrySchema, SchemaValidationError, SchemaValidationMode } from "@/data/schemas/types";
