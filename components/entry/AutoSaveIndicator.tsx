"use client";

import { type AutoSaveStatus } from "@/hooks/useAutoSave";

function formatSavedAt(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AutoSaveIndicator({
  status,
}: {
  status: AutoSaveStatus;
}) {
  if (status.phase === "saving") {
    return <p className="text-xs text-muted-foreground">Saving...</p>;
  }

  if (status.phase === "error") {
    return (
      <p className="text-xs text-amber-700">
        Autosave failed{status.errorMessage ? `: ${status.errorMessage}` : ""}
      </p>
    );
  }

  if (status.phase === "saved") {
    const savedAt = formatSavedAt(status.savedAtISO);
    return (
      <p className="text-xs text-muted-foreground">
        Saved{savedAt ? ` at ${savedAt}` : ""}
      </p>
    );
  }

  return <p className="text-xs text-muted-foreground">Autosave enabled</p>;
}
