/**
 * Custom ESM loader for Node's built-in test runner.
 * Resolves `@/` path alias to the project root, adds `.ts` extensions,
 * and stubs `server-only`.
 */
import { resolve as pathResolve } from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";

const PROJECT_ROOT = pathResolve(import.meta.dirname, "..", "..");

function tryResolveTs(absPath) {
  // If it already has an extension, use as-is
  if (/\.\w+$/.test(absPath)) return absPath;
  // Try .ts, then .tsx, then /index.ts
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = absPath + ext;
    if (existsSync(candidate)) return candidate;
  }
  return absPath;
}

export async function resolve(specifier, context, nextResolve) {
  // Stub out `server-only` — it throws at import time outside Next.js
  if (specifier === "server-only") {
    return {
      shortCircuit: true,
      url: "data:text/javascript,export default {};",
    };
  }

  // Resolve @/ alias
  if (specifier.startsWith("@/")) {
    const bare = pathResolve(PROJECT_ROOT, specifier.slice(2));
    const resolved = tryResolveTs(bare);
    return nextResolve(pathToFileURL(resolved).href, context);
  }

  // Resolve relative .ts imports (handles internal cross-module imports)
  if (specifier.startsWith(".") && context.parentURL) {
    const parentPath = new URL(context.parentURL).pathname;
    const parentDir = parentPath.substring(0, parentPath.lastIndexOf("/"));
    const bare = pathResolve(parentDir, specifier);
    const resolved = tryResolveTs(bare);
    if (resolved !== bare) {
      return nextResolve(pathToFileURL(resolved).href, context);
    }
  }

  return nextResolve(specifier, context);
}
