"use client";

import { useCallback, useEffect, useMemo } from "react";
import { beaconClientTelemetryEvent, trackClientTelemetryEvent } from "@/lib/telemetry/client";

type UseUnsavedChangesGuardOptions = {
  enabled: boolean;
  isDirty: boolean;
  isSaving?: boolean;
  message?: string;
};

type UseUnsavedChangesGuardResult = {
  hasUnsavedChanges: boolean;
  confirmNavigate: (navigate?: (() => void | Promise<void>) | undefined) => Promise<boolean>;
};

const DEFAULT_MESSAGE = "You have unsaved changes. Leave this page?";

function shouldIgnoreAnchor(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href");
  if (!href) return true;
  if (href.startsWith("#")) return true;
  if (href.startsWith("mailto:")) return true;
  if (href.startsWith("tel:")) return true;
  if (anchor.hasAttribute("download")) return true;
  if (anchor.target && anchor.target !== "_self") return true;
  return false;
}

export function useUnsavedChangesGuard({
  enabled,
  isDirty,
  isSaving = false,
  message = DEFAULT_MESSAGE,
}: UseUnsavedChangesGuardOptions): UseUnsavedChangesGuardResult {
  const hasUnsavedChanges = useMemo(
    () => Boolean(enabled && isDirty && !isSaving),
    [enabled, isDirty, isSaving]
  );

  const confirmLeave = useCallback(() => {
    if (!hasUnsavedChanges) return true;
    void trackClientTelemetryEvent({
      event: "unsaved_changes.prompt_shown",
      success: true,
      meta: {
        action: "unsaved_changes.prompt_shown",
        source: "navigation",
      },
    });
    return window.confirm(message);
  }, [hasUnsavedChanges, message]);

  const confirmNavigate = useCallback(
    async (navigate?: (() => void | Promise<void>) | undefined) => {
      if (!confirmLeave()) return false;
      if (navigate) {
        await navigate();
      }
      return true;
    },
    [confirmLeave]
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      beaconClientTelemetryEvent({
        event: "unsaved_changes.prompt_shown",
        success: true,
        meta: {
          action: "unsaved_changes.prompt_shown",
          source: "beforeunload",
        },
      });
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [hasUnsavedChanges, message]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (shouldIgnoreAnchor(anchor)) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      const sameLocation =
        nextUrl.origin === currentUrl.origin &&
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        nextUrl.hash === currentUrl.hash;
      if (sameLocation) return;

      void trackClientTelemetryEvent({
        event: "unsaved_changes.prompt_shown",
        success: true,
        meta: {
          action: "unsaved_changes.prompt_shown",
          source: "anchor_navigation",
        },
      });
      const confirmed = window.confirm(message);
      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", onClickCapture, true);
    return () => {
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [hasUnsavedChanges, message]);

  return {
    hasUnsavedChanges,
    confirmNavigate,
  };
}
