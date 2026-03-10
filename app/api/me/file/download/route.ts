import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import path from "path";
import fs from "fs/promises";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() || "";

  if (!email.endsWith(ALLOWED_EMAIL_SUFFIX)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const relativePath = String(searchParams.get("path") || "").replace(/\.\./g, "");

  if (!relativePath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const fullPath = path.join(process.cwd(), "storage", safeName(email), relativePath);

  try {
    const data = await fs.readFile(fullPath);

    const ext = path.extname(fullPath).toLowerCase();
    const contentType =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : "application/octet-stream";

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
