import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getDataRoot } from "@/lib/userStore";

export async function GET() {
  try {
    const usersDir = path.join(process.cwd(), getDataRoot(), "users");
    await fs.access(usersDir);
    const userDirs = await fs.readdir(usersDir);

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      storage: "accessible",
      users: userDirs.length,
      version: process.env.npm_package_version || "unknown",
      node: process.version,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
