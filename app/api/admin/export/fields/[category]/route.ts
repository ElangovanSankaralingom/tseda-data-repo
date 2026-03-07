import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canExport } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getExportableFields, parseExportCategory } from "@/lib/export/exportService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ category: string }> }
) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canExport(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { category } = await params;
  const parsed = parseExportCategory(category);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  return NextResponse.json({ data: getExportableFields(parsed) });
}
