import { demoAware } from "@/lib/demo/demoAware";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "node:fs/promises";
import path from "node:path";
import { authOptions } from "@/lib/auth";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { logger } from "@/lib/logger";

async function GETHandler(req: Request) {
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
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  const url = new URL(req.url);
  const filePath = url.searchParams.get("path");
  if (!filePath) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  // Allow only within this user's upload dir (S0: private .data root)
  const base = path.join(process.cwd(), ".data", "uploads", email.toLowerCase());
  const resolved = path.resolve(filePath);
  // path.sep boundary (2026-07): startsWith(base) alone lets a sibling dir
  // whose name has `base` as a prefix escape (…/alice vs …/alice2).
  const resolvedBase = path.resolve(base);
  if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
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
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const nodeErr = error as NodeJS.ErrnoException;
    if (nodeErr.code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    logger.error({ event: "file.read.error", path: resolved, error: nodeErr.message });
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const GET = demoAware(GETHandler);
