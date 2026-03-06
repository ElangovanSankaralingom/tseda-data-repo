"use client";

import { useEffect } from "react";
import { trackClientTelemetryEvent } from "@/lib/telemetry/client";
import type { CategoryKey } from "@/lib/entries/types";

type UseEntryPageModeTelemetryOptions = {
  category: CategoryKey;
  pagePath: string;
  editEntryId?: string;
  startInNewMode?: boolean;
};

export function useEntryPageModeTelemetry({
  category,
  pagePath,
  editEntryId,
  startInNewMode = false,
}: UseEntryPageModeTelemetryOptions) {
  useEffect(() => {
    const routeEntryId = editEntryId?.trim() || "";
    const mode = routeEntryId ? "edit" : startInNewMode ? "new" : "list";

    void trackClientTelemetryEvent({
      event: routeEntryId || startInNewMode ? "page.entry_detail_view" : "page.entry_list_view",
      category,
      entryId: routeEntryId || null,
      success: true,
      meta: {
        page: pagePath,
        mode,
      },
    });

    if (routeEntryId) {
      void trackClientTelemetryEvent({
        event: "entry.view",
        category,
        entryId: routeEntryId,
        success: true,
        meta: {
          mode: "edit",
          source: "detail_route",
        },
      });
    }
  }, [category, editEntryId, pagePath, startInNewMode]);
}

