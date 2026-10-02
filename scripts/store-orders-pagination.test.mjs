import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "server-only") return {};
    return require(name);
  }, module, module.exports);
  return module.exports;
}
const columns = Object.fromEntries(["id", "createdAt", "status", "productTitle", "providerOrderId"].map(key => [key, key]));
const errors = load("src/server/arena/errors.ts");
const schema = load("src/server/store/schemas.ts");
const service = load("src/server/store/checkout-service.ts", {
  "@/server/db/client": { getDb: () => { throw new Error("No live database allowed"); } },
  "@/server/db/schema": { orders: columns, products: {}, users: { displayNameCache: "buyer", emailCache: "buyerEmail" } },
  "@/server/arena/errors": errors,
  "@/server/rewards/accounting": {}, "@/server/notifications/service": {}, "@/server/reviews/audit": {},
  "./config": {}, "./entitlement-service": {}, "./midtrans-core": {}, "./midtrans": {},
  "drizzle-orm": {
    desc: key => key,
    eq: (key, value) => row => row[key] === value,
    and: (...filters) => row => filters.every(filter => !filter || filter(row)),
    or: (...filters) => row => filters.some(filter => filter(row)),
    ilike: (key, value) => row => String(row[key] ?? "").toLowerCase().includes(value.slice(1, -1).replace(/\\([%_\\])/g, "$1").toLowerCase()),
  },
});
function database(rows) {
  let result = [...rows];
  const query = {
    from: () => query, leftJoin: () => query,
    where: filter => { if (filter) result = result.filter(filter); return query; },
    orderBy: (...keys) => { result.sort((a, b) => {
      for (const key of keys) { if (a[key] < b[key]) return 1; if (a[key] > b[key]) return -1; } return 0;
    }); return query; },
    limit: size => { query.size = size; return query; },
    offset: offset => { query.start = offset; return query; },
    then: (yes, no) => Promise.resolve(result.slice(query.start ?? 0, (query.start ?? 0) + query.size)).then(yes, no),
  };
  return { select: () => query };
}
const rows = ["a", "c", "b"].map(id => ({ id, createdAt: new Date("2026-10-01"), fulfilledAt: null,
  status: id === "c" ? "FAILED" : "FULFILLED", productTitle: id === "b" ? "Resume kit" : "Other", buyer: "Someone", buyerEmail: "user@test.example", providerOrderId: id }));

test("next order page advances using a stable id tie break", async () => {
  const first = await service.listAllOrders({ limit: 1 }, database(rows));
  const next = await service.listAllOrders({ limit: 1, offset: 1 }, database(rows));
  assert.equal(first[0].id, "c");
  assert.equal(next[0].id, "b");
});

test("order search combines with status before pagination", async () => {
  const found = await service.listAllOrders({ status: "FULFILLED", q: " resume " }, database(rows));
  assert.deepEqual(found.map(row => row.id), ["b"]);
  assert.equal((await service.listAllOrders({ q: "user@test.example", offset: 2 }, database(rows)))[0].id, "a");
});

test("offset and query are validated without breaking old callers", () => {
  assert.deepEqual(schema.storeOrderQuerySchema.parse({ offset: "10", q: " kit " }), { offset: 10, q: "kit" });
  for (const offset of ["-1", "1.5", "100001", "nope"]) assert.equal(schema.storeOrderQuerySchema.safeParse({ offset }).success, false);
  assert.equal(schema.storeOrderQuerySchema.safeParse({ q: "x".repeat(201) }).success, false);
  assert.deepEqual(schema.storeOrderQuerySchema.parse({}), {});
});
