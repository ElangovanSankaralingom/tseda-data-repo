import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "node:fs/promises";
import path from "node:path";
import { authOptions } from "@/lib/auth";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError } from "@/lib/errors";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "file.get",
      options: RATE_LIMIT_PRESETS.fileDownloads,
    });
  } catch (error) {
    const appError = normalizeError(error);
    if (appError.code === "RATE_LIMITED") {
      return NextResponse.json({ error: appError.message, code: appError.code }, { status: 429 });
    }
    throw error;
  }

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