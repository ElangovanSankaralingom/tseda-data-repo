import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { runGeneratePdfRequest } from "@/lib/pdf/pdfService";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  return runGeneratePdfRequest(request, {
    category: "fdp-attended",
    entryId: String(id ?? "").trim(),
  });
}
