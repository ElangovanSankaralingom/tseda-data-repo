import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canExport } from "@/lib/admin/roles";

export async function GET() {
  const session = await getServerSession(authOptions);
  const actorEmail = session?.user?.email?.toLowerCase();
  if (!canExport(actorEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(
    {
      error: "Deprecated endpoint. Use /api/admin/export/entries with explicit filters.",
    },
    { status: 410 }
  );
}
