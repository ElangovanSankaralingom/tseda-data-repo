export function mergeWithNulls<T extends object, K extends keyof T>(
  base: T,
  incoming: Partial<T>,
  keys: readonly K[]
) {
  const next = { ...base };

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(incoming, key)) {
      next[key] = incoming[key] as T[K];
    }
  }

  return next;
}
