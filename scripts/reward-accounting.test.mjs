import test from 'node:test';
import assert from 'node:assert/strict';
import { getLifetimePoints } from '../src/server/rewards/milestones.ts';
import { PgDialect } from 'drizzle-orm/pg-core';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { catalog, pointAccounts, pointLedger, redemptions, inventoryPeriods, events, deliveries, logs } from '../src/server/db/schema/index.ts';
import { claimRedemption, fulfillRedemption, reverseRedemption, reconcilePointAccount } from '../src/server/rewards/redemption-service.ts';

// In-memory transaction adapter with row locks, uniqueness, rollback and SQL
// predicate evaluation. It runs the real service; no PostgreSQL connection exists.
function fakeDb() {
  const tables = new Map([catalog, pointAccounts, pointLedger, redemptions, inventoryPeriods, events, deliveries, logs].map((t) => [t, []]));
  const locks = new Map();
  const trace = [];
  const dialect = new PgDialect();
  const root = { tables, trace, failTable: null };
  const keyOf = (table, row) => table === pointAccounts ? row.userId : row.id;
  const predicate = (table, where) => {
    if (!where) return () => true;
    const query = dialect.sqlToQuery(where);
    const columns = getTableColumns(table);
    const clauses = [...query.sql.matchAll(/"[^".]+"\."[^".]+"\."([^".]+)"\s*(=|<=|>)\s*\$(\d+)/g)];
    assert.ok(clauses.length, `Unsupported predicate: ${query.sql}`);
    return (row) => clauses.every(([, column, op, index]) => {
      const field = Object.keys(columns).find((name) => columns[name].name === column);
      assert.ok(field, column);
      const left = row[field] instanceof Date ? row[field].toISOString() : row[field];
      const right = query.params[Number(index) - 1];
      return op === '=' ? left === right : op === '<=' ? left <= right : left > right;
    });
  };
  const makeTx = () => {
    const held = new Map();
    const undo = [];
    async function lock(key) {
      if (held.has(key)) return;
      const before = locks.get(key) ?? Promise.resolve();
      let release;
      const own = new Promise((resolve) => { release = resolve; });
      locks.set(key, before.then(() => own));
      await before;
      held.set(key, release);
    }
    function mutation(table, row, values) {
      const previous = structuredClone(row);
      undo.push(() => Object.assign(row, previous));
      Object.assign(row, structuredClone(values));
    }
    function lazy(run, methods) {
      const chain = { then: (yes, no) => Promise.resolve().then(run).then(yes, no) };
      for (const [name, fn] of Object.entries(methods)) chain[name] = (...args) => { fn(...args); return chain; };
      return chain;
    }
    const tx = {
      select(projection) {
        let table, where, mode, limit = Infinity;
        const orders = [];
        return lazy(async () => {
          const matches = predicate(table, where);
          if (mode === 'update') {
            for (const row of tables.get(table).filter(matches)) await lock(`${getTableName(table)}:${keyOf(table, row)}`);
            trace.push(`lock:${getTableName(table)}`);
          }
          let result = tables.get(table).filter(matches);
          for (const order of orders.toReversed()) {
            const sql = dialect.sqlToQuery(order).sql;
            const column = [...sql.matchAll(/"([^".]+)"/g)].at(-1)[1];
            const field = Object.keys(getTableColumns(table)).find((name) => table[name].name === column);
            result = [...result].sort((a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (sql.endsWith(' desc') ? -1 : 1));
          }
          return result.slice(0, limit).map((row) => projection
            ? Object.fromEntries(Object.entries(projection).map(([key, col]) => [key, row[Object.keys(getTableColumns(table)).find((name) => table[name] === col)]]))
            : structuredClone(row));
        }, { from: (t) => { table = t; }, where: (w) => { where = w; }, for: (m) => { mode = m; },
          orderBy: (...o) => orders.push(...o), limit: (n) => { limit = n; } });
      },
      insert(table) {
        let values, conflict = false, projection;
        return lazy(async () => {
          if (root.failTable === table) throw new Error('injected write failure');
          const inserted = [];
          for (const value of Array.isArray(values) ? values : [values]) {
            if (table === pointAccounts) await lock(`${getTableName(table)}:${value.userId}`);
            const unique = table === pointAccounts ? 'userId' : 'idempotencyKey';
            if (value[unique] && tables.get(table).some((r) => r[unique] === value[unique])) {
              if (conflict) continue;
              throw new Error('unique violation');
            }
            const row = { id: randomUUID(), createdAt: new Date(), redeemedAt: new Date(),
              balance: 0, lifetimeEarned: 0, lifetimeSpent: 0, fulfilledAt: null, fulfillmentReference: null, ...structuredClone(value) };
            tables.get(table).push(row);
            undo.push(() => { tables.get(table).splice(tables.get(table).indexOf(row), 1); });
            trace.push(`insert:${getTableName(table)}`);
            inserted.push(projection ? Object.fromEntries(Object.keys(projection).map((k) => [k, row[k]])) : structuredClone(row));
          }
          return inserted;
        }, { values: (v) => { values = v; }, onConflictDoNothing: () => { conflict = true; }, returning: (p) => { projection = p; } });
      },
      update(table) {
        let values, where;
        return lazy(async () => {
          if (root.failTable === table) throw new Error('injected write failure');
          const rows = tables.get(table).filter(predicate(table, where));
          for (const row of rows) mutation(table, row, values);
          return structuredClone(rows);
        }, { set: (v) => { values = v; }, where: (w) => { where = w; }, returning: () => {} });
      },
      finish(error) {
        if (error) for (const revert of undo.toReversed()) revert();
        for (const release of held.values()) release();
      },
    };
    // Drizzle turns a transaction opened on a `tx` into a SAVEPOINT, so service
    // code is free to call a helper that opens its own — `notify(input, tx)` in
    // the redemption path does exactly that. Without this the fake only had a
    // transaction on the root and every reward write died on
    // `db.transaction is not a function`. Reusing the same tx keeps the
    // enclosing rollback authoritative, which is what a savepoint inside a
    // failed outer transaction ends up doing anyway.
    tx.transaction = async (fn) => fn(tx);
    return tx;
  };
  root.transaction = async (fn) => {
    const tx = makeTx();
    try { const value = await fn(tx); tx.finish(); return value; }
    catch (error) { tx.finish(error); throw error; }
  };
  // Voucher delivery reads and audits outside any transaction, so that its
  // HTTP call never holds a lock. Plain reads here take no row locks.
  const direct = makeTx();
  root.select = direct.select;
  root.insert = direct.insert;
  root.update = direct.update;
  return root;
}

function setup({ cost = 2000, balance = 3000, limited = false, quantity = 1 } = {}) {
  const db = fakeDb();
  const sku = { id: 'reward', slug: 'usd-20-cash', title: 'USD 20', pointsCost: cost, isActive: true,
    rewardType: 'MONETARY', inventoryMode: limited ? 'LIMITED' : 'UNLIMITED' };
  db.tables.get(catalog).push(sku);
  const award = (userId, amount = balance) => db.tables.get(pointLedger).push({ id: randomUUID(), userId,
    amount, entryType: 'WEEKLY_RANK', referenceType: 'ranking', idempotencyKey: `award:${userId}` });
  award('user');
  if (limited) db.tables.get(inventoryPeriods).push({ id: 'period', rewardId: sku.id,
    periodStart: new Date(Date.now() - 10000), periodEnd: new Date(Date.now() + 60000),
    quantityTotal: quantity, quantityReserved: 0, quantityFulfilled: 0 });
  return { db, sku, award, claim: (extra = {}) => claimRedemption({ userId: 'user', slug: sku.slug, db, ...extra }) };
}

const admin = { actorSubject: 'admin' };
const fulfill = (db, redemptionId, extra = {}) => fulfillRedemption({ db, redemptionId, ...admin, reference: 'bank:verified-123', ...extra });
const reverse = (db, redemptionId, extra = {}) => reverseRedemption({ db, redemptionId, ...admin, reason: 'Verified processing failure', ...extra });

test('milestone earnings exclude spending/refunds but include fraud debt', async () => {
  const rows = [
    { amount: 3000, entryType: 'WEEKLY_RANK' },
    { amount: -2000, entryType: 'REWARD_REDEMPTION', referenceType: 'redemption' },
    { amount: 2000, entryType: 'ADMIN_REVERSAL', referenceType: 'redemption' },
    { amount: -500, entryType: 'ADMIN_REVERSAL', referenceType: 'ranking' },
  ];
  const db = { select: () => ({ from: () => ({ where: async () => rows }) }) };
  assert.equal(await getLifetimePoints('user', db), 2500);
  rows.pop();
  rows.pop();
  assert.equal(await getLifetimePoints('user', db), 3000);
});

test('concurrent duplicate claims debit once and create one audit/inbox notice', async () => {
  const { db, claim } = setup();
  // Exactly one claim wins; the rest are refused rather than handed the winner's
  // redemption. That refusal is deliberate — claimRedemption "never mint[s] or
  // silently re-issue[s]", and e2e-finalization.test.mjs asserts the same
  // against real Postgres. What matters here is that losing does not cost
  // anything: one row, one debit, one notice, one audit entry.
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => claim()));
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  assert.equal(fulfilled.length, 1, 'a duplicate claim must be refused, not re-issued');
  assert.ok(fulfilled[0].value.redemptionId);
  for (const rejected of results.filter((r) => r.status === 'rejected')) {
    assert.match(rejected.reason.message, /sudah diklaim/);
  }
  assert.equal(db.tables.get(redemptions).length, 1);
  assert.equal(db.tables.get(pointLedger).filter((r) => r.entryType === 'REWARD_REDEMPTION').length, 1);
  assert.equal(db.tables.get(pointAccounts)[0].balance, 1000);
  assert.equal(db.tables.get(events).length, 1);
  assert.equal(db.tables.get(logs).length, 1);
  assert.ok(db.trace.includes('lock:point_accounts'));
});

test('concurrent distinct SKUs cannot overspend one authoritative ledger balance', async () => {
  const { db, claim, sku } = setup();
  db.tables.get(catalog).push({ ...sku, id: 'other', slug: 'other' });
  db.tables.get(pointAccounts).push({ userId: 'user', balance: 100000, lifetimeEarned: 100000, lifetimeSpent: 0 });
  const results = await Promise.allSettled([claim(), claim({ slug: 'other' })]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(db.tables.get(pointAccounts)[0].balance, 1000);
});

test('two users competing for last stock reserve exactly one unit', async () => {
  const { db, claim, award } = setup({ limited: true });
  award('other');
  const results = await Promise.allSettled([claim(), claim({ userId: 'other' })]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(db.tables.get(inventoryPeriods)[0].quantityReserved, 1);
  assert.equal(db.tables.get(redemptions).length, 1);
  assert.ok(db.trace.includes('lock:inventory_periods'));
});

test('expired, future and fully consumed periods cannot reserve stock', async () => {
  for (const kind of ['expired', 'future', 'fulfilled', 'reserved']) {
    const { db, claim } = setup({ limited: true });
    const period = db.tables.get(inventoryPeriods)[0];
    if (kind === 'expired') period.periodEnd = new Date(Date.now() - 1);
    if (kind === 'future') period.periodStart = new Date(Date.now() + 60000);
    if (kind === 'fulfilled') period.quantityFulfilled = 1;
    if (kind === 'reserved') period.quantityReserved = 1;
    await assert.rejects(claim(), /stock/);
    assert.equal(db.tables.get(redemptions).length, 0);
    assert.equal(db.tables.get(pointLedger).length, 1);
  }
});

test('fulfillment requires reference and atomically converts reservation once', async () => {
  const { db, claim } = setup({ limited: true });
  const { redemptionId } = await claim();
  await assert.rejects(fulfill(db, redemptionId, { reference: ' ' }), /reference/);
  const results = await Promise.all([fulfill(db, redemptionId), fulfill(db, redemptionId)]);
  assert.ok(results.every((r) => r.status === 'FULFILLED'));
  const period = db.tables.get(inventoryPeriods)[0];
  assert.equal(period.quantityReserved, 0);
  assert.equal(period.quantityFulfilled, 1);
  assert.equal(db.tables.get(events).length, 2);
  assert.equal(db.tables.get(logs).length, 2);
  await assert.rejects(fulfill(db, redemptionId, { reference: 'other-payment' }), /different reference/);
});

test('concurrent reversals refund once, release stock and require intentional retry', async () => {
  const { db, claim } = setup({ limited: true });
  const { redemptionId } = await claim();
  await Promise.all([reverse(db, redemptionId), reverse(db, redemptionId)]);
  assert.equal(db.tables.get(pointLedger).filter((r) => r.entryType === 'ADMIN_REVERSAL').length, 1);
  assert.equal(db.tables.get(pointAccounts)[0].balance, 3000);
  assert.equal(db.tables.get(inventoryPeriods)[0].quantityReserved, 0);
  await assert.rejects(claim(), /retryOf/);
  const retried = await claim({ retryOf: redemptionId });
  assert.notEqual(retried.redemptionId, redemptionId);
  // Repeating the same intentional retry is still a same-claim repeat, and is
  // refused for the same reason a repeated first claim is.
  await assert.rejects(claim({ retryOf: redemptionId }), /sudah diklaim/);
  assert.equal(db.tables.get(pointAccounts)[0].balance, 1000);
});

test('fulfilled reversal rejects implicit fund recall and explicit points-only reversal keeps consumed stock', async () => {
  const { db, claim } = setup({ limited: true });
  const { redemptionId } = await claim();
  await fulfill(db, redemptionId);
  await assert.rejects(reverse(db, redemptionId), /explicit.*policy/);
  await reverse(db, redemptionId, { fulfilledPolicy: 'REFUND_POINTS_KEEP_FULFILLED_STOCK' });
  const period = db.tables.get(inventoryPeriods)[0];
  assert.equal(period.quantityReserved, 0);
  assert.equal(period.quantityFulfilled, 1);
  assert.equal(db.tables.get(pointAccounts)[0].balance, 3000);
  assert.equal(db.tables.get(redemptions)[0].fulfillmentReference, 'bank:verified-123');
  assert.equal(db.tables.get(logs).at(-1).metadata.externalFundsRecalled, false);
  await assert.rejects(claim({ retryOf: redemptionId }), /stock/);
});

test('legacy unfunded pending claim cannot fulfill and reversal does not mint points', async () => {
  const { db, claim } = setup();
  db.tables.get(redemptions).push({ id: 'legacy', userId: 'user', rewardId: 'reward', status: 'PENDING',
    pointsSpent: 2000, inventoryPeriodId: null, idempotencyKey: 'take:user:reward', redeemedAt: new Date() });
  await assert.rejects(fulfill(db, 'legacy'), /Unfunded legacy/);
  await assert.rejects(claim(), /Unfunded legacy/);
  await reverse(db, 'legacy');
  assert.equal(db.tables.get(pointLedger).length, 1);
  assert.equal(db.tables.get(pointAccounts)[0].balance, 3000);
  await claim({ retryOf: 'legacy' });
  assert.equal(db.tables.get(pointAccounts)[0].balance, 1000);
});

test('FAILED funded claim must be settled before retry and cannot fulfill', async () => {
  const { db, claim } = setup({ limited: true });
  const { redemptionId } = await claim();
  db.tables.get(redemptions)[0].status = 'FAILED';
  await assert.rejects(claim({ retryOf: redemptionId }), /settle/);
  await assert.rejects(fulfill(db, redemptionId), /pending or processing/);
  await reverse(db, redemptionId);
  await claim({ retryOf: redemptionId });
  assert.equal(db.tables.get(inventoryPeriods)[0].quantityReserved, 1);
});

test('fraud debt remains in ledger and future earnings repay debt before spending', async () => {
  const { db, claim, award } = setup();
  await claim();
  db.tables.get(pointLedger).push({ id: 'fraud', userId: 'user', amount: -3000, entryType: 'ADMIN_REVERSAL', referenceType: 'ranking' });
  const totals = await db.transaction((tx) => reconcilePointAccount('user', tx));
  assert.equal(totals.balance, -2000);
  assert.equal(totals.debt, 2000);
  assert.equal(db.tables.get(pointAccounts)[0].balance, 0);
  award('user', 2500);
  const after = await db.transaction((tx) => reconcilePointAccount('user', tx));
  assert.equal(after.balance, 500);
  assert.equal(after.lifetimeEarned, 2500);
  assert.equal(after.lifetimeSpent, 2000);
  db.tables.get(catalog).push({ ...db.tables.get(catalog)[0], id: 'new', slug: 'new' });
  await assert.rejects(claim({ slug: 'new' }), /saldo 500/);
});

test('audit/notification failure rolls claim, debit, account and stock back together', async () => {
  for (const table of [logs, events, deliveries]) {
    const { db, claim } = setup({ limited: true });
    db.failTable = table;
    await assert.rejects(claim(), /injected/);
    assert.equal(db.tables.get(redemptions).length, 0);
    assert.equal(db.tables.get(pointLedger).length, 1);
    assert.equal(db.tables.get(pointAccounts).length, 0);
    assert.equal(db.tables.get(inventoryPeriods)[0].quantityReserved, 0);
    assert.equal(db.tables.get(logs).length, 0);
    assert.equal(db.tables.get(events).length, 0);
  }
});

test('fulfillment and reversal roll back when durable notification fails', async () => {
  for (const operation of [fulfill, reverse]) {
    const { db, claim } = setup({ limited: true });
    const { redemptionId } = await claim();
    db.failTable = events;
    await assert.rejects(operation(db, redemptionId), /injected/);
    assert.equal(db.tables.get(redemptions)[0].status, 'PENDING');
    assert.equal(db.tables.get(inventoryPeriods)[0].quantityReserved, 1);
    assert.equal(db.tables.get(inventoryPeriods)[0].quantityFulfilled, 0);
    assert.equal(db.tables.get(pointLedger).length, 2);
    assert.equal(db.tables.get(pointAccounts)[0].balance, 1000);
    assert.equal(db.tables.get(logs).length, 1);
  }
});

test('racing fulfillment and reversal never release fulfilled stock accidentally', async () => {
  const { db, claim } = setup({ limited: true });
  const { redemptionId } = await claim();
  await Promise.allSettled([fulfill(db, redemptionId), reverse(db, redemptionId)]);
  const take = db.tables.get(redemptions)[0];
  const period = db.tables.get(inventoryPeriods)[0];
  assert.equal(period.quantityReserved, 0);
  assert.equal(period.quantityFulfilled, take.status === 'FULFILLED' ? 1 : 0);
  assert.equal(db.tables.get(pointAccounts)[0].balance, take.status === 'FULFILLED' ? 1000 : 3000);
});

// ---- Voucher delivery versus reversal: points and a live code must never both survive.

const voucherPush = () => import('../src/server/rewards/voucher-push.ts');

function voucherSetup() {
  const context = setup({ cost: 500 });
  context.sku.rewardType = 'DISCOUNT';
  return context;
}

/** Runs with the main-site contract configured (or explicitly absent), restoring the environment after. */
async function withVoucherContract(run, configured = true) {
  const saved = { MAIN_SITE_ORIGIN: process.env.MAIN_SITE_ORIGIN, MAIN_SITE_VOUCHER_TOKEN: process.env.MAIN_SITE_VOUCHER_TOKEN };
  if (configured) {
    process.env.MAIN_SITE_ORIGIN = 'https://main.example.test';
    process.env.MAIN_SITE_VOUCHER_TOKEN = 'offline-test-token';
  } else {
    delete process.env.MAIN_SITE_ORIGIN;
    delete process.env.MAIN_SITE_VOUCHER_TOKEN;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const accepted = () => new Response('{}', { status: 201 });
const balanceOf = (db) => db.tables.get(pointAccounts)[0].balance;
const voidUrl = (code) => `https://main.example.test/api/v1/vouchers/${code}/void`;

test('a reversal that arrives while the voucher code is being pushed is refused; the claim is delivered once', async () => {
  const { deliverVoucherReward } = await voucherPush();
  const { db, claim } = voucherSetup();
  const { redemptionId } = await claim();
  let refusal = null;
  const delivery = await withVoucherContract(() => deliverVoucherReward({ redemptionId, db, fetcher: async () => {
    // Deterministic interleaving: the admin reverses while the request is in flight.
    refusal = await reverse(db, redemptionId).then(() => null, (error) => error);
    return accepted();
  } }));
  assert.equal(refusal?.code, 'REWARD_DELIVERY_IN_PROGRESS');
  assert.equal(delivery.status, 'DELIVERED');
  assert.equal(db.tables.get(redemptions)[0].status, 'FULFILLED');
  assert.equal(db.tables.get(pointLedger).filter((row) => row.entryType === 'ADMIN_REVERSAL').length, 0, 'no refund while a code went out');
  assert.equal(balanceOf(db), 2500);
});

test('a delivery started after the reversal committed pushes nothing', async () => {
  const { deliverVoucherReward } = await voucherPush();
  const { db, claim } = voucherSetup();
  const { redemptionId } = await claim();
  await reverse(db, redemptionId);
  const calls = [];
  const delivery = await withVoucherContract(() => deliverVoucherReward({ redemptionId, db, fetcher: async (url) => { calls.push(String(url)); return accepted(); } }));
  assert.equal(delivery.status, 'ALREADY_SETTLED');
  assert.equal(calls.length, 0);
  assert.equal(balanceOf(db), 3000);
});

test('a second delivery while one holds the lease reports IN_PROGRESS instead of pushing again', async () => {
  const { deliverVoucherReward } = await voucherPush();
  const { db, claim } = voucherSetup();
  const { redemptionId } = await claim();
  let nested = null;
  let pushes = 0;
  await withVoucherContract(() => deliverVoucherReward({ redemptionId, db, fetcher: async () => {
    pushes += 1;
    if (!nested) nested = await deliverVoucherReward({ redemptionId, db, fetcher: async () => { pushes += 1; return accepted(); } });
    return accepted();
  } }));
  assert.equal(nested.status, 'IN_PROGRESS');
  assert.equal(pushes, 1);
});

test('a code accepted after a lapsed lease let the reversal through is voided on the main site and audited', async () => {
  const { deliverVoucherReward, voucherCodeFor } = await voucherPush();
  const { DELIVERY_LEASE_MS } = await import('../src/server/rewards/redemption-service.ts');
  const { db, claim } = voucherSetup();
  const { redemptionId } = await claim();
  const calls = [];
  const delivery = await withVoucherContract(() => deliverVoucherReward({ redemptionId, db, fetcher: async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    if (calls.length === 1) {
      // The push stalls past its lease, so a reversal is allowed through meanwhile.
      db.tables.get(redemptions)[0].updatedAt = new Date(Date.now() - DELIVERY_LEASE_MS - 1000);
      await reverse(db, redemptionId);
    }
    return accepted();
  } }));
  const code = voucherCodeFor(redemptionId);
  assert.equal(delivery.status, 'REVOKED');
  assert.equal(delivery.voided, true);
  assert.deepEqual(calls.map((call) => call.url), ['https://main.example.test/api/v1/vouchers', voidUrl(code)]);
  assert.equal(calls[1].body.external_reference, redemptionId);
  assert.equal(db.tables.get(redemptions)[0].status, 'ADMIN_REVERSED');
  assert.equal(balanceOf(db), 3000);
  const audit = db.tables.get(logs).find((row) => row.action === 'REWARD_VOUCHER_VOIDED');
  assert.equal(audit?.metadata.trigger, 'DELIVERED_AFTER_CANCELLATION');
  assert.equal(audit?.metadata.code, code);
});

test('a void the main site does not confirm is flagged for reconciliation, never reported as done', async () => {
  const { deliverVoucherReward } = await voucherPush();
  const { DELIVERY_LEASE_MS } = await import('../src/server/rewards/redemption-service.ts');
  const { db, claim } = voucherSetup();
  const { redemptionId } = await claim();
  let calls = 0;
  const delivery = await withVoucherContract(() => deliverVoucherReward({ redemptionId, db, fetcher: async () => {
    calls += 1;
    if (calls === 1) {
      db.tables.get(redemptions)[0].updatedAt = new Date(Date.now() - DELIVERY_LEASE_MS - 1000);
      await reverse(db, redemptionId);
      return accepted();
    }
    // 404 cannot tell "nothing to void" from "no such endpoint".
    return new Response('', { status: 404 });
  } }));
  assert.equal(delivery.status, 'REVOKED');
  assert.equal(delivery.voided, false);
  const flagged = db.tables.get(logs).find((row) => row.action === 'REWARD_VOUCHER_RECONCILIATION_REQUIRED');
  assert.equal(flagged?.metadata.voidError, 'HTTP 404');
  assert.equal(db.tables.get(logs).some((row) => row.action === 'REWARD_VOUCHER_VOIDED'), false);
});

test('admin can retry an unresolved voucher void once and the resolution is audited', async () => {
  const { deliverVoucherReward, retryVoucherVoid } = await voucherPush();
  const { DELIVERY_LEASE_MS } = await import('../src/server/rewards/redemption-service.ts');
  const { db, claim } = voucherSetup();
  const { redemptionId } = await claim();
  let calls = 0;
  await withVoucherContract(async () => {
    await deliverVoucherReward({ redemptionId, db, fetcher: async () => {
      calls += 1;
      if (calls === 1) {
        db.tables.get(redemptions)[0].updatedAt = new Date(Date.now() - DELIVERY_LEASE_MS - 1000);
        await reverse(db, redemptionId);
        return accepted();
      }
      return new Response('', { status: 503 });
    } });
    const retried = await retryVoucherVoid({ redemptionId, actorSubject: 'admin', db, fetcher: async () => accepted() });
    assert.equal(retried.voided, true);
    assert.equal(db.tables.get(logs).filter((row) => row.action === 'REWARD_VOUCHER_VOIDED').at(-1)?.metadata.trigger, 'ADMIN_RETRY_VOID');
    await assert.rejects(() => retryVoucherVoid({ redemptionId, actorSubject: 'admin', db, fetcher: async () => accepted() }), /already|resolved|selesai/i);
  });
});

test('a failed push hands the claim back to PENDING, and reversing it then voids the code the main site may hold', async () => {
  const { deliverVoucherReward, reverseRedemptionAndRevokeVoucher, voucherCodeFor } = await voucherPush();
  const { db, claim } = voucherSetup();
  const { redemptionId } = await claim();
  const calls = [];
  await withVoucherContract(async () => {
    const delivery = await deliverVoucherReward({ redemptionId, db, fetcher: async (url) => { calls.push(String(url)); throw new Error('socket hang up'); } });
    assert.equal(delivery.status, 'MANUAL_REQUIRED');
    assert.equal(db.tables.get(redemptions)[0].status, 'PENDING', 'the lease is released so an admin can act at once');
    const result = await reverseRedemptionAndRevokeVoucher({ redemptionId, actorSubject: 'admin', reason: 'Main site never confirmed', db,
      fetcher: async (url) => { calls.push(String(url)); return new Response('{}', { status: 200 }); } });
    assert.equal(result.reversed.status, 'ADMIN_REVERSED');
    assert.deepEqual(result.voucher, { code: voucherCodeFor(redemptionId), voidAttempted: true, voided: true });
  });
  assert.equal(calls.at(-1), voidUrl(voucherCodeFor(redemptionId)));
  assert.equal(balanceOf(db), 3000);
  assert.equal(db.tables.get(logs).find((row) => row.action === 'REWARD_VOUCHER_VOIDED')?.metadata.trigger, 'ADMIN_REVERSAL');
});

test('reversing a voucher claim that was never pushed makes no call to the main site', async () => {
  const { deliverVoucherReward, reverseRedemptionAndRevokeVoucher } = await voucherPush();
  const { db, claim } = voucherSetup();
  const { redemptionId } = await claim();
  await withVoucherContract(async () => {
    const delivery = await deliverVoucherReward({ redemptionId, db, fetcher: async () => assert.fail('no contract, no push') });
    assert.equal(delivery.status, 'MANUAL_REQUIRED');
    const result = await reverseRedemptionAndRevokeVoucher({ redemptionId, actorSubject: 'admin', reason: 'Not needed', db,
      fetcher: async () => assert.fail('a code that was never pushed has nothing to void') });
    assert.equal(result.voucher.voidAttempted, false);
  }, false);
  assert.equal(balanceOf(db), 3000);
});
