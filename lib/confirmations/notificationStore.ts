// ---------------------------------------------------------------------------
// Persistent Notification Store — file-based per-user storage
// ---------------------------------------------------------------------------

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { PersistentNotification, PersistentNotificationType, NotificationStore } from "./types";

const DATA_ROOT = path.join(process.cwd(), ".data", "users");
const MAX_NOTIFICATIONS = 50;

function notificationPath(email: string): string {
  return path.join(DATA_ROOT, email, "notifications.json");
}

async function readStore(email: string): Promise<NotificationStore> {
  try {
    const raw = await readFile(notificationPath(email), "utf-8");
    const parsed = JSON.parse(raw) as NotificationStore;
    return { notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [] };
  } catch {
    return { notifications: [] };
  }
}

async function writeStore(email: string, store: NotificationStore): Promise<void> {
  const filePath = notificationPath(email);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getNotifications(email: string): Promise<PersistentNotification[]> {
  const store = await readStore(email);
  return store.notifications;
}

export async function getUnreadCount(email: string): Promise<number> {
  const store = await readStore(email);
  return store.notifications.filter((n) => !n.read).length;
}

export async function addNotification(
  email: string,
  notification: Omit<PersistentNotification, "id" | "createdAt" | "read">,
): Promise<PersistentNotification> {
  const store = await readStore(email);
  const entry: PersistentNotification = {
    ...notification,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    read: false,
  };
  store.notifications.unshift(entry);
  if (store.notifications.length > MAX_NOTIFICATIONS) {
    store.notifications = store.notifications.slice(0, MAX_NOTIFICATIONS);
  }
  await writeStore(email, store);
  return entry;
}

export async function markAsRead(email: string, notificationId: string): Promise<boolean> {
  const store = await readStore(email);
  const notification = store.notifications.find((n) => n.id === notificationId);
  if (!notification) return false;
  notification.read = true;
  await writeStore(email, store);
  return true;
}

export async function markAllAsRead(email: string): Promise<number> {
  const store = await readStore(email);
  let count = 0;
  for (const n of store.notifications) {
    if (!n.read) {
      n.read = true;
      count++;
    }
  }
  if (count > 0) await writeStore(email, store);
  return count;
}

export async function dismissNotification(email: string, notificationId: string): Promise<boolean> {
  const store = await readStore(email);
  const idx = store.notifications.findIndex((n) => n.id === notificationId);
  if (idx === -1) return false;
  store.notifications.splice(idx, 1);
  await writeStore(email, store);
  return true;
}

export async function addNotificationForAllUsers(
  notification: Omit<PersistentNotification, "id" | "createdAt" | "read">,
  userEmails: string[],
): Promise<number> {
  let count = 0;
  for (const email of userEmails) {
    try {
      await addNotification(email, notification);
      count++;
    } catch {
      // Skip users whose directories don't exist
    }
  }
  return count;
}

export type { PersistentNotification, PersistentNotificationType };
