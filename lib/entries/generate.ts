import type { CategoryKey } from "./types.ts";

type GeneratePdfResult<TEntry> = {
  entry?: TEntry;
  pdfMeta?: unknown;
  error?: string;
};

export async function generateEntrySnapshot<TEntry extends { id?: string | null }>(
  category: CategoryKey,
  entry: TEntry
) {
  const response = await fetch("/api/me/entry/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      categoryKey: category,
      id: String(entry?.id ?? "").trim(),
      draft: entry,
    }),
  });

  const text = await response.text();
  let payload: GeneratePdfResult<TEntry> | null = null;
  let message = `Generate failed (${response.status})`;

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
