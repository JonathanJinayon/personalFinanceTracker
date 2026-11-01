import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const TEST_EMAIL = process.env.TIGOM_TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.TIGOM_TEST_PASSWORD ?? "";

const skip =
  SUPABASE_URL && SUPABASE_ANON_KEY && TEST_EMAIL && TEST_PASSWORD
    ? false
    : "Set SUPABASE_URL, SUPABASE_ANON_KEY, TIGOM_TEST_EMAIL, and TIGOM_TEST_PASSWORD for a dedicated test project.";

function authHeaders(accessToken) {
  return {
    apikey: SUPABASE_ANON_KEY,
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
    accept: "application/json",
  };
}

async function signIn() {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });

  const body = await response.json().catch(() => ({}));
  assert.equal(response.ok, true, `Sign-in failed: ${JSON.stringify(body)}`);
  assert.ok(body.access_token, "Sign-in did not return an access token");
  return body.access_token;
}

async function rpc(name, params, accessToken) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(params),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { ok: response.ok, status: response.status, data };
}

async function rest(path, accessToken) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: authHeaders(accessToken),
  });
  const body = await response.json().catch(() => null);
  assert.equal(response.ok, true, `GET ${path} failed: ${JSON.stringify(body)}`);
  return body;
}

async function createAccount(accessToken, name, openingBalance) {
  const result = await rpc(
    "create_account",
    {
      p_name: name,
      p_type: "cash",
      p_opening_balance: openingBalance,
      p_idempotency_key: randomUUID(),
    },
    accessToken,
  );
  assert.equal(result.ok, true, `create_account failed: ${JSON.stringify(result.data)}`);
  assert.equal(typeof result.data, "string", "create_account must return an account UUID");
  return result.data;
}

async function firstExpenseCategory(accessToken) {
  const rows = await rest(
    "categories?select=id&category_type=eq.expense&is_archived=eq.false&limit=1",
    accessToken,
  );
  assert.ok(rows.length > 0, "No active expense category exists for the test user");
  return rows[0].id;
}

async function balanceOf(accessToken, accountId) {
  const rows = await rest(
    `account_balances?select=balance&account_id=eq.${accountId}`,
    accessToken,
  );
  assert.equal(rows.length, 1, `Expected one balance row for ${accountId}`);
  return rows[0].balance;
}

function describeResults(results) {
  return results
    .map((result) => `${result.status}: ${JSON.stringify(result.data)}`)
    .join(" | ");
}

test("concurrent expenses cannot overdraw the same account", { skip }, async () => {
  const token = await signIn();
  const suffix = randomUUID().slice(0, 8);
  const accountId = await createAccount(token, `Concurrency expense ${suffix}`, 1000);
  const categoryId = await firstExpenseCategory(token);
  const transactionDate = new Date().toISOString();

  const results = await Promise.all(
    [0, 1].map((index) =>
      rpc(
        "post_expense",
        {
          p_account_id: accountId,
          p_category_id: categoryId,
          p_amount: 600,
          p_transaction_date: transactionDate,
          p_description: `Concurrent expense ${index}`,
          p_idempotency_key: randomUUID(),
        },
        token,
      ),
    ),
  );

  const successes = results.filter((result) => result.ok);
  assert.equal(
    successes.length,
    1,
    `Expected exactly one expense to succeed. Results: ${describeResults(results)}`,
  );
  assert.equal(
    results.filter((result) => !result.ok).length,
    1,
    `Expected exactly one expense to fail. Results: ${describeResults(results)}`,
  );

  const balance = await balanceOf(token, accountId);
  assert.equal(balance, "400.00", "Exactly one 600.00 expense should have committed");
  assert.ok(Number(balance) >= 0, "Account balance became negative");
});

test("concurrent transfers include the fee when checking the source balance", { skip }, async () => {
  const token = await signIn();
  const suffix = randomUUID().slice(0, 8);
  const sourceId = await createAccount(token, `Concurrency source ${suffix}`, 500);
  const destinationId = await createAccount(token, `Concurrency destination ${suffix}`, 0);
  const transactionDate = new Date().toISOString();

  const results = await Promise.all(
    [0, 1].map((index) =>
      rpc(
        "post_transfer",
        {
          p_source_account_id: sourceId,
          p_destination_account_id: destinationId,
          p_amount: 250,
          p_fee: 10,
          p_transaction_date: transactionDate,
          p_description: `Concurrent transfer ${index}`,
          p_idempotency_key: randomUUID(),
        },
        token,
      ),
    ),
  );

  const successes = results.filter((result) => result.ok);
  assert.equal(
    successes.length,
    1,
    `Expected exactly one transfer to succeed. Results: ${describeResults(results)}`,
  );
  assert.equal(
    results.filter((result) => !result.ok).length,
    1,
    `Expected exactly one transfer to fail. Results: ${describeResults(results)}`,
  );

  const sourceBalance = await balanceOf(token, sourceId);
  const destinationBalance = await balanceOf(token, destinationId);
  assert.equal(sourceBalance, "240.00", "Source should reflect one transfer amount plus fee");
  assert.equal(destinationBalance, "250.00", "Destination should reflect exactly one transfer");
  assert.ok(Number(sourceBalance) >= 0, "Source account balance became negative");
  assert.ok(Number(destinationBalance) >= 0, "Destination account balance became negative");
});
