"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Refreshes server components when the user returns to the tab after being away.
 * Only triggers if at least `minInterval` ms have passed since the last refresh.
 * Skips refresh if `suppressRef` is true (e.g. when a form has unsaved changes).
 */
export function useRefreshOnFocus(options?: {
  minInterval?: number;
  suppressRef?: React.RefObject<boolean>;
}) {
  const router = useRouter();
  const lastRefresh = useRef(Date.now());
  const minInterval = options?.minInterval ?? 60000;

  useEffect(() => {
    const onFocus = () => {
      if (options?.suppressRef?.current) return;
      const now = Date.now();
      if (now - lastRefresh.current > minInterval) {
        router.refresh();
        lastRefresh.current = now;
      }
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router, minInterval, options?.suppressRef]);
}
