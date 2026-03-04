import { NextResponse } from "next/server";
import { isCategoryKey } from "@/lib/categories";
import { runGenerateEntryRequest } from "@/lib/server/generateEntry";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      categoryKey?: string;
      id?: string;
      draft?: unknown;
    };

    const categoryKey = String(body?.categoryKey ?? "").trim();
    const id = String(body?.id ?? "").trim();

    if (!isCategoryKey(categoryKey)) {
      return NextResponse.json({ error: "Unsupported category" }, { status: 404 });
    }

    return runGenerateEntryRequest(request, {
      categoryKey,
      id,
      draft: body?.draft,
    });
  } catch {
    return NextResponse.json({ error: "Invalid generate request." }, { status: 400 });
  }
}
