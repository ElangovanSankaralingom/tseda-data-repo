import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs"];
const SERVER_ONLY_STUB = path.join(process.cwd(), "tests", "helpers", "serverOnlyStub.mjs");

function resolveAliasToFile(specifier) {
  const withoutPrefix = specifier.slice(2);
  const basePath = path.join(process.cwd(), withoutPrefix);

  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return basePath;
  }

  for (const extension of EXTENSIONS) {
    const withExtension = `${basePath}${extension}`;
    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  for (const extension of EXTENSIONS) {
    const asIndex = path.join(basePath, `index${extension}`);
    if (fs.existsSync(asIndex)) {
      return asIndex;
    }
  }

  return null;
}

function resolveRelativeToFile(specifier, parentURL) {
  if (!parentURL) return null;
  const parentPath = new URL(parentURL).pathname;
  const parentDir = path.dirname(parentPath);
  const basePath = path.resolve(parentDir, specifier);

  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return basePath;
  }

  for (const extension of EXTENSIONS) {
    const withExtension = `${basePath}${extension}`;
    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  for (const extension of EXTENSIONS) {
    const asIndex = path.join(basePath, `index${extension}`);
    if (fs.existsSync(asIndex)) {
      return asIndex;
    }
  }

  return null;
}

export async function resolve(specifier, context, defaultResolve) {
  if (specifier === "server-only") {
    return {
      url: pathToFileURL(SERVER_ONLY_STUB).href,
      shortCircuit: true,
    };
  }

  if (specifier.startsWith("@/")) {
    const filePath = resolveAliasToFile(specifier);
    if (filePath) {
      return {
        url: pathToFileURL(filePath).href,
        shortCircuit: true,
      };
    }
  }

  // Handle relative imports without extensions (e.g. "./indexStoreInternal")
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const hasExtension = EXTENSIONS.some((ext) => specifier.endsWith(ext));
    if (!hasExtension) {
      const filePath = resolveRelativeToFile(specifier, context.parentURL);
      if (filePath) {
        return {
          url: pathToFileURL(filePath).href,
          shortCircuit: true,
        };
      }
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}
