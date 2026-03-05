import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs"];

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

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("@/")) {
    const filePath = resolveAliasToFile(specifier);
    if (filePath) {
      return {
        url: pathToFileURL(filePath).href,
        shortCircuit: true,
      };
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}
