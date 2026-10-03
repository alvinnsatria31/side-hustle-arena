/**
 * Live contract check for the unified admin → Arena integration.
 *
 * The offline suites prove each side against a double. This talks to a running
 * Arena over HTTP with the real bearer, so it answers the question the doubles
 * cannot: does the central panel's request actually get the data it renders?
 *
 *   ARENA_ADMIN_ORIGIN=https://arena.sekolahkarir.id ARENA_ADMIN_TOKEN=… \
 *     node --import ./scripts/node-test-hooks.mjs scripts/unified-admin-live-check.mjs
 *
 * Read-only by default, so it is safe to point at staging or production: it
 * issues GETs and two deliberately unauthenticated requests, nothing else.
 *
 *   --gateway <path>   Send every request through the website's own
 *                      `adminGateway` (path to the sekolah-karir-website
 *                      checkout), so the route map, query allowlist and error
 *                      mapping are part of what is checked.
 *   --mutations        Also exercise product create → edit → stale edit →
 *                      concurrent edit → archive. Refused unless the origin is
 *                      loopback: it writes rows, and this script must never be
 *                      the reason a production catalogue gained a product.
 *
 * Never run as part of `npm run test:offline` (it is not a *.test.mjs file).
 * The token is read from the environment and never printed.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const origin = (process.env.ARENA_ADMIN_ORIGIN ?? "").replace(/\/$/, "");
const token = process.env.ARENA_ADMIN_TOKEN ?? "";
if (!origin || !token) {
  console.error("ARENA_ADMIN_ORIGIN and ARENA_ADMIN_TOKEN are required.");
  process.exit(2);
}
const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname);
if (flag("--mutations") && !loopback) {
  console.error("--mutations writes rows and is only allowed against a loopback Arena.");
  process.exit(2);
}

/** What the central panel renders per module: the response key holding rows, and the fields its columns read. */
const MODULES = {
  overview: { path: ["overview"], shape: "object", key: "overview", fields: ["queue", "flags", "health"] },
  products: { path: ["products"], rows: "products", fields: ["id", "title", "productKind", "priceIdrMinor", "status", "updatedAt"] },
  orders: { path: ["orders"], rows: "orders", fields: ["id", "productTitle", "buyerEmail", "amountIdrMinor", "status"] },
  projects: { path: ["projects"], rows: "projects", fields: ["id", "title", "divisionName", "weekCode", "status"] },
  divisions: { path: ["divisions"], rows: "divisions", fields: ["id", "name", "slug", "hasBaseRubric", "isActive"] },
  weeks: { path: ["weeks"], rows: "weeks", fields: ["id", "title", "weekCode", "opensAt", "submissionDeadlineAt", "status"] },
  reviews: { path: ["reviews"], rows: "reviews", fields: ["versionId", "weekCode", "aiScore", "finalScore", "status"] },
  rewards: { path: ["rewards"], rows: "redemptions", fields: ["id", "name", "reward", "pointsSpent", "status"] },
  inventory: { path: ["inventory"], rows: "rewards", fields: ["id", "title", "inventoryMode"], also: ["periods"] },
  users: { path: ["users"], rows: "users", fields: ["id", "name", "email", "status", "createdAt"] },
  activity: { path: ["activity"], rows: "entries", fields: ["action", "actorSubject", "entityType", "createdAt"] },
};

/** Arena's own paths, for the direct transport. Mirrors the website's ARENA_COLLECTIONS. */
const DIRECT = {
  overview: "/api/internal/admin/overview", products: "/api/internal/store/products", orders: "/api/internal/store/orders",
  projects: "/api/internal/admin/projects", divisions: "/api/internal/admin/divisions", weeks: "/api/internal/weeks",
  reviews: "/api/internal/reviews/admin", rewards: "/api/internal/rewards", inventory: "/api/internal/rewards/inventory",
  users: "/api/internal/admin/users", activity: "/api/internal/admin/audit",
};

let gateway = null;
const gatewayRepo = option("--gateway");
if (gatewayRepo) {
  gateway = (await import(pathToFileURL(path.resolve(gatewayRepo, "src/lib/unified-admin-gateway.ts")).href)).adminGateway;
}
const CENTRAL = "https://central.invalid";

/** One request, through the website gateway when asked, otherwise straight to Arena. */
async function call(method, segments, { query = "", body, bearer = token } = {}) {
  const init = { method, headers: { "Content-Type": "application/json", Accept: "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) };
  let response;
  if (gateway) {
    const request = new Request(`${CENTRAL}/api/admin/integrations/arena/${segments.join("/")}${query}`, {
      ...init, headers: { ...init.headers, origin: CENTRAL },
    });
    response = await gateway(request, { source: "arena", path: segments }, true, { ARENA_ADMIN_ORIGIN: origin, ARENA_ADMIN_TOKEN: bearer, NODE_ENV: loopback ? "development" : "production" });
  } else {
    const [resource, ...rest] = segments;
    response = await fetch(`${origin}${DIRECT[resource]}${rest.length ? `/${rest.join("/")}` : ""}${query}`, {
      ...init, headers: { ...init.headers, ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, redirect: "error", cache: "no-store",
    });
  }
  return { status: response.status, payload: await response.json().catch(() => null) };
}

const results = [];
const record = (ok, name, detail = "") => {
  results.push({ ok, name, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

console.log(`Arena: ${origin}  transport: ${gateway ? "website gateway" : "direct"}  mode: ${flag("--mutations") ? "read + local mutations" : "read-only"}\n`);

// --- every module the panel renders -----------------------------------------
for (const [name, spec] of Object.entries(MODULES)) {
  const { status, payload } = await call("GET", spec.path, { query: name === "overview" ? "" : "?limit=5" });
  if (status !== 200) { record(false, `GET ${name}`, `HTTP ${status} ${payload?.error?.code ?? ""}`); continue; }
  const data = payload?.data;
  if (spec.shape === "object") {
    const object = spec.key ? data?.[spec.key] : data;
    const missing = spec.fields.filter((field) => !(field in (object ?? {})));
    record(missing.length === 0, `GET ${name}`, missing.length ? `missing ${missing.join(", ")}` : "shape ok");
    continue;
  }
  const rows = data?.[spec.rows];
  if (!Array.isArray(rows)) { record(false, `GET ${name}`, `no "${spec.rows}" array in the response`); continue; }
  const missingAlso = (spec.also ?? []).filter((key) => !Array.isArray(data?.[key]));
  if (!rows.length) { record(missingAlso.length === 0, `GET ${name}`, "0 rows — fields cannot be checked on an empty collection"); continue; }
  const missing = spec.fields.filter((field) => !(field in rows[0]));
  record(missing.length === 0 && missingAlso.length === 0, `GET ${name}`,
    missing.length || missingAlso.length ? `rows lack ${[...missing, ...missingAlso].join(", ")}` : `${rows.length} row(s), all panel fields present`);
}

// --- filters and paging the panel sends ---------------------------------------
{
  const first = await call("GET", ["orders"], { query: "?limit=1&offset=0" });
  const second = await call("GET", ["orders"], { query: "?limit=1&offset=1" });
  const a = first.payload?.data?.orders?.[0]?.id; const b = second.payload?.data?.orders?.[0]?.id;
  record(first.status === 200 && second.status === 200 && (!a || !b || a !== b), "orders paging", a && b ? "page 2 does not repeat page 1" : "fewer than two orders — paging not exercised");
  const none = await call("GET", ["orders"], { query: "?q=zz-no-such-order-zz" });
  record(none.status === 200 && none.payload?.data?.orders?.length === 0, "orders search", "an unmatched query returns no rows");
  const wild = await call("GET", ["orders"], { query: "?q=%25" });
  const all = await call("GET", ["orders"], { query: "" });
  record(wild.status === 200 && (wild.payload?.data?.orders?.length ?? 0) <= (all.payload?.data?.orders?.length ?? 0) && (all.payload?.data?.orders?.length === 0 || wild.payload?.data?.orders?.length === 0),
    "orders search escapes wildcards", "a literal % is not a match-everything pattern");
  const inventory = await call("GET", ["inventory"], { query: "?limit=1" });
  const rewardIds = new Set((inventory.payload?.data?.rewards ?? []).map((row) => row.id));
  const stray = (inventory.payload?.data?.periods ?? []).filter((period) => !rewardIds.has(period.rewardId));
  record(inventory.status === 200 && stray.length === 0, "inventory periods", "every period belongs to a reward on the page");
}

// --- the bearer is what stands between the internet and this API -------------
if (!gateway) {
  const anonymous = await call("GET", ["overview"], { bearer: "" });
  record(anonymous.status === 403, "no bearer is refused", `HTTP ${anonymous.status}`);
}
{
  const wrong = await call("GET", ["overview"], { bearer: "x".repeat(64) });
  record([401, 403].includes(wrong.status), "a wrong bearer is refused", `HTTP ${wrong.status}`);
  const post = await call("POST", ["overview"], { body: {} });
  record(gateway ? post.status === 404 : post.status === 405, "no write exists where the contract has none", `HTTP ${post.status}`);
}

// --- product writes: local sandbox only ---------------------------------------
if (flag("--mutations")) {
  const slug = `live-check-${Date.now()}`;
  const draft = { slug, title: "Live check product", productKind: "DOWNLOAD", status: "DRAFT", priceIdrMinor: 4900000 };
  const created = await call("POST", ["products"], { body: draft });
  const product = created.payload?.data?.product;
  record(created.status === 201 && Boolean(product?.id) && Boolean(product?.updatedAt), "product create", `HTTP ${created.status}`);
  if (product?.id) {
    const edited = await call("PUT", ["products", product.id], { body: { ...draft, title: "Live check product (edited)", expectedUpdatedAt: product.updatedAt } });
    const current = edited.payload?.data?.product;
    record(edited.status === 200 && current?.updatedAt !== product.updatedAt, "edit with the version the server returned", `HTTP ${edited.status}`);

    const stale = await call("PUT", ["products", product.id], { body: { ...draft, title: "stale", expectedUpdatedAt: product.updatedAt } });
    record(stale.status === 409 && stale.payload?.error?.code === "PRODUCT_EDIT_CONFLICT", "a stale edit is refused", `HTTP ${stale.status} ${stale.payload?.error?.code ?? ""}`);

    // Two operators saving the same version at the same moment: one row lock, one winner.
    const race = await Promise.all(["A", "B"].map((who) => call("PUT", ["products", product.id], { body: { ...draft, title: `race ${who}`, expectedUpdatedAt: current.updatedAt } })));
    const statuses = race.map((entry) => entry.status).sort();
    record(statuses[0] === 200 && statuses[1] === 409, "concurrent edits: exactly one wins", `HTTP ${statuses.join(" + ")}`);

    const winner = race.find((entry) => entry.status === 200)?.payload?.data?.product;
    const archived = await call("PUT", ["products", product.id], { body: { ...draft, title: winner?.title ?? draft.title, status: "ARCHIVED", expectedUpdatedAt: winner?.updatedAt } });
    record(archived.status === 200 && archived.payload?.data?.product?.status === "ARCHIVED", "archive (cleanup; the store has no delete)", `HTTP ${archived.status}`);

    const trail = await call("GET", ["activity"], { query: "?entityType=store_product&limit=20" });
    const mine = (trail.payload?.data?.entries ?? []).filter((entry) => entry.entityId === product.id);
    const actions = mine.map((entry) => entry.action);
    record(actions.filter((action) => action === "STORE_PRODUCT_CREATED").length === 1 && actions.filter((action) => action === "STORE_PRODUCT_UPDATED").length === 3,
      "one audit row per committed write, none for refused ones", `${actions.length} rows: ${actions.join(", ")}`);
    record(mine.every((entry) => entry.actorSubject && entry.actorType === "ADMIN"), "audit names the configured operator", mine[0]?.actorSubject ?? "");
  }
  const invalid = await call("POST", ["products"], { body: { slug: "x", title: "", productKind: "DOWNLOAD", status: "DRAFT" } });
  record(invalid.status === 400, "an invalid product is a 400, not a 500", `HTTP ${invalid.status}`);
}

const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
