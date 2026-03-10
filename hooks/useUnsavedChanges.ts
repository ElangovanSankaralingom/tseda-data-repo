"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Prevents accidental navigation away from pages with unsaved changes.
 *
 * - Intercepts browser back/forward/close with beforeunload
 * - Returns a guard function for programmatic navigation
 */
export function useUnsavedChanges(hasChanges: boolean, message?: string) {
  const msg = message ?? "You have unsaved changes. Discard them?";
  const hasChangesRef = useRef(hasChanges);

  useEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);

  // Browser close/refresh guard
  useEffect(() => {
    if (!hasChanges) return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!hasChangesRef.current) return;
      e.preventDefault();
      // Modern browsers ignore custom messages, but setting returnValue is required
      e.returnValue = msg;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges, msg]);

  /**
   * Call before programmatic navigation.
   * Returns true if navigation should proceed, false if user chose to stay.
   * If no unsaved changes, always returns true.
   */
  const confirmNavigation = useCallback((): boolean => {
    if (!hasChangesRef.current) return true;
    return window.confirm(msg);
  }, [msg]);

  return { confirmNavigation };
}
