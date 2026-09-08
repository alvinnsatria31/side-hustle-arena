import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC_PREFIX = "@/";
const STUB_URL = pathToFileURL(path.join(process.cwd(), "scripts", "server-only-stub.mjs")).href;
// `next/headers` exists only inside the Next request runtime, so a route
// handler cannot even be imported under `node --test` without this. The stub
// presents an empty cookie store — the unauthenticated case a route must
// already handle — and refuses to fabricate a session.
const NEXT_HEADERS_STUB = pathToFileURL(path.join(process.cwd(), "scripts", "next-headers-stub.mjs")).href;
const NEXT_NAVIGATION_STUB = pathToFileURL(path.join(process.cwd(), "scripts", "next-navigation-stub.mjs")).href;

function tryFile(candidate) {
  try {
    if (existsSync(candidate) && statSync(candidate).isFile()) return pathToFileURL(candidate).href;
  } catch { /* fall through */ }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: STUB_URL, shortCircuit: true };
  if (specifier === "next/headers") return { url: NEXT_HEADERS_STUB, shortCircuit: true };
  if (specifier === "next/navigation") return { url: NEXT_NAVIGATION_STUB, shortCircuit: true };

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
