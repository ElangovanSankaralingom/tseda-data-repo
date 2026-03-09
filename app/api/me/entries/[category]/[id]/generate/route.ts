import { getServerSession } from "next-auth";
import { isValidCategorySlug } from "@/data/categoryRegistry";
import { authOptions } from "@/lib/auth";
import { runGeneratePdfRequest } from "@/lib/pdf/pdfService";
import { NextResponse } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ category: string; id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
