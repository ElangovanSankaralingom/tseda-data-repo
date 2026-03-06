"use client";

import { type AutoSaveStatus } from "@/hooks/useAutoSave";

function getSavedLabel(value: string | null) {
  if (!value) return "Autosave enabled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Autosave enabled";

  const elapsedMs = Date.now() - date.getTime();
  if (elapsedMs < 30 * 1000) return "Saved just now";

  const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
  if (elapsedMinutes <= 0) return "Saved just now";
  if (elapsedMinutes < 60) return `Saved ${elapsedMinutes} min ago`;

  const savedAt = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Saved at ${savedAt}`;
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
    return (
      <p className="text-xs text-muted-foreground">
        {getSavedLabel(status.savedAtISO)}
      </p>
    );
  }

  return <p className="text-xs text-muted-foreground">Autosave enabled</p>;
}
