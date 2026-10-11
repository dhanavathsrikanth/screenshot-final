import test, { after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool, syncClerkAccount } from "./index.js";

const enabled = process.env.SNAPFORGE_BILLING_TEST === "1";
const users: string[] = [];
function user() { const id = `clerk-sync-test-${randomUUID()}`; users.push(id); return id; }
afterEach(async () => {
  if (users.length) await pool.query("DELETE FROM accounts WHERE user_id = ANY($1::text[])", [users.splice(0)]);
});
after(async () => { await pool.end(); });

test("repeated profile sync preserves purchased plan, credits, debt and payment ownership", { skip: !enabled }, async () => {
  const userId = user();
  await syncClerkAccount(userId, async () => ({ email: "first@example.com", displayName: "First" }));
  await pool.query("UPDATE accounts SET plan = 'growth', prepaid_credits = 123, refunded_credit_debt = 4, dodo_customer_id = $2 WHERE user_id = $1", [userId, `cus-${randomUUID()}`]);
  const before = (await pool.query("SELECT * FROM accounts WHERE user_id = $1", [userId])).rows[0];
  await Promise.all(Array.from({ length: 4 }, () => syncClerkAccount(userId, async () => ({ email: "current@example.com", displayName: "Current" }))));
  const after = (await pool.query("SELECT * FROM accounts WHERE user_id = $1", [userId])).rows[0];
  assert.equal(after.email, "current@example.com");
  for (const field of ["plan", "prepaid_credits", "refunded_credit_debt", "dodo_customer_id"]) assert.equal(after[field], before[field]);
});

test("deleted provider users and failed provider reads cannot create accounts", { skip: !enabled }, async () => {
  const userId = user();
  await syncClerkAccount(userId, async () => null);
  await assert.rejects(syncClerkAccount(userId, async () => { throw new Error("Provider unavailable"); }));
  assert.equal((await pool.query("SELECT user_id FROM accounts WHERE user_id = $1", [userId])).rowCount, 0);
});
