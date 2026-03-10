import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getDataRoot } from "@/lib/userStore";

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

export async function GET() {
  const dataRoot = path.join(process.cwd(), getDataRoot());
  const usersDir = path.join(dataRoot, "users");
  const uploadsDir = path.join(process.cwd(), "public", "uploads");

  try {
    // Check directories
    const [dataDirStatus, uploadsDirStatus] = await Promise.all([
      checkDirectory(usersDir),
      checkDirectory(uploadsDir),
    ]);

    // Count users
    let userCount = 0;
    if (dataDirStatus === "ok") {
      const userDirs = await fs.readdir(usersDir);
      userCount = userDirs.length;
    }

    // Check env vars
    const missingEnv = REQUIRED_ENV_VARS.filter(
      (key) => !process.env[key]?.trim(),
    );
    const envStatus =
      missingEnv.length === 0
        ? "ok"
        : `missing: ${missingEnv.join(", ")}`;

    // Memory usage
    const memoryUsage = process.memoryUsage();

    const isHealthy =
      dataDirStatus === "ok" && uploadsDirStatus === "ok" && missingEnv.length === 0;

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
        version: process.env.npm_package_version || "unknown",
        node: process.version,
        environment: process.env.NODE_ENV || "development",
        checks: {
          dataDir: dataDirStatus,
          uploadsDir: uploadsDirStatus,
          envVars: envStatus,
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
