import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isMasterAdmin } from "@/lib/admin";
import { normalizeEmail } from "@/lib/facultyDirectory";

const DATA_ROOT = path.join(process.cwd(), ".data");
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const BACKUPS_ROOT = path.join(process.cwd(), ".data_backups");

const CATEGORY_FILES = [
  "fdp-attended.json",
  "fdp-conducted.json",
  "guest-lectures.json",
  "case-studies.json",
  "workshops.json",
];

type ClearResult = { target: string; filesDeleted: number; error?: string };

async function clearDirectory(dirPath: string, target: string): Promise<ClearResult> {
  let count = 0;
  async function deleteRecursive(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await deleteRecursive(fullPath);
        await fs.rmdir(fullPath).catch(() => {});
      } else {
        await fs.unlink(fullPath);
        count++;
      }
    }
  }
  await deleteRecursive(dirPath);
  return { target, filesDeleted: count };
}

async function getUserFolders(): Promise<string[]> {
  const usersDir = path.join(DATA_ROOT, "users");
  return fs.readdir(usersDir).catch(() => []);
}

async function clearTarget(target: string): Promise<ClearResult> {
  try {
    const usersDir = path.join(DATA_ROOT, "users");

    switch (target) {
      case "fdp-attended":
      case "fdp-conducted":
      case "guest-lectures":
      case "case-studies":
      case "workshops": {
        const userFolders = await getUserFolders();
        let count = 0;
        for (const folder of userFolders) {
          const filePath = path.join(usersDir, folder, `${target}.json`);
          try {
            await fs.unlink(filePath);
            count++;
          } catch { /* file doesn't exist */ }
        }
        return { target, filesDeleted: count };
      }

      case "all-entries": {
        const userFolders = await getUserFolders();
        let count = 0;
        for (const folder of userFolders) {
          for (const file of CATEGORY_FILES) {
            const filePath = path.join(usersDir, folder, file);
            try {
              await fs.unlink(filePath);
              count++;
            } catch { /* skip */ }
          }
        }
        return { target, filesDeleted: count };
      }

      case "user-profiles": {
        const userFolders = await getUserFolders();
        let count = 0;
        for (const folder of userFolders) {
          const indexPath = path.join(usersDir, folder, "index.json");
          try {
            await fs.unlink(indexPath);
            count++;
          } catch { /* skip */ }
        }
        return { target, filesDeleted: count };
      }

      case "uploads": {
        return clearDirectory(UPLOADS_ROOT, target);
      }

      case "admin-notifications": {
        const filePath = path.join(DATA_ROOT, "admin", "notifications.json");
        try {
          await fs.unlink(filePath);
          return { target, filesDeleted: 1 };
        } catch {
          return { target, filesDeleted: 0 };
        }
      }

      case "admin-users": {
        const filePath = path.join(DATA_ROOT, "admin", "admin-users.json");
        try {
          await fs.unlink(filePath);
          return { target, filesDeleted: 1 };
        } catch {
          return { target, filesDeleted: 0 };
        }
      }

      case "maintenance": {
        return clearDirectory(path.join(DATA_ROOT, "maintenance"), target);
      }

      case "telemetry": {
        return clearDirectory(path.join(DATA_ROOT, "telemetry"), target);
      }

      case "backups": {
        return clearDirectory(BACKUPS_ROOT, target);
      }

      case "everything": {
        const allTargets = [
          "all-entries", "user-profiles", "uploads",
          "admin-notifications", "admin-users",
          "maintenance", "telemetry", "backups",
        ];
        let totalCount = 0;
        for (const t of allTargets) {
          const result = await clearTarget(t);
          totalCount += result.filesDeleted;
        }
        return { target, filesDeleted: totalCount };
      }

      default:
        return { target, filesDeleted: 0, error: "Unknown target" };
    }
  } catch (error) {
    return { target, filesDeleted: 0, error: String(error) };
  }
}

// Stats endpoint (GET) — returns file counts and sizes per target
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!isMasterAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const usersDir = path.join(DATA_ROOT, "users");
  const userFolders = await fs.readdir(usersDir).catch(() => [] as string[]);

  async function countFiles(paths: string[]): Promise<{ count: number; size: number }> {
    let count = 0;
    let size = 0;
    for (const p of paths) {
      try {
        const stat = await fs.stat(p);
        if (stat.isFile()) {
          count++;
          size += stat.size;
        }
      } catch { /* skip */ }
    }
    return { count, size };
  }

  async function countDir(dirPath: string): Promise<{ count: number; size: number }> {
    let count = 0;
    let size = 0;
    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          try {
            const stat = await fs.stat(fullPath);
            count++;
            size += stat.size;
          } catch { /* skip */ }
        }
      }
    }
    await walk(dirPath);
    return { count, size };
  }

  // Build stats for each category
  const categoryStats: Record<string, { count: number; size: number }> = {};
  for (const cat of ["fdp-attended", "fdp-conducted", "guest-lectures", "case-studies", "workshops"]) {
    const paths = userFolders.map((f) => path.join(usersDir, f, `${cat}.json`));
    categoryStats[cat] = await countFiles(paths);
  }

  // All entries combined
  const allEntryPaths = userFolders.flatMap((f) =>
    CATEGORY_FILES.map((file) => path.join(usersDir, f, file))
  );
  categoryStats["all-entries"] = await countFiles(allEntryPaths);

  // User profiles
  const profilePaths = userFolders.map((f) => path.join(usersDir, f, "index.json"));
  categoryStats["user-profiles"] = await countFiles(profilePaths);

  // Uploads
  categoryStats["uploads"] = await countDir(UPLOADS_ROOT);

  // Admin notifications
  categoryStats["admin-notifications"] = await countFiles([
    path.join(DATA_ROOT, "admin", "notifications.json"),
  ]);

  // Admin users
  categoryStats["admin-users"] = await countFiles([
    path.join(DATA_ROOT, "admin", "admin-users.json"),
  ]);

  // Maintenance
  categoryStats["maintenance"] = await countDir(path.join(DATA_ROOT, "maintenance"));

  // Telemetry
  categoryStats["telemetry"] = await countDir(path.join(DATA_ROOT, "telemetry"));

  // Backups
  categoryStats["backups"] = await countDir(BACKUPS_ROOT);

  return NextResponse.json({ stats: categoryStats, userCount: userFolders.length });
}

// Clear endpoint (POST)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!isMasterAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { targets?: string[]; confirmCode?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.confirmCode !== "CLEAR") {
    return NextResponse.json({ error: "Confirmation code required" }, { status: 400 });
  }

  const targets = body.targets;
  if (!Array.isArray(targets) || targets.length === 0) {
    return NextResponse.json({ error: "No targets specified" }, { status: 400 });
  }

  const validTargets = new Set([
    "all-entries", "fdp-attended", "fdp-conducted", "guest-lectures",
    "case-studies", "workshops", "user-profiles", "uploads",
    "admin-notifications", "admin-users", "maintenance", "telemetry",
    "backups", "everything",
  ]);

  const filtered = targets.filter((t) => validTargets.has(t));
  if (filtered.length === 0) {
    return NextResponse.json({ error: "No valid targets" }, { status: 400 });
  }

  // If "everything" is selected, just run that
  const effectiveTargets = filtered.includes("everything") ? ["everything"] : filtered;

  const results: ClearResult[] = [];
  for (const target of effectiveTargets) {
    results.push(await clearTarget(target));
  }

  const totalDeleted = results.reduce((sum, r) => sum + r.filesDeleted, 0);

  return NextResponse.json({
    ok: true,
    totalDeleted,
    results,
  });
}
