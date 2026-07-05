"use client";

import { mutate } from "swr";

/**
 * INSTANT-UPDATE BUS (Elan, 2026-07): after ANY successful entry mutation,
 * every surface must reflect it — hero rings, analytics cards, bento grid,
 * award panel, Department Pulse, notifications.
 *
 * One call does two things:
 *  1. Revalidates EVERY cached SWR GET (feed, awards, feedback, counts) via
 *     the global filter mutate.
 *  2. Fires `tseda:data-changed`, which NavigationRefresh picks up to
 *     `router.refresh()` the server-rendered parts (dashboard summary).
 */
export const DATA_CHANGED_EVENT = "tseda:data-changed";

export function notifyDataChanged(): void {
  if (typeof window === "undefined") return;
  // Revalidate every /api/* SWR cache entry currently mounted.
  void mutate(
    (key) => typeof key === "string" && key.startsWith("/api/"),
    undefined,
    { revalidate: true },
  );
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}
