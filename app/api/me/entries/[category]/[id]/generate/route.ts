import { isValidCategorySlug } from "@/data/categoryRegistry";
import { runGeneratePdfRequest } from "@/lib/pdf/pdfService";
import { NextResponse } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ category: string; id: string }> }) {
  const { category, id } = await context.params;
  const normalizedCategory = String(category ?? "").trim();
  if (!isValidCategorySlug(normalizedCategory)) {
    return NextResponse.json({ error: "Unsupported category" }, { status: 404 });
  }

  return runGeneratePdfRequest(request, {
    category: normalizedCategory,
    entryId: String(id ?? "").trim(),
  });
}
