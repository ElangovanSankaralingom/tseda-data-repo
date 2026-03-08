// ---------------------------------------------------------------------------
// Admin Notification Store — shared file-based storage for all admins
// ---------------------------------------------------------------------------

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { AdminNotification, AdminNotificationStore } from "./types";

const STORE_PATH = path.join(process.cwd(), ".data", "admin", "notifications.json");
const MAX_NOTIFICATIONS = 100;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function readStore(): Promise<AdminNotificationStore> {
  try {
    const raw = await readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as AdminNotificationStore;
    return { notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [] };
  } catch {
    return { notifications: [] };
  }
}

async function writeStore(store: AdminNotificationStore): Promise<void> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

/** Prune old and excess notifications lazily. */
function prune(notifications: AdminNotification[]): AdminNotification[] {
  const cutoff = Date.now() - MAX_AGE_MS;
  const fresh = notifications.filter((n) => Date.parse(n.createdAt) > cutoff);
  return fresh.slice(0, MAX_NOTIFICATIONS);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getAdminNotifications(): Promise<AdminNotification[]> {
  const store = await readStore();
  return store.notifications;
}

export async function getAdminUnreadCount(adminEmail: string): Promise<number> {
  const store = await readStore();
  return store.notifications.filter((n) => !n.readBy.includes(adminEmail)).length;
}

export async function addAdminNotification(
  notification: Omit<AdminNotification, "id" | "createdAt" | "readBy">,
): Promise<AdminNotification> {
  const store = await readStore();
  const entry: AdminNotification = {
    ...notification,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    readBy: [],
  };
  store.notifications.unshift(entry);
  store.notifications = prune(store.notifications);
  await writeStore(store);
  return entry;
}

export async function markAdminAsRead(adminEmail: string, notificationId: string): Promise<boolean> {
  const store = await readStore();
  const notification = store.notifications.find((n) => n.id === notificationId);
  if (!notification) return false;
  if (!notification.readBy.includes(adminEmail)) {
    notification.readBy.push(adminEmail);
    await writeStore(store);
  }
  return true;
}

export async function markAllAdminAsRead(adminEmail: string): Promise<number> {
  const store = await readStore();
  let count = 0;
  for (const n of store.notifications) {
    if (!n.readBy.includes(adminEmail)) {
      n.readBy.push(adminEmail);
      count++;
    }
  }
  if (count > 0) await writeStore(store);
  return count;
}

export async function dismissAdminNotification(notificationId: string): Promise<boolean> {
  const store = await readStore();
  const idx = store.notifications.findIndex((n) => n.id === notificationId);
  if (idx === -1) return false;
  store.notifications.splice(idx, 1);
  await writeStore(store);
  return true;
}
