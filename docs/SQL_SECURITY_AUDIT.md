# TIGOM SQL Security and Financial Integrity Audit

**Overall: FAIL** — the migrations contain a critical exposed helper and financial-integrity gaps. Do not apply these migrations to Supabase until the critical/high findings are corrected and re-reviewed.

This review covers the SQL implementation in `supabase/migrations/001_initial_schema.sql`, `002_row_level_security.sql`, and `003_database_functions.sql`. It did not connect to Supabase or apply SQL. The PGlite validation run exercised a single connection; it does not establish PostgreSQL multi-session concurrency safety. Supabase concurrency tests were not run.

## Findings

### Critical — public callable SECURITY DEFINER balance assertion

- **Affected:** `003_database_functions.sql`, `assert_balance_not_negative(uuid, uuid, numeric, text)` and `current_account_balance(uuid, uuid)`.
- **Issue:** The functions are `SECURITY DEFINER`, accept an arbitrary caller-supplied `p_user_id`, and are not restricted to the authenticated caller. `assert_balance_not_negative` is omitted from the function privilege revoke/grant list. PostgreSQL grants function EXECUTE to `PUBLIC` by default, so `anon`/`authenticated` can call it with arbitrary user/account IDs. It discloses account balances through its error and can be called directly; its nested `current_account_balance` is also definer-owned. The explicit revoke on `current_account_balance` does not prevent invocation through the exposed definer function.
- **Why it matters:** This creates an unauthenticated cross-user balance oracle and violates least privilege for a privileged helper.
- **Recommended correction:** Revoke EXECUTE on both helpers from `PUBLIC`, `anon`, and `authenticated`; grant only to the owning database role as needed for nested calls. Or remove `SECURITY DEFINER` from helpers and invoke them only from owner-checked RPCs. Derive/check `auth.uid()` inside any callable helper; never accept an arbitrary user ID from a client.

### High — security-definer search paths trust writable `public`

- **Affected:** All `SECURITY DEFINER` functions in `003_database_functions.sql` (for example `post_expense`, `post_transfer`, `reverse_transaction`, `handle_new_user`).
- **Issue:** `SET search_path = public, pg_temp` places `public` before `pg_temp`. The migrations do not revoke `CREATE` on `public` from `PUBLIC` or application roles. In a standard Supabase setup, schema CREATE grants must not be assumed safe. If an untrusted role can create objects there, unqualified built-ins/helpers/operators or relation references in a definer function may be shadowed.
- **Why it matters:** A writable schema in a privileged function's search path can enable privilege escalation. Most table names are explicitly `public.` qualified, but not all built-ins/operators are schema-qualified and future edits can introduce an exploitable resolution.
- **Recommended correction:** Revoke `CREATE` on `public` from `PUBLIC`, `anon`, and `authenticated`; use a locked-down dedicated schema and a minimal trusted search path (e.g. `pg_catalog, trusted_schema`). Schema-qualify referenced functions and types. Verify actual function owners and schema grants in the target Supabase project before deployment.

### High — concurrent reversals can violate non-negative balances

- **Affected:** `003_database_functions.sql`, `reverse_transaction(uuid, timestamptz, text, text)`.
- **Issue:** The RPC locks affected account rows and checks balances, but does not lock the original transaction row or reserve/claim its reversal before the check. Two sessions reversing the same original can both pass the initial `NOT EXISTS` check and balance validation. One may insert/commit; the other can then hit the partial unique index after having checked against a balance that did not include the first reversal. Under `READ COMMITTED`, this can make the reversal path fail safely in some schedules, but the function's check is not serialized on the reversal target and its outcome is not proven. Transfer-fee reversal rows add a second race surface.
- **Why it matters:** The design relies on preventing any resulting negative balance. A race around the unique reversal constraint can invalidate that guarantee or produce avoidable late failures.
- **Recommended correction:** Lock the original transaction row (`FOR UPDATE`) before checking reversal state, then acquire all affected account locks in deterministic order and calculate/revalidate. Ensure linked fee reversals are covered by the same serialization strategy. Prove using multi-session Supabase PostgreSQL tests.

### High — account metadata update privileges allow identity/history mutation

- **Affected:** `002_row_level_security.sql`, `accounts_update_own`; `003_database_functions.sql`, `sync_archived_at`.
- **Issue:** Authenticated users have table-level `UPDATE` on `accounts`, and the row policy only checks ownership. It permits changing `user_id` is blocked by the policy check, but also permits changing `type`, `currency`, `idempotency_key`, and `created_at` as well as name/status. In particular changing account type can rewrite historical interpretation, and changing the idempotency key undermines retry history. There is no column-level restriction.
- **Why it matters:** A supposedly non-financial metadata path can alter durable account identity and metadata associated with financial history.
- **Recommended correction:** Grant UPDATE only on intended columns (e.g. name/status) and enforce allowed transitions. Keep type/currency/idempotency/created_at immutable after creation; consider an RPC for archive/unarchive.

### High — signed balance adjustment accepts positive balances without audit reason

- **Affected:** `003_database_functions.sql`, `adjust_account_balance(uuid, numeric, timestamptz, text, text)`.
- **Issue:** The reason is optional and is stored as a generic default when empty. More importantly this RPC can create arbitrary positive balance adjustments, functioning as a synthetic deposit while not appearing as income. The migration has no constraint requiring a substantive reason or separate adjustment classification.
- **Why it matters:** It can conceal real income or correction rationale and weakens the meaning of reports/audit history. It also becomes the documented escape path for reversals that would overdraw.
- **Recommended correction:** Require a non-empty reason and preserve it explicitly; restrict this RPC to the intended owner/administrative workflow; document/label adjustments distinctly in all reads. For genuine deposits require `post_income`, never an adjustment.

### High — row locking does not prove safety against direct owner-level SQL writers

- **Affected:** `003_database_functions.sql`, balance-changing RPCs and ledger constraints.
- **Issue:** RPCs use account-row locks to serialize cooperating RPC calls, which is a sound pattern. The schema itself does not enforce a non-negative balance invariant for ledger entries, and the trigger validates ledger shape but not aggregate account balance. A privileged database role, service-role path, or future function that writes entries directly can bypass the RPC balance check.
- **Why it matters:** The negative-balance invariant depends entirely on every write path honoring the locking convention.
- **Recommended correction:** Keep direct application writes revoked, audit every privileged writer, and add a database-enforced mechanism if privileged direct writers are in scope. Keep service-role credentials server-only. Test concurrency with genuinely separate database sessions.

### Medium — savings allocation audit ordering can race across idempotency keys

- **Affected:** `003_database_functions.sql`, `adjust_savings_allocation(uuid, numeric, date, text, text)`.
- **Issue:** The allocation row is locked before summing existing adjustments, so different-key adjustments to the same allocation serialize correctly. However an idempotency key reused concurrently for different allocation IDs can race: the losing insert may hit the unique constraint, then reselect and return the existing adjustment for a different allocation without checking that it matches the requested payload.
- **Why it matters:** A retry with a reused key can appear successful while correcting a different allocation than requested; similar idempotency behavior exists in several financial RPCs because keys are returned without comparing payloads.
- **Recommended correction:** Store a request fingerprint or compare all immutable operation parameters on key reuse; raise an idempotency conflict when the same key is used with a different payload.

### Medium — opening-balance audit records use transaction timestamp semantics

- **Affected:** `001_initial_schema.sql`, `account_opening_balance_changes`; `003_database_functions.sql`, `create_account` and `update_opening_balance`.
- **Issue:** `changed_at` defaults to `now()`, which in PostgreSQL is the transaction start timestamp, not the exact statement time. The field is described as the change timestamp. In a long transaction, it may materially predate the update.
- **Why it matters:** Audit ordering/time can be misleading for changes made inside long-running transactions.
- **Recommended correction:** Use `clock_timestamp()` for the audit event timestamp (or explicitly document transaction-start semantics). Consider recording the authenticated actor explicitly if future service-role callers are possible.

### Medium — opening-balance correction deletes the original ledger row

- **Affected:** `003_database_functions.sql`, `update_opening_balance(uuid, numeric)`.
- **Issue:** When set to zero, the function deletes the original opening entry and transaction. The separate audit row preserves previous/new amounts, but the original ledger transaction identity, description, and created timestamp are discarded.
- **Why it matters:** This is less complete than an append-only financial history and prevents transaction-level tracing of the original opening event.
- **Recommended correction:** Prefer an append-only correction entry/event or retain the opening transaction and represent its current effective amount through auditable adjustment rows. If keeping deletion, document that the separate audit table is the authoritative history and test its immutability.

### Medium — client can edit savings goal target and status without correction history

- **Affected:** `002_row_level_security.sql`, `savings_goals_update_own`; `001_initial_schema.sql`, `savings_goals`.
- **Issue:** Direct UPDATE on the whole row permits changing target amount, currency (fixed by check), name, target date, status and creation metadata. Goal target changes alter computed progress percentage/remaining amount without a version/audit record.
- **Why it matters:** Historical goal progress is not reproducible after target edits, despite allocation adjustments being auditable.
- **Recommended correction:** Restrict writable columns, make `created_at` immutable, and decide whether target changes need an append-only goal-change audit or should be immutable after allocations exist.

### Medium — opening balance can be edited concurrently with financial activity

- **Affected:** `003_database_functions.sql`, `update_opening_balance(uuid, numeric)` and `post_income` / `post_expense` / `post_transfer`.
- **Issue:** `update_opening_balance` locks the account row; income and expense RPCs lock their account rows, and transfer locks both. Therefore the current RPC paths serialize. The function then checks for non-opening entries after acquiring the lock, which is appropriate. However direct privileged ledger writers are not covered by that lock protocol (see High finding above).
- **Why it matters:** Any alternative writer can race between the “no activity” check and opening-entry update/delete.
- **Recommended correction:** Ensure all privileged write paths take the same account lock; consider database-level trigger enforcement or a single controlled write API.

### Medium — transfer fee category creation can fail if archived category name is reserved

- **Affected:** `003_database_functions.sql`, `post_transfer`; `001_initial_schema.sql`, `categories_user_active_name_type_uidx`.
- **Issue:** If a user archives their `Transfer Fees` category, the RPC looks only for an active category and tries to insert another. The partial unique index allows this, so it succeeds; this is not a security defect but can create multiple archived categories and ambiguous historic presentation. If some future uniqueness rule changes, the exception handler may reselect no active row and leave a null category.
- **Why it matters:** Fee classification and old report labels can become inconsistent.
- **Recommended correction:** Treat the fee category as a protected system category that cannot be archived/renamed, or explicitly restore/reuse a canonical category under a locked uniqueness strategy.

### Low — transaction-entry immutability is policy-based, not trigger-enforced

- **Affected:** `001_initial_schema.sql`, `transactions` / `transaction_entries`; `003_database_functions.sql`, validation triggers.
- **Issue:** RLS and grants prevent authenticated client updates/deletes, but trigger validation allows updating an entry amount or transaction metadata if performed by a privileged writer. `update_opening_balance` intentionally updates the opening entry. Other ledger updates are not categorically rejected by a mutation guard.
- **Why it matters:** Future definer functions or service-role code could silently rewrite posted history.
- **Recommended correction:** Add mutation guards that reject ledger updates/deletes except through narrowly scoped opening-balance correction logic; keep every intentional exception auditable.

### Low — table/sequence/schema privileges are not fully established by these files

- **Affected:** `002_row_level_security.sql`, all tables/views; migration grants.
- **Issue:** The migration revokes table privileges from `anon` and `authenticated`, but does not explicitly establish schema `USAGE`, revoke `CREATE` on `public`, or cover default privileges for future objects. Whether Supabase defaults supply safe values must be verified rather than assumed.
- **Why it matters:** Effective security depends on project-level grants and future migration behavior.
- **Recommended correction:** Explicitly set schema and default privileges in migrations; inspect effective grants for `anon`, `authenticated`, `service_role`, and function owners in a test project.

### Informational — no service-role exposure found in SQL migrations

- **Affected:** All migration files.
- **Issue:** The SQL contains no service-role secret or frontend configuration. These migrations alone cannot establish whether application environment variables or deployment settings expose one.
- **Why it matters:** Service-role keys bypass RLS when used by clients.
- **Recommended correction:** Keep the service-role key server-only, never `NEXT_PUBLIC_*`, and audit application/deployment configuration separately.

## Control review

| Area | Result | Notes |
| --- | --- | --- |
| RLS enabled on all user tables | PASS WITH LIMITATIONS | `002` enables RLS on all nine tables. Policies are owner-scoped for reads and permitted writes. Actual access still depends on effective schema/function privileges. |
| Cross-user related references | PASS | Composite `(id, user_id)` FKs cover transactions, entries, categories, accounts, goals, allocations, and opening audit rows. |
| Direct financial writes | PASS WITH LIMITATIONS | Authenticated has SELECT-only on ledger/audit tables. Definer helper exposure and privileged-writer concerns are detailed above. |
| NUMERIC money | PASS | Monetary ledger, target, allocation, and audit amounts use `numeric(14,2)`; function inputs are numeric and validated. |
| Expense balance checks | PASS WITH LIMITATIONS | Expense RPC locks account and checks derived balance. No aggregate DB constraint protects uncooperative privileged writers. |
| Transfer atomicity / fee / distinct accounts | PASS | One function call inserts transfer and fee rows in one PostgreSQL transaction; amount positive, fee nonnegative, same-account transfer rejected, source checked for amount + fee. |
| Reporting exclusions | PASS | Monthly view groups on transaction date in Asia/Manila; transfers, opening balances, adjustments, and savings allocations do not count as income/expense. |
| Opening balance not double-counted | PASS WITH LIMITATIONS | Opening entry contributes to balance and is not an income/expense effect. Corrections are separately audited; zeroing deletes the original ledger row. |
| Savings allocations | PASS WITH LIMITATIONS | No ledger entries are created; adjustments are signed and allocation-row locked. Reused idempotency keys are not payload-bound. |
| Archived account history | PASS | Balance/report views do not exclude archived accounts; RPCs reject new ledger activity on archived accounts. |
| Concurrency | PASS WITH LIMITATIONS | Deterministic account locks and in-transaction checks are present. Concurrent Supabase tests are prepared but not run; do not claim concurrency safety proven. Reversal-target serialization needs strengthening. |
| SECURITY DEFINER | FAIL | Fixed `search_path` is set, but `public` trust/CREATE privileges are not hardened and one definer helper remains callable by default PUBLIC. |
| EXECUTE privileges | FAIL | RPCs have explicit grants; helper revocation is incomplete for `assert_balance_not_negative`. PostgreSQL default PUBLIC EXECUTE applies. |
| Function ownership | PASS WITH LIMITATIONS | Ownership is not set or verified by these migrations; target Supabase default owner must be inspected. |
| Auth configuration | PASS WITH LIMITATIONS | Sign-up disabling is documented as deployment configuration, not applied by SQL. |

## Test status

- The PGlite script in the temporary validation directory was run earlier for the migration and single-connection logic. It does not prove multi-session concurrency.
- `supabase/tests/concurrency.test.mjs` was syntax-checked and invoked without Supabase credentials; **both tests were skipped**. No concurrency test passed.
- No live Supabase connection or migration execution was performed for this audit.

## Final category

**FAIL** — correct the Critical and High findings, then re-run security review. Multi-session concurrency tests remain required before asserting concurrency safety.
 