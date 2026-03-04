import { generateEntrySnapshot } from "@/lib/entries/generate";
import type { CategoryKey } from "@/lib/entries/types";

type EntryWithId = { id?: string | null };

export async function runGenerateEntryPipeline<TEntry extends EntryWithId>(args: {
  category: CategoryKey;
  email?: string;
  draftEntry: TEntry;
  persistDraft: (entry: TEntry) => Promise<TEntry>;
  hydrateEntry: (entry: TEntry) => TEntry;
}) {
  const persistedDraft = args.hydrateEntry(await args.persistDraft(args.draftEntry));
  const persistedEntryId = String(persistedDraft?.id ?? "").trim();

  if (!persistedEntryId) {
    throw new Error("Could not generate the entry because it was not saved yet.");
  }

  const payload = await generateEntrySnapshot<TEntry>(args.category, persistedDraft);
  const nextEntry =
    payload && typeof payload === "object" && "entry" in payload
      ? args.hydrateEntry((payload as { entry?: TEntry }).entry ?? persistedDraft)
      : persistedDraft;

  return {
    entry: nextEntry,
    payload,
    persistedEntryId,
  };
}
