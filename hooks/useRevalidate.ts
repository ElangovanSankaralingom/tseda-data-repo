"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Provides revalidation helpers that refresh server components on the current page.
 * Call `revalidate()` after any mutation to ensure the page shows fresh data.
 */
export function useRevalidate() {
  const router = useRouter();

  const revalidate = useCallback(() => {
    router.refresh();
  }, [router]);

  return { revalidate };
}
