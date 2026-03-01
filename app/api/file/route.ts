import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "node:fs/promises";
import path from "node:path";

export async function GET(req: Request) {
  const session = await getServerSession();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const filePath = url.searchParams.get("path");
  if (!filePath) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  // Allow only within this user's upload dir
  const base = path.join(process.cwd(), "data", "uploads", email.toLowerCase());
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(base))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const buf = await fs.readFile(resolved);
  const ext = path.extname(resolved).toLowerCase();

  const contentType =
    ext === ".pdf" ? "application/pdf" :
    ext === ".png" ? "image/png" :
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
    "application/octet-stream";

  return new NextResponse(buf, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${path.basename(resolved)}"`,
    },
  });
}