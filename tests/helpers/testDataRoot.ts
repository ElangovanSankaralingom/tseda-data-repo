import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type TestDataRootContext = {
  root: string;
  restore: () => void;
  cleanup: () => Promise<void>;
};

export async function createTestDataRoot(label: string): Promise<TestDataRootContext> {
  const previousDataRoot = process.env.DATA_ROOT;
  const root = path.join(
    process.cwd(),
    "tmp",
    `test-data-${label}-${Date.now()}-${randomUUID()}`
  );

  await fs.mkdir(root, { recursive: true });
  process.env.DATA_ROOT = root;

  return {
    root,
    restore() {
      if (previousDataRoot === undefined) {
        delete process.env.DATA_ROOT;
      } else {
        process.env.DATA_ROOT = previousDataRoot;
      }
    },
    async cleanup() {
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}
