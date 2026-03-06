import type { CategoryKey } from "@/lib/entries/types";
import { runGeneratePdfRequest } from "@/lib/pdf/pdfService";

export async function runGenerateEntryRequest(
  request: Request,
  args: {
    categoryKey: CategoryKey;
    id?: string;
    draft?: unknown;
  }
) {
  return runGeneratePdfRequest(request, {
    category: args.categoryKey,
    entryId: String(args.id ?? "").trim(),
    draft: args.draft,
  });
}
