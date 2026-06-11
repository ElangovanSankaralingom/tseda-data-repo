import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getDataRoot } from "@/lib/userStore";
import { ENTRY_UPLOADS_ROOT } from "@/lib/config/storagePaths";
import { getRequestIp, enforceRateLimitOrThrow, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";

const REQUIRED_ENV_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
] as const;

async function checkDirectory(dirPath: string): Promise<"ok" | string> {
  try {
    await fs.access(dirPath);
    return "ok";
  } catch {
    return "error";
  }
}

export async function GET(request: Request) {
  try {
    const ip = getRequestIp(request) ?? "unknown";
    enforceRateLimitOrThrow(`ip:${ip}:action:health.get`, RATE_LIMIT_PRESETS.health);
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  const dataRoot = path.join(process.cwd(), getDataRoot());
  const usersDir = path.join(dataRoot, "users");
  const uploadsDir = ENTRY_UPLOADS_ROOT;

  try {
    // Check directories
    const [dataDirStatus, uploadsDirStatus] = await Promise.all([
      checkDirectory(usersDir),
      checkDirectory(uploadsDir),
    ]);

    // Count users and verify datastore is readable
    let userCount = 0;
    let datastoreStatus: "ok" | string = "ok";
    if (dataDirStatus === "ok") {
      try {
        const userDirs = await fs.readdir(usersDir);
        userCount = userDirs.length;
      } catch {
        datastoreStatus = "read_error";
      }
    } else {
      datastoreStatus = "inaccessible";
    }

    // Check env vars
    const missingEnv = REQUIRED_ENV_VARS.filter(
      (key) => !process.env[key]?.trim(),
    );
    const envStatus =
      missingEnv.length === 0
        ? "ok"
        : `missing: ${missingEnv.join(", ")}`;

    // Version from package.json
    let version = "unknown";
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(process.cwd(), "package.json"), "utf-8"));
      version = pkg.version ?? "unknown";
    } catch {
      // Fallback
    }

    // Last nightly maintenance run
    let lastNightlyRun = null;
    try {
      const lastRunData = await fs.readFile(path.join(dataRoot, "maintenance", "lastRun.json"), "utf-8");
      const parsed = JSON.parse(lastRunData);
      lastNightlyRun = {
        startedAt: parsed.startedAt ?? null,
        finishedAt: parsed.finishedAt ?? null,
        overallSuccess: parsed.overallSuccess ?? null,
      };
    } catch {
      // No last run data
    }

    // Memory usage
    const memoryUsage = process.memoryUsage();

    const isHealthy =
      dataDirStatus === "ok" && uploadsDirStatus === "ok" && missingEnv.length === 0 && datastoreStatus === "ok";

    return NextResponse.json(
      {
        status: isHealthy ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
        },
        storage: {
          accessible: dataDirStatus === "ok",
          userCount,
        },
        version,
        lastNightlyRun,
        node: process.version,
        environment: process.env.NODE_ENV || "development",
        checks: {
          dataDir: dataDirStatus,
          uploadsDir: uploadsDirStatus,
          envVars: envStatus,
          datastore: datastoreStatus,
        },
      },
      { status: isHealthy ? 200 : 503 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        error: error instanceof Error ? error.message : "Unknown error",
        checks: {
          dataDir: "error",
          uploadsDir: "error",
          envVars: "unknown",
        },
      },
      { status: 503 },
    );
  }
}
