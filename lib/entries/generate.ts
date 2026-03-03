import type { CategoryKey } from "./types.ts";

type GeneratePdfResult<TEntry> = {
  entry?: TEntry;
  pdfMeta?: unknown;
  error?: string;
};

export async function generateEntrySnapshot<TEntry>(category: CategoryKey, entryId: string) {
  const response = await fetch(`/api/me/${encodeURIComponent(category)}/${encodeURIComponent(entryId)}/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const text = await response.text();
  let payload: GeneratePdfResult<TEntry> | null = null;
  let message = `Save failed (${response.status})`;

  try {
    payload = text ? (JSON.parse(text) as GeneratePdfResult<TEntry>) : null;
    if (payload?.error) {
      message = payload.error;
    }
  } catch {
    // Keep fallback message when the response is not JSON.
  }

  if (!response.ok) {
    throw new Error(message);
  }

  return payload;
}
