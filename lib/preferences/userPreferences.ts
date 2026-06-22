import "server-only";

import fs from "node:fs";
import path from "node:path";
import { getDataRoot, safeEmailDir } from "@/lib/userStore";

export interface UserPreferences {
  themeMode: "light" | "dark" | "color";
  /** Legacy preset name — retained for migration to accentHex. */
  colorPalette: string;
  /** Custom accent as a clamped hex (e.g. "#2A48CE"). */
  accentHex: string;
  language: "en" | "ta";
}

const DEFAULTS: UserPreferences = {
  themeMode: "dark",
  colorPalette: "midnight-lime",
  accentHex: "#2A48CE",
  language: "en",
};

function getPrefsPath(email: string): string {
  return path.join(
    process.cwd(),
    getDataRoot(),
    "users",
    safeEmailDir(email),
    "preferences.json",
  );
}

export function getUserPreferences(email: string): UserPreferences {
  const filePath = getPrefsPath(email);
  try {
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Partial<UserPreferences>;
      return { ...DEFAULTS, ...raw };
    }
  } catch {
    // Ignore parse errors — return defaults
  }
  return { ...DEFAULTS };
}

export function setUserPreferences(
  email: string,
  prefs: Partial<UserPreferences>,
): UserPreferences {
  const filePath = getPrefsPath(email);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const current = getUserPreferences(email);
  const updated = { ...current, ...prefs };
  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
  return updated;
}
