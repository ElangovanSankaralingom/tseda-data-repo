import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "node:fs/promises";
import path from "node:path";
import { authOptions } from "@/lib/auth";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { isMasterAdmin } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  ownerOfStoredPath,
  resolveEntryUploadPath,
} from "@/lib/config/storagePaths";

/**
 * Authenticated serving route for entry attachments and generated PDFs.
 * Replaces the former static `public/uploads/` exposure (S0 audit fix):
 * files are only readable by their owner (or the master admin), never by URL
 * possession alone.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "entryFile.get",
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
  const storedPath = url.searchParams.get("path") ?? "";
  const owner = ownerOfStoredPath(storedPath);
  if (!owner) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  if (owner !== email && !isMasterAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let resolved: string;
  try {
    resolved = resolveEntryUploadPath(storedPath);
  } catch {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
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
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const nodeErr = error as NodeJS.ErrnoException;
    if (nodeErr.code === "ENOENT") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }
}
