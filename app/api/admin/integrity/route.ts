import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canRunIntegrityTools } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getLastReport } from "@/lib/integrity/report";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canRunIntegrityTools(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await getLastReport();
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data });
}
