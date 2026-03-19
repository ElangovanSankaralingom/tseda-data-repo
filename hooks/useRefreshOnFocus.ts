"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Calls router.refresh() when the tab gains focus or becomes visible,
 * ensuring server components re-render with fresh data.
 *
 * Accepts an optional `minInterval` (ms) to throttle refreshes — defaults to 0
 * (refresh on every focus). Callers that want less aggressive behaviour can
 * pass e.g. `{ minInterval: 60000 }`.
 */
export function useRefreshOnFocus(options?: { minInterval?: number }) {
  const router = useRouter();
  const lastRefreshRef = useRef(0);
  const minInterval = options?.minInterval ?? 0;

  useEffect(() => {
    function maybeRefresh() {
      const now = Date.now();
      if (now - lastRefreshRef.current >= minInterval) {
        router.refresh();
        lastRefreshRef.current = now;
      }
    }

    function handleFocus() {
      maybeRefresh();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        maybeRefresh();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router, minInterval]);
}
