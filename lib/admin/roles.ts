import "server-only";

import fs from "node:fs";
import path from "node:path";
import { MASTER_ADMIN_EMAIL } from "@/lib/admin";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getDataRoot } from "@/lib/userStore";

export type AdminRole =
  | "MASTER_ADMIN"
  | "REVIEWER"
  | "EXPORT_ADMIN"
  | "DEPARTMENT_ADMIN";

export type AdminUser = {
  email: string;
  roles: AdminRole[];
  department?: string | null;
};

type AdminUsersConfig = {
  version: number;
  users: AdminUser[];
};

const ADMIN_CONFIG_VERSION = 1 as const;
const VALID_ROLES: readonly AdminRole[] = [
  "MASTER_ADMIN",
  "REVIEWER",
  "EXPORT_ADMIN",
  "DEPARTMENT_ADMIN",
] as const;

function isAdminRole(value: string): value is AdminRole {
  return (VALID_ROLES as readonly string[]).includes(value);
}

function getAdminConfigDir() {
  return path.join(process.cwd(), getDataRoot(), "admin");
}

export function getAdminUsersConfigPath() {
  return path.join(getAdminConfigDir(), "admin-users.json");
}

function buildDefaultConfig(): AdminUsersConfig {
  return {
    version: ADMIN_CONFIG_VERSION,
    users: [
      {
        email: MASTER_ADMIN_EMAIL,
        roles: ["MASTER_ADMIN"],
      },
    ],
  };
}

function normalizeRoles(value: unknown): AdminRole[] {
  if (!Array.isArray(value)) return [];
  const roles = new Set<AdminRole>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim().toUpperCase();
    if (!normalized) continue;
    if (isAdminRole(normalized)) roles.add(normalized);
  }
  return Array.from(roles);
}

function normalizeDepartment(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function normalizeAdminUser(raw: unknown): AdminUser | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const email = normalizeEmail(String(record.email ?? ""));
  if (!email) return null;
  const roles = normalizeRoles(record.roles);
  const department = normalizeDepartment(record.department);
  return {
    email,
    roles,
    ...(department === undefined ? {} : { department }),
  };
}

function sanitizeConfig(raw: unknown): AdminUsersConfig {
  const defaultConfig = buildDefaultConfig();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaultConfig;
  }

  const record = raw as Record<string, unknown>;
  const usersRaw = Array.isArray(record.users) ? record.users : [];
  const byEmail = new Map<string, AdminUser>();

  for (const rawUser of usersRaw) {
    const normalized = normalizeAdminUser(rawUser);
    if (!normalized) continue;
    const existing = byEmail.get(normalized.email);
    if (existing) {
      const mergedRoles = new Set<AdminRole>([...existing.roles, ...normalized.roles]);
      byEmail.set(normalized.email, {
        email: normalized.email,
        roles: Array.from(mergedRoles),
        department:
          normalized.department !== undefined
            ? normalized.department
            : existing.department,
      });
      continue;
    }
    byEmail.set(normalized.email, normalized);
  }

  const masterExisting = byEmail.get(MASTER_ADMIN_EMAIL);
  if (masterExisting) {
    const roles = new Set<AdminRole>(masterExisting.roles);
    roles.add("MASTER_ADMIN");
    byEmail.set(MASTER_ADMIN_EMAIL, {
      ...masterExisting,
      roles: Array.from(roles),
    });
  } else {
    byEmail.set(MASTER_ADMIN_EMAIL, {
      email: MASTER_ADMIN_EMAIL,
      roles: ["MASTER_ADMIN"],
    });
  }

  const users = Array.from(byEmail.values()).sort((left, right) =>
    left.email.localeCompare(right.email)
  );

  return {
    version: ADMIN_CONFIG_VERSION,
    users,
  };
}

function writeConfig(config: AdminUsersConfig) {
  const filePath = getAdminUsersConfigPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function loadConfig(): AdminUsersConfig {
  const filePath = getAdminUsersConfigPath();
  try {
    if (!fs.existsSync(filePath)) {
      const defaultConfig = buildDefaultConfig();
      writeConfig(defaultConfig);
      return defaultConfig;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const parsed: unknown = raw.trim() ? JSON.parse(raw) : null;
    const sanitized = sanitizeConfig(parsed);

    const serializedCurrent = JSON.stringify(parsed);
    const serializedSanitized = JSON.stringify(sanitized);
    if (serializedCurrent !== serializedSanitized) {
      writeConfig(sanitized);
    }

    return sanitized;
  } catch {
    const fallback = buildDefaultConfig();
    try {
      writeConfig(fallback);
    } catch {
      // no-op: preserve master-admin in-memory fallback
    }
    return fallback;
  }
}

export function getAdminUsersConfig(): AdminUsersConfig {
  return loadConfig();
}

export function setAdminUsersConfig(users: AdminUser[]): AdminUsersConfig {
  const sanitized = sanitizeConfig({
    version: ADMIN_CONFIG_VERSION,
    users,
  });
  writeConfig(sanitized);
  return sanitized;
}

export function upsertAdminUser(user: AdminUser): AdminUsersConfig {
  const config = loadConfig();
  const normalized = normalizeAdminUser(user);
  if (!normalized) {
    return config;
  }

  const nextUsers = config.users.filter((entry) => entry.email !== normalized.email);
  nextUsers.push(normalized);
  return setAdminUsersConfig(nextUsers);
}

export function removeAdminUser(email: string): AdminUsersConfig {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || normalizedEmail === MASTER_ADMIN_EMAIL) {
    return loadConfig();
  }

  const config = loadConfig();
  const nextUsers = config.users.filter((entry) => entry.email !== normalizedEmail);
  return setAdminUsersConfig(nextUsers);
}

export function getAdminUser(email: string | null | undefined): AdminUser | null {
  const normalizedEmail = normalizeEmail(email ?? "");
  if (!normalizedEmail) return null;

  const config = loadConfig();
  return config.users.find((user) => user.email === normalizedEmail) ?? null;
}

export function hasAdminRole(email: string | null | undefined, role: AdminRole): boolean {
  const user = getAdminUser(email);
  if (!user) return false;
  return user.roles.includes(role);
}

export function isMasterAdmin(email: string | null | undefined): boolean {
  return hasAdminRole(email, "MASTER_ADMIN");
}

export function canAccessAdminConsole(email: string | null | undefined): boolean {
  const user = getAdminUser(email);
  return !!user && user.roles.length > 0;
}

export function canApproveConfirmations(email: string | null | undefined): boolean {
  return (
    hasAdminRole(email, "MASTER_ADMIN") ||
    hasAdminRole(email, "REVIEWER")
  );
}

export function canExport(email: string | null | undefined): boolean {
  return (
    hasAdminRole(email, "MASTER_ADMIN") ||
    hasAdminRole(email, "EXPORT_ADMIN")
  );
}

export function canRunIntegrityTools(email: string | null | undefined): boolean {
  return hasAdminRole(email, "MASTER_ADMIN");
}

export function canManageBackups(email: string | null | undefined): boolean {
  return hasAdminRole(email, "MASTER_ADMIN");
}

export function canViewAudit(email: string | null | undefined): boolean {
  return (
    hasAdminRole(email, "MASTER_ADMIN") ||
    hasAdminRole(email, "REVIEWER")
  );
}

export function canManageAdminUsers(email: string | null | undefined): boolean {
  return hasAdminRole(email, "MASTER_ADMIN");
}

export function canAccessSettings(email: string | null | undefined): boolean {
  return hasAdminRole(email, "MASTER_ADMIN");
}

export function canRunMaintenance(email: string | null | undefined): boolean {
  return hasAdminRole(email, "MASTER_ADMIN");
}

export function canAccessAdminSearch(email: string | null | undefined): boolean {
  return hasAdminRole(email, "MASTER_ADMIN");
}

export function canViewAnalytics(email: string | null | undefined): boolean {
  return hasAdminRole(email, "MASTER_ADMIN");
}
