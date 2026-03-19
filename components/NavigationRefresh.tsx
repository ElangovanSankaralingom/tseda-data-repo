"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Forces a server re-render whenever the pathname changes or
 * the tab regains focus. Placed once in the root protected layout
 * to cover ALL pages automatically.
 */
export default function NavigationRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const prevPathname = useRef(pathname);

  // Re-render server components on every client navigation
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      router.refresh();
    }
  }, [pathname, router]);

  // Re-render when tab regains focus (user switches back)
  useEffect(() => {
    function handleFocus() {
      router.refresh();
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router]);

  return null;
}
