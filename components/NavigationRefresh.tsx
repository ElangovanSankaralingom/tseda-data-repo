"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { DATA_CHANGED_EVENT } from "@/lib/ui/appRefresh";

/**
 * Forces a server re-render whenever the pathname changes or
 * the tab regains focus. Placed once in the root protected layout
 * to cover ALL pages automatically.
 */
export default function NavigationRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const prevPathname = useRef(pathname);
  const lastRefreshRef = useRef(0);

  // Re-render server components on every client navigation
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      router.refresh();
    }
  }, [pathname, router]);

  // Re-render when tab regains focus (user switches back)
  useEffect(() => {
    function debouncedRefresh() {
      const now = Date.now();
      if (now - lastRefreshRef.current < 500) return;
      lastRefreshRef.current = now;
      router.refresh();
    }

    function handleFocus() {
      debouncedRefresh();
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        debouncedRefresh();
      }
    }
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        debouncedRefresh();
      }
    }
    // Instant-update bus: any successful entry mutation anywhere fires this
    // event (lib/ui/appRefresh.ts) → server components re-render at once.
    function handleDataChanged() {
      debouncedRefresh();
    }
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener(DATA_CHANGED_EVENT, handleDataChanged);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener(DATA_CHANGED_EVENT, handleDataChanged);
    };
  }, [router]);

  return null;
}
