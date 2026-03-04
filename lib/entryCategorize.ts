export type { CategorizableEntry, EntryCompletionState, EntryDisplayCategory, EntryStreakState } from "./entryCategorization.ts";
export {
  getEntryCompletionState,
  getEntryStreakDisplayState,
  getEntryCategory,
  groupEntries as categorizeEntries,
} from "./entryCategorization.ts";
