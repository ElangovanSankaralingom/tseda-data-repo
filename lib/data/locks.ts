import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { AppError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";

type LockRelease = () => void;

const lockTails = new Map<string, Promise<void>>();
const heldLocksStorage = new AsyncLocalStorage<Set<string>>();

function normalizeLockKey(key: string) {
  return key.trim().toLowerCase();
}

async function acquireLock(key: string): Promise<LockRelease> {
  const previousTail = lockTails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const nextTail = previousTail.then(
    () => gate,
    () => gate
  );
  lockTails.set(key, nextTail);

  await previousTail.catch(() => undefined);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    release();
    if (lockTails.get(key) === nextTail) {
      lockTails.delete(key);
    }
  };
}

function withHeldLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const current = heldLocksStorage.getStore();
  const next = new Set(current ?? []);
  next.add(key);
  return heldLocksStorage.run(next, fn);
}

export async function withLock<T>(
  key: string,
  fn: () => Promise<T> | T
): Promise<T> {
  const normalizedKey = normalizeLockKey(key);
  if (!normalizedKey) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Lock key is required.",
    });
  }

  const held = heldLocksStorage.getStore();
  if (held?.has(normalizedKey)) {
    return Promise.resolve().then(fn);
  }

  const release = await acquireLock(normalizedKey);
  try {
    return await withHeldLock(normalizedKey, async () => Promise.resolve(fn()));
  } finally {
    release();
  }
}

export function getUserDataLockKey(userEmail: string) {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid email for lock key.",
    });
  }
  return `user:${normalizedEmail}`;
}

export async function withUserDataLock<T>(
  userEmail: string,
  fn: () => Promise<T> | T
): Promise<T> {
  return withLock(getUserDataLockKey(userEmail), fn);
}
