import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

// Execute shipped services, replacing persistence and external storage only.
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(specifier => {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (specifier === "server-only") return {};
    if (specifier.startsWith("@/")) return load(`src/${specifier.slice(2)}.ts`, mocks);
    return require(specifier);
  }, module, module.exports);
  return module.exports;
}
const errors = load("src/server/arena/errors.ts");
const products = { id: "id", slug: "slug" };
const logs = {};
const mocks = {
  "@/server/db/client": { getDb: () => { throw new Error("No live database allowed"); } },
  "@/server/db/schema": { products, logs },
  "@/server/arena/errors": errors,
  "@/server/storage": {},
  "./entitlement-service": { featurePath: key => key === "cv-scanner" ? "/cv-scanner" : null },
  "drizzle-orm": { asc: value => value, eq: (key, value) => ({ key, value }) },
};
const service = load("src/server/store/admin-service.ts", mocks);
const schemas = load("src/server/store/schemas.ts");
const input = { slug: "demo", title: "Demo", productKind: "DOWNLOAD", status: "DRAFT" };
const version = new Date("2026-10-01T00:00:00.000Z");

function database(initial = [], auditFails = false) {
  const state = { rows: initial.map(row => ({ ...row })), audits: [], locks: 0, transactions: 0 };
  function connection(target) {
    return {
      select: () => ({ from: () => ({ where: condition => {
        const result = target.rows.filter(row => row[condition.key] === condition.value).map(row => ({ ...row }));
        return { then: (yes, no) => Promise.resolve(result).then(yes, no), for: mode => {
          assert.equal(mode, "update"); state.locks++; return Promise.resolve(result);
        } };
      } }) }),
      insert: table => ({ values: row => {
        if (table === logs) {
          if (auditFails) return Promise.reject(new Error("audit unavailable"));
          target.audits.push(row); return Promise.resolve();
        }
        const created = { ...row, id: "product-1", updatedAt: version };
        target.rows.push(created);
        return { returning: async () => [created] };
      } }),
      update: () => ({ set: changes => ({ where: condition => ({ returning: async () => {
        const row = target.rows.find(row => row[condition.key] === condition.value);
        Object.assign(row, changes); return [row];
      } }) }) }),
    };
  }
  const db = connection(state);
  db.transaction = async fn => {
    state.transactions++;
    const draft = { rows: state.rows.map(row => ({ ...row })), audits: [...state.audits] };
    const result = await fn(connection(draft));
    state.rows = draft.rows; state.audits = draft.audits;
    return result;
  };
  return { db, state };
}

test("creation rolls back the product when audit insertion fails", async () => {
  const { db, state } = database([], true);
  await assert.rejects(service.createProduct({ product: input, actorSubject: "operator", db }), /audit unavailable/);
  assert.equal(state.rows.length, 0);
});

test("updates roll back the product when audit insertion fails", async () => {
  const { db, state } = database([{ ...input, id: "product-1", updatedAt: version }], true);
  await assert.rejects(service.updateProduct({ productId: "product-1", product: { ...input, title: "Changed" }, actorSubject: "operator", db }), /audit unavailable/);
  assert.equal(state.rows[0].title, "Demo");
});

test("stale full edits return a conflict and preserve the saved product", async () => {
  const { db, state } = database([{ ...input, id: "product-1", updatedAt: version }]);
  await assert.rejects(service.updateProduct({ productId: "product-1", product: { ...input, title: "Stale" },
    expectedUpdatedAt: "2026-09-30T00:00:00.000Z", actorSubject: "operator", db }), error => {
    assert.equal(error.code, "PRODUCT_EDIT_CONFLICT");
    assert.equal(errors.toArenaErrorResponse(error).status, 409);
    return true;
  });
  assert.equal(state.rows[0].title, "Demo");
  assert.equal(state.audits.length, 0);
  assert.equal(state.locks, 1);
});

test("current versions save with audit atomically; a repeated version conflicts", async () => {
  const { db, state } = database([{ ...input, id: "product-1", updatedAt: version }]);
  const request = { productId: "product-1", product: { ...input, title: " Updated " }, expectedUpdatedAt: version.toISOString(), actorSubject: "operator", db };
  const updated = await service.updateProduct(request);
  assert.equal(updated.title, "Updated");
  assert.equal(state.audits[0].actorSubject, "operator");
  assert.deepEqual(state.audits[0].metadata.changed.title, { from: "Demo", to: "Updated" });
  await assert.rejects(service.updateProduct(request), error => error.code === "PRODUCT_EDIT_CONFLICT");
  assert.equal(state.audits.length, 1);
});

test("legacy clients may omit the version while updates still lock the row", async () => {
  const { db, state } = database([{ ...input, id: "product-1", updatedAt: version }]);
  await service.updateProduct({ productId: "product-1", product: input, actorSubject: "operator", db });
  assert.equal(state.locks, 1);
  assert.equal(state.transactions, 1);
});

test("request schema retains a valid optional version and rejects malformed versions", () => {
  assert.equal(schemas.storeProductSchema.parse({ ...input, expectedUpdatedAt: version.toISOString() }).expectedUpdatedAt, version.toISOString());
  assert.equal(schemas.storeProductSchema.safeParse({ ...input, expectedUpdatedAt: "yesterday" }).success, false);
  assert.equal(schemas.storeProductSchema.safeParse(input).success, true);
});

test("the existing internal store route forwards the validated edit version", async () => {
  let saved;
  const route = load("src/app/api/internal/store/products/[id]/route.ts", {
    "@/server/admin/auth": { requireArenaAdmin: async () => ({ actorSubject: "operator" }) },
    "@/server/store/schemas": schemas,
    "@/server/store/admin-service": { updateProduct: async value => { saved = value; return input; } },
    "@/server/arena/http": { arenaData: data => Response.json({ data }), arenaError: error => { throw error; } },
  });
  const response = await route.PUT(new Request("https://arena.test/api/internal/store/products/11111111-2222-4333-8444-555555555555", {
    method: "PUT", body: JSON.stringify({ ...input, expectedUpdatedAt: version.toISOString() }),
  }), { params: Promise.resolve({ id: "11111111-2222-4333-8444-555555555555" }) });
  assert.equal(response.status, 200);
  assert.equal(saved.expectedUpdatedAt, version.toISOString());
  assert.equal(saved.actorSubject, "operator");
});

test("a taken slug is its own 409, so the panel can name the field", async () => {
  const { db, state } = database([{ ...input, id: "product-1", updatedAt: version }, { ...input, slug: "other", id: "product-2", updatedAt: version }]);
  const taken = error => {
    assert.equal(error.code, "PRODUCT_SLUG_TAKEN");
    assert.equal(errors.toArenaErrorResponse(error).status, 409);
    assert.match(error.message, /"demo" sudah dipakai/);
    return true;
  };
  await assert.rejects(service.createProduct({ product: input, actorSubject: "operator", db }), taken);
  await assert.rejects(service.updateProduct({ productId: "product-2", product: input, actorSubject: "operator", db }), taken);
  assert.equal(state.audits.length, 0);
  assert.equal(state.rows.length, 2);
});

test("two creates racing past the check meet the unique index and still read as a taken slug", async () => {
  const raced = (error) => {
    const { db } = database();
    const insert = db.transaction;
    db.transaction = fn => insert(tx => fn({ ...tx, insert: () => ({ values: () => ({ returning: () => Promise.reject(error) }) }) }));
    return service.createProduct({ product: input, actorSubject: "operator", db });
  };
  await assert.rejects(raced(Object.assign(new Error("duplicate"), { code: "23505", constraint: "store_products_slug_unique" })), error => error.code === "PRODUCT_SLUG_TAKEN");
  await assert.rejects(raced({ cause: { code: "23505", constraint: "store_products_slug_unique" } }), error => error.code === "PRODUCT_SLUG_TAKEN");
  // Any other violation is not dressed up as a slug problem.
  const other = Object.assign(new Error("other"), { code: "23505", constraint: "store_products_pkey" });
  await assert.rejects(raced(other), error => error === other);
});

test("validation errors name the field, so a remote form can mark it", async () => {
  const { db } = database();
  const field = async (product) => {
    try { await service.createProduct({ product: { ...input, ...product }, actorSubject: "operator", db }); }
    catch (error) {
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(errors.toArenaErrorResponse(error).body.error.details.field, error.details.field);
      return error.details.field;
    }
    assert.fail("expected a validation error");
  };
  assert.equal(await field({ slug: "Not A Slug" }), "slug");
  assert.equal(await field({ title: " " }), "title");
  assert.equal(await field({ priceIdrMinor: 150 }), "priceIdrMinor");
  assert.equal(await field({ deliveryKind: "LINK" }), "deliveryUrl");
  assert.equal(await field({ deliveryKind: "FILE" }), "deliveryObjectKey");
  assert.equal(await field({ status: "ACTIVE", pointsCost: 10 }), "deliveryKind");
  assert.equal(await field({ productKind: "ACCESS", status: "ACTIVE", pointsCost: 10 }), "featureKey");
});
