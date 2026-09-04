import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC_PREFIX = "@/";
const STUB_URL = pathToFileURL(path.join(process.cwd(), "scripts", "server-only-stub.mjs")).href;

function tryFile(candidate) {
  try {
    if (existsSync(candidate) && statSync(candidate).isFile()) return pathToFileURL(candidate).href;
  } catch { /* fall through */ }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: STUB_URL, shortCircuit: true };

  // `@/...` is project-rooted (tsconfig paths), never parent-relative.
  if (specifier.startsWith(SRC_PREFIX)) {
    const base = path.join(process.cwd(), "src", specifier.slice(SRC_PREFIX.length));
    const hit =
      tryFile(base) ??
      tryFile(base + ".ts") ??
      tryFile(base + ".tsx") ??
      tryFile(base + ".mjs") ??
      tryFile(path.join(base, "index.ts"));
    if (hit) return { url: hit, shortCircuit: true };
    return nextResolve(specifier, context);
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parentPath = fileURLToPath(context.parentURL);
    const base = path.resolve(path.dirname(parentPath), specifier);
    const hit =
      tryFile(base) ??
      tryFile(base + ".ts") ??
      tryFile(base + ".tsx") ??
      tryFile(base + ".mjs") ??
      tryFile(path.join(base, "index.ts"));
    if (hit) return { url: hit, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
