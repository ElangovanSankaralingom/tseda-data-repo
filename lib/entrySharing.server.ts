import "server-only";
import {
  cloneFileMetaArrayToTarget,
  cloneFileMetaToTarget,
} from "@/lib/crosspost.server";
import { isEntryCommitted, type EntryStateLike } from "@/lib/entries/workflow";
import type { FileMeta } from "@/lib/types/entry";

export function shouldShareEntry(entry: EntryStateLike) {
  return isEntryCommitted(entry);
}

export async function cloneOptionalFileToTarget(
  meta: FileMeta | null | undefined,
  targetEmail: string,
  category: string,
  sharedEntryId: string,
  slot: string
) {
  return meta
    ? cloneFileMetaToTarget(meta, targetEmail, category, sharedEntryId, slot)
    : Promise.resolve(null);
}

export async function cloneOptionalFileArrayToTarget(
  metas: FileMeta[] | null | undefined,
  targetEmail: string,
  category: string,
  sharedEntryId: string,
  slot: string
) {
  return metas && metas.length > 0
    ? cloneFileMetaArrayToTarget(metas, targetEmail, category, sharedEntryId, slot)
    : Promise.resolve([]);
}
