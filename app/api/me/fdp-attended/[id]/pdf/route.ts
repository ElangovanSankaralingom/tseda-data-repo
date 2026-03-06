import { runGeneratePdfRequest } from "@/lib/pdf/pdfService";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return runGeneratePdfRequest(request, {
    category: "fdp-attended",
    entryId: String(id ?? "").trim(),
  });
}
