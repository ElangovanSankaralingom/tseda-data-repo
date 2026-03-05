type EntryLike = {
  id?: unknown;
};

function normalizeId(value: unknown) {
  return String(value ?? "").trim();
}

export function createOptimisticSnapshot<T>(items: T[]): T[] {
  return items.slice();
}

export function optimisticUpsert<T extends EntryLike>(items: T[], entry: T): T[] {
  const nextId = normalizeId(entry.id);
  if (!nextId) return [entry, ...items];

  const index = items.findIndex((item) => normalizeId(item.id) === nextId);
  if (index < 0) {
    return [entry, ...items];
  }

  const next = items.slice();
  next[index] = entry;
  return next;
}

export function optimisticRemove<T extends EntryLike>(items: T[], id: string): T[] {
  const targetId = normalizeId(id);
  if (!targetId) return items.slice();
  return items.filter((item) => normalizeId(item.id) !== targetId);
}

