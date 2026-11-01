# Personal Finance Tracker — Technical Design

Source of truth: `docs/PROJECT_SPEC.md`. This document defines a modular monolith and does not expand product scope.

## 1. Technology Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| Auth | Supabase Authentication (email/password) |
| Database | Supabase PostgreSQL |
| Data access | `@supabase/supabase-js` and `@supabase/ssr` |
| Validation | Zod (client + server) |
| Decimal handling | PostgreSQL `numeric` as source of truth; `decimal.js` in TS for display and non-authoritative UI math |
| Testing | Vitest (unit), Playwright (E2E), SQL/API integration tests on a dedicated test Supabase project |
| Hosting | Vercel (app) + Supabase (database/auth) |

Free tiers are sufficient for a single-user application. No Docker, microservices, Kafka, Spring Boot, or AI agents are part of the architecture.

## 2. System Architecture

### 2.1 Shape

One Next.js application deployed to Vercel, one Supabase project. Modules are separated by feature folder, not by service. No separate backend service.

```
Browser (React Server/Client Components)
        │
        ▼
Next.js on Vercel
  ├─ Server Components: read views/tables through Supabase (user session)
  ├─ Server Actions: validate input, call Postgres functions for mutations
  └─ Route Handlers: only where a server action is unsuitable
        │
        ▼
Supabase
  ├─ Auth (JWT / cookies)
  ├─ PostgreSQL (tables, views, RLS, RPC functions)
  └─ Row Level Security enforced for every request
```

### 2.2 Frontend and server-side operations

- **Server Components** render dashboards, lists, and reports by querying Supabase with the authenticated user's session. Aggregations for reports are done in SQL where possible so monetary math stays in PostgreSQL.
- **Server Actions** handle all writes: create account, post income/expense/transfer, reverse transaction, add savings allocation.
- **Client Components** are limited to interactive UI (forms, filters, charts) and receive already-computed values from the server.
- Client-side Zod validation improves UX only; server-side Zod validation plus database validation is authoritative.

### 2.3 Supabase Authentication

- Supabase Auth issues a session stored in cookies via `@supabase/ssr`.
- Middleware refreshes the session and redirects unauthenticated users away from app routes.
- Every server request re-resolves the user with `supabase.auth.getUser()` before any financial operation. The user ID from the session is never accepted from client input.

### 2.4 Communication with Supabase

- **Reads:** server-side Supabase client bound to the request cookies; RLS filters rows automatically.
- **Writes:** server action → Zod validation → `supabase.rpc('<fn>', params)` → PostgreSQL function performs the atomic multi-row operation.
- The browser uses only the publishable/anon key. The service-role key is never sent to the browser and is not required for normal application operation.

### 2.5 Where financial logic executes

| Concern | Location |
| --- | --- |
| Input shape and field-level checks | Zod in server action |
| Ownership checks | Postgres function (`auth.uid()` + row checks) |
| Atomic balance effects | Postgres functions (single transaction) |
| Balance and total calculations | SQL views / queries; PostgreSQL `numeric` |
| Presentation formatting | TS with `decimal.js`, display only |

PostgreSQL functions are the final authority for any operation that touches more than one row. TypeScript must not compute or persist balances.

### 2.6 Deployment

Vercel hosts the Next.js app. Supabase hosts database and auth. Environment variables distinguish local, preview, and production. Database changes are applied through versioned SQL migrations managed by the Supabase CLI. No service-role key is configured in Vercel for the client bundle.

## 3. Application Folder Structure

```
app/
  (auth)/
    login/page.tsx
  (app)/
    layout.tsx                 # authenticated shell + navigation
    dashboard/page.tsx
    accounts/
      page.tsx
      new/page.tsx
      [id]/edit/page.tsx
    income/new/page.tsx
    expenses/new/page.tsx
    transfers/new/page.tsx
    transactions/
      page.tsx
      [id]/page.tsx
    goals/
      page.tsx
      new/page.tsx
      [id]/page.tsx
    reports/page.tsx
  api/                         # only if a server action is unsuitable
  layout.tsx
  globals.css

components/
  ui/                          # shadcn/ui primitives
  shared/                      # header, nav, empty states, money display
  forms/                       # shared form fields (amount, account select)

features/
  accounts/
    actions.ts                 # server actions
    queries.ts                 # server-side reads
    schemas.ts
  transactions/
    actions.ts
    queries.ts
    schemas.ts
  goals/
    actions.ts
    queries.ts
    schemas.ts
  dashboard/
    queries.ts
  reports/
    queries.ts

lib/
  supabase/
    client.ts                  # browser client
    server.ts                  # server client bound to cookies
    middleware.ts
  money.ts                     # decimal parsing/formatting (display only)
  constants.ts

middleware.ts
types/
  database.ts                  # generated Supabase types
```

Folders are created only when their feature is implemented.

## 4. Database Design

All user-owned tables carry `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`. Monetary columns use `numeric(14,2)`. Currency is `char(3)` and fixed to `PHP` at launch. Primary keys are UUIDs.

The schema is versioned in `supabase/migrations/`:

- `001_initial_schema.sql` — enums, tables, constraints, indexes, and views.
- `002_row_level_security.sql` — RLS policies and table/view/type privileges.
- `003_database_functions.sql` — integrity triggers, atomic RPCs, and default-data bootstrap.

### 4.1 Enums

- `account_type`: `bank`, `ewallet`, `cash`
- `account_status`: `active`, `archived`
- `category_type`: `income`, `expense`
- `transaction_type`: `opening_balance`, `income`, `expense`, `transfer`, `reversal`
- `savings_goal_status`: `active`, `completed`, `archived`

### 4.2 `profiles`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK, FK `auth.users(id)` ON DELETE CASCADE |
| `display_name` | `text` | NOT NULL, default `''`, length ≤ 80 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

- `id` is the Supabase Auth user ID.
- Created automatically by the `on_auth_user_created` trigger for new users; existing users are backfilled by migration 003.
- Users may read and update only their own profile.

### 4.3 `accounts`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | NOT NULL, FK `auth.users(id)` |
| `name` | `text` | NOT NULL, length 1–80 |
| `type` | `account_type` | NOT NULL |
| `currency` | `char(3)` | NOT NULL, default `'PHP'`, CHECK `= 'PHP'` |
| `status` | `account_status` | NOT NULL, default `'active'` |
| `archived_at` | `timestamptz` | NULL, consistent with `status` |
| `idempotency_key` | `text` | NOT NULL, unique per user |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

- Unique index on `(user_id, lower(btrim(name))) WHERE status = 'active'`.
- `UNIQUE (id, user_id)` exists to support same-user composite foreign keys.
- **Opening balance is not a mutable column.** It is recorded exactly once as an `opening_balance` transaction with one positive entry when the account is created. The `account_balances` view exposes it as `opening_balance`, so it is stored separately from income and cannot be counted twice.
- Archived accounts keep all history. A trigger keeps `archived_at` consistent with `status`.
- No stored balance column; see §4.9.

### 4.4 `categories`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK `auth.users(id)` |
| `name` | `text` | NOT NULL, length 1–60 |
| `category_type` | `category_type` | NOT NULL |
| `icon` | `text` | NULL, optional identifier (for example a lucide icon name) |
| `is_archived` | `boolean` | NOT NULL, default `false` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

- Unique index on `(user_id, lower(btrim(name)), category_type) WHERE is_archived = false`.
- Categories are per-user. Default categories are seeded by `handle_new_user()` at sign-up and backfilled for existing users.
- Defaults: income — Salary, Business, Gifts, Other Income; expense — Food, Transport, Bills, Shopping, Health, Entertainment, Transfer Fees, Other.

### 4.5 `transactions`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK `auth.users(id)` |
| `type` | `transaction_type` | NOT NULL |
| `transaction_date` | `date` | NOT NULL |
| `description` | `text` | NOT NULL, default `''`, length ≤ 500 |
| `category_id` | `uuid` | NULL, same-user FK `categories(id, user_id)` |
| `related_transaction_id` | `uuid` | NULL, same-user FK `transactions(id, user_id)` |
| `idempotency_key` | `text` | NOT NULL, unique per user |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

Constraints:
- `UNIQUE (user_id, idempotency_key)`.
- Expense requires a category; only income/expense may carry one.
- Reversal requires `related_transaction_id`; the RPCs also use it to link a transfer-fee expense to its transfer.
- `UNIQUE (related_transaction_id) WHERE type = 'reversal'` prevents a second reversal of the same transaction.
- The amount and account live on `transaction_entries`, not on this header. This keeps transfers double-entry and prevents header/entry drift.
- `transaction_summary` exposes a denormalized amount and source/destination accounts for reads.
- No `updated_at`: posted financial headers are immutable.

### 4.6 `transaction_entries`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK `auth.users(id)` |
| `transaction_id` | `uuid` | NOT NULL, same-user FK `transactions(id, user_id)` |
| `account_id` | `uuid` | NOT NULL, same-user FK `accounts(id, user_id)` |
| `amount` | `numeric(14,2)` | NOT NULL, CHECK `<> 0` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

- `UNIQUE (transaction_id, account_id)`.
- Indexes `(user_id, account_id)` and `(transaction_id)`.
- **Sign convention:** positive = money into that account; negative = money out.
- **Shape rules** are enforced by a deferred constraint trigger:
  - opening balance / income: exactly one positive entry.
  - expense: exactly one negative entry.
  - transfer: exactly two entries, one positive and one negative, summing to zero; the unique constraint guarantees distinct accounts.
  - reversal: entries must exactly negate the original entry set.
- Composite `(id, user_id)` foreign keys make cross-user references impossible even outside the RPCs.
- No `updated_at`: entries are append-only.

### 4.7 `savings_goals`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK `auth.users(id)` |
| `name` | `text` | NOT NULL, length 1–80 |
| `target_amount` | `numeric(14,2)` | NOT NULL, CHECK `> 0` |
| `currency` | `char(3)` | NOT NULL, default `'PHP'`, CHECK `= 'PHP'` |
| `target_date` | `date` | NULL |
| `status` | `savings_goal_status` | NOT NULL, default `'active'` |
| `archived_at` | `timestamptz` | NULL, consistent with `status` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

### 4.8 `savings_allocations`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK `auth.users(id)` |
| `goal_id` | `uuid` | NOT NULL, same-user FK `savings_goals(id, user_id)` |
| `amount` | `numeric(14,2)` | NOT NULL, CHECK `> 0` |
| `allocation_date` | `date` | NOT NULL |
| `note` | `text` | NOT NULL, default `''`, length ≤ 300 |
| `idempotency_key` | `text` | NOT NULL, unique per user |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

- Allocations are **informational earmarks only**. They never create account entries, change balances, or appear in income/expense totals.
- `savings_goal_progress` calculates allocated amount, remaining amount, and capped completion percentage in SQL.

### 4.9 Views

All views use `security_invoker = true`, so the caller's RLS applies.

- **`account_balances`** — one row per account: `opening_balance`, `balance = SUM(transaction_entries.amount)`, and `entry_count`. This is the only balance source of truth; balances are never stored.
- **`transaction_effects`** — entry-level ledger with `effective_type`: a reversal inherits its original transaction's type and category, so reports net reversals correctly. Opening balances and transfers remain excluded from income/expense.
- **`transaction_summary`** — transaction view with amount, source/destination accounts, category name, and linked transfer fee.
- **`monthly_totals`** — per-user, per-month income/expense/net totals. Transfer fees are expenses; opening balances and transfers are excluded. `transfer_net` is an integrity check and should remain zero.
- **`savings_goal_progress`** — allocated, remaining, and completion percentage for each goal.

Balances and reports are derived from the indexed entries table. At personal-usage volume, a materialized view is unnecessary.

## 5. Financial Logic

Sign convention: a positive entry adds to an account; a negative entry subtracts.

### 5.1 Opening balance

- Creating an account with initial balance `X` creates one `opening_balance` transaction with one entry `+X` for that account, in the same database transaction as the account insert.
- If `X = 0`, no opening-balance transaction is created.
- Opening-balance transactions are excluded from income and expense reports, so the money is counted exactly once in balances and never as income.
- Accounts cannot have a second opening balance; the opening balance is created only at account creation.

Example: Cash account, initial 1,000.00 → entry `+1000.00`. Cash balance = 1,000.00. Income total = 0.00.

### 5.2 Income

- One `income` transaction with one entry `+amount` on the destination account.
- Increases that account and total funds.
- No category is attached.

Example: BPI receives salary 30,000.00 → BPI entry `+30000.00`. BPI balance +30,000.00; total income +30,000.00.

### 5.3 Expenses

- One `expense` transaction with one entry `-amount` on the payment account.
- Requires `account_id` and `category_id`.
- Decreases that account and total funds; appears in expense reports.

Example: BPI, Jollibee 250.00, Food → BPI entry `-250.00`. BPI balance −250.00; expenses +250.00.

### 5.4 Transfers

Performed inside one Postgres function in a single transaction:

1. Transfer transaction (`type = 'transfer'`) with two entries:
   - source `-amount`
   - destination `+amount`
2. If `fee > 0`, a linked `expense` transaction with one entry `-fee` on the source account, category = Transfer Fees, `related_transaction_id` = transfer ID.

Atomicity: both entries (and the fee transaction, if any) commit together or not at all. Transfers never count as income or expense; only the fee is an expense, so overall funds change by exactly the fee.

Example: BPI 10,000.00, GCash 2,000.00. Transfer 1,500.00 with 15.00 fee:

- Transfer entries: BPI `-1500.00`, GCash `+1500.00`.
- Fee expense entry: BPI `-15.00`.
- Result: BPI 8,485.00, GCash 3,500.00, total funds 11,985.00 (down 15.00).
- Expenses increase by 15.00; transfer is not reported as income or expense.

### 5.5 Savings goals

- A goal has a target, optional target date, and status.
- Progress = `SUM(savings_allocations.amount)` for that goal.
- Remaining = `MAX(target_amount - allocated, 0)`.
- Completion % = `LEAST(allocated / target_amount * 100, 100)` computed in SQL/`numeric`.
- Allocations are progress records only; the money stays in the real accounts and is already counted there. This explicit choice prevents double-counting.
- Allocations never create `transactions` or `transaction_entries`, so they cannot inflate balances, income, or expenses.

### 5.6 Transaction history, editing, cancellation

- `transactions` and `transaction_entries` are append-oriented. Financial fields are **immutable** after posting; clients receive `SELECT` only on both tables and no write policy.
- **Correction:** a `reversal` transaction is created whose entries are the exact negation of the original entries. Reversing a transfer with a fee also creates a reversal for each linked fee expense atomically.
- A reversal inherits the original type and category in `transaction_effects`, so income/expense reports net correctly. It is dated on the reversal date, making the correction visible in the period it was made.
- A corrected entry is then posted as a new transaction.
- **Cancellation** is therefore a reversal, not a hard delete. Opening balances cannot be reversed (see Open Questions).
- UI must never silently overwrite or delete a posted financial row.

### 5.7 Duplicate prevention

- Every mutating financial form receives a client-generated `idempotency_key` (UUID).
- `UNIQUE (user_id, idempotency_key)` on `accounts`, `transactions`, and `savings_allocations`.
- Each RPC checks for an existing key before inserting and uses `ON CONFLICT ... DO NOTHING` plus a re-select to handle concurrent retries.
- Internal rows created by one RPC (opening balance, transfer fee, fee reversal) receive generated keys because the parent operation is already idempotent.
- On a duplicate key, the RPC returns the existing record instead of creating another.

### 5.8 Postgres functions (RPC)

Ledger-mutating functions are `SECURITY DEFINER` with a fixed `search_path`, derive the user from `auth.uid()`, and re-check ownership of every referenced row. This prevents direct PostgREST writes from bypassing atomic financial rules; RLS still governs all reads. `EXECUTE` is revoked from `public`/`anon` and granted only to `authenticated`.

- `create_account(name, type, opening_balance, idempotency_key)` — creates the account and, when opening balance > 0, its `opening_balance` transaction and entry in one transaction.
- `post_income(account_id, amount, transaction_date, description, idempotency_key, category_id default null)`
- `post_expense(account_id, category_id, amount, transaction_date, description, idempotency_key)`
- `post_transfer(source_account_id, destination_account_id, amount, fee, transaction_date, description, idempotency_key)`
- `reverse_transaction(transaction_id, transaction_date, description, idempotency_key)`
- `add_savings_allocation(goal_id, amount, allocation_date, note, idempotency_key)`

Validation inside functions: positive amounts, two-decimal precision, valid active account/category/goal ownership, distinct transfer accounts, active account status, and fee ≥ 0. Negative balances are not blocked (Open Question 7).

Non-financial metadata writes stay direct but RLS-protected: profile display name, category create/edit/archive, account name/type/archive, and goal create/edit/archive. None of these touch the ledger. Account and goal archive timestamps are kept consistent by trigger.

## 6. Security

- Supabase Authentication required for every app route; middleware redirects unauthenticated sessions to `/login`.
- RLS is enabled on `profiles`, `accounts`, `categories`, `transactions`, `transaction_entries`, `savings_goals`, and `savings_allocations`.
- Policies use `user_id = (select auth.uid())` (or `id = auth.uid()` for profiles). `SELECT` policies exist on every table; `INSERT`/`UPDATE` policies exist only for non-financial tables.
- **Ledger tables are read-only to clients:** `transactions` and `transaction_entries` have no `INSERT`/`UPDATE`/`DELETE` policy and only `SELECT` is granted. `savings_allocations` is also read-only and written through its RPC.
- `accounts` has no client `INSERT`; account creation and opening balance are atomic in `create_account`.
- Composite `(id, user_id)` foreign keys prevent a row from referencing another user's account, category, transaction, or goal even if a client supplies the UUID.
- RPCs are `SECURITY DEFINER` and explicitly check `auth.uid()` and row ownership; they never trust client-supplied user IDs or balances.
- `REVOKE ALL` is applied to `anon` on all tables/views, and type usage/function execution is granted only to `authenticated`.
- Views use `security_invoker = true`, so RLS is inherited.
- Profiles and default categories are created by the `on_auth_user_created` trigger (`handle_new_user`); existing users are backfilled without inserting financial data.
- Server actions call `supabase.auth.getUser()` and reject requests without a valid session.
- The **service-role key** is never placed in `NEXT_PUBLIC_*` variables, client code, or the Vercel frontend environment. Normal application flows do not need it.
- The anon/publishable key is safe to expose because RLS is mandatory on all user tables.
- Database is not publicly accessible outside Supabase's API; direct Postgres access is restricted to the project owner.
- Sign-ups are disabled after the single owner account exists (exact policy in Open Questions). Additional authenticated users would see no rows due to RLS, but sign-ups should still be closed.
- Financial writes only occur through validated server actions and the RPC functions; no client-side balance writes.
- `updated_at` is enforced by triggers on editable rows (profiles, accounts, categories, goals).

## 7. Testing Strategy

### 7.1 Unit tests (Vitest)

- Money parsing/formatting: `"1,234.50"`, zero, negative, invalid precision; `decimal.js` used for display.
- Zod schemas: amount > 0, required account/category, transfer source ≠ destination, date validity.
- Report aggregation helpers that do not touch the database (labels, percentages, chart shaping).
- Verify no calculation helper uses raw `number` arithmetic for authoritative totals; UI math uses `Decimal`.

### 7.2 Database/API integration tests (dedicated test Supabase project)

Each test creates its own user and asserts both balances and transaction records.

- **Account creation:** creates account; opening balance appears once; opening balance excluded from income.
- **Income:** destination balance and total income increase by exact amount.
- **Expense:** account balance decreases; category required; expense totals increase.
- **Transfer:** both balances change by exact amount; overall funds unchanged when fee = 0; atomicity checked by forcing an error on the second entry (no partial commit).
- **Transfer with fee:** overall funds decrease by fee only; transfer excluded from income/expense; fee appears as expense.
- **Savings goal:** progress = sum of allocations; remaining and percentage correct at 0%, partial, and > 100% (capped display).
- **Reversal:** reversal entries negate originals; net balance returns to pre-transaction value; original remains visible.
- **Transfer reversal:** reversing a transfer with a fee also reverses the fee expense; balances and expense totals return to pre-transfer values.
- **Savings allocation isolation:** an allocation changes goal progress but leaves every account balance and income/expense total unchanged.
- **Ledger shape:** a transfer with one entry or unequal entries is rejected by the deferred constraint trigger; duplicate accounts in one transaction are rejected by the unique constraint.
- **Same-user references:** a transaction cannot reference another user's category/account even when written directly.
- **Direct ledger write denial:** authenticated clients cannot `INSERT`/`UPDATE`/`DELETE` transactions or entries.
- **Idempotency:** submitting the same key twice creates one transaction and returns the same result.
- **Archived account:** excluded from active totals; historical transactions still visible and account filterable; new postings are rejected.
- **Decimal correctness:** sums of many `numeric` values are exact (e.g., 0.10 × 3 = 0.30; no 0.30000000000000004).
- **RLS:** user B cannot `SELECT`, `INSERT`, `UPDATE`, or `DELETE` user A's rows; RPC calls with A's account IDs fail for B.
- **Unauthenticated access:** API/RPC calls without a valid JWT are rejected.

### 7.3 End-to-end (Playwright)

- Login and redirect protection.
- Create account → dashboard shows opening balance once.
- Add income and expense → dashboard and transaction list update.
- Transfer with fee → both accounts and expense report correct.
- Filter/search transactions and open details.
- Create goal, add allocation, see progress.
- Browser tests run against a test deployment/project, not production data.

### 7.4 Financial regression suite

Keep a small fixed dataset with expected values (balances, income, expenses, category totals) and assert after every schema or logic change. Any change to financial functions requires this suite to pass.

## 8. Deployment

- **Vercel:** production and preview deployments from the repository. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No service-role key.
- **Supabase:** one production project; SQL changes applied as versioned migrations via the Supabase CLI. Apply `001_initial_schema.sql`, then `002_row_level_security.sql`, then `003_database_functions.sql`; RLS is enabled before any application traffic uses the tables. Migrations are not applied automatically by the app.
- **Auth config:** set Site URL and redirect URLs to the Vercel domain; disable public sign-ups per the chosen policy.
- **Backups:** rely on Supabase backups for the plan tier; export a manual backup before destructive migration reviews.
- **Monitoring:** Supabase logs for failed auth/queries and Vercel runtime logs for server action errors.
- **Free tier:** adequate for single-user traffic; no caching/queueing infrastructure is introduced.

## 9. Open Questions

Carried from the spec:

1. **Sign-up policy:** fully disable sign-ups, or allow only a specific email? (Recommended: create the owner account, then disable sign-ups.)
2. **Savings allocations:** resolved for now — informational only; they never move real money between accounts.
3. **Savings funding source:** not applicable while allocations are informational.
4. **Transfer fees:** resolved — a default `Transfer Fees` expense category is used; the transfer RPC creates it if missing.
5. **Expense categories:** resolved — per-user categories with seeded defaults; users can add and archive categories.
6. **Transaction corrections:** resolved — reversal plus repost; no in-place editing of posted financial rows.
7. **Negative balances:** block operations that would make an account negative, or allow it? (This design does not add a non-negative constraint until decided.)
8. **Credit accounts:** only asset accounts for MVP, or are credit/liability accounts needed?
9. **Date semantics:** user-entered `transaction_date` only (this design), or also a recorded time for ordering? Ordering currently uses `created_at` as tiebreaker.
10. **Reporting periods:** current month with optional range selection, or fixed monthly views only?

New questions introduced by this design:

11. **Metadata edits:** posted transaction descriptions are immutable in this schema; decide whether a future audit-trailed edit flow is needed.
12. **Account archiving with nonzero balance:** the current RLS update path allows archiving regardless of balance. Confirm whether a transfer-out should be required first.
13. **Default categories:** resolved — income: Salary, Business, Gifts, Other Income; expense: Food, Transport, Bills, Shopping, Health, Entertainment, Transfer Fees, Other.
14. **Deletion:** resolved — financial rows are append-only; use archive/reversal, never hard delete.
15. **Savings allocation corrections:** allocations are append-only with no update/delete policy. Decide whether reversals or edits are needed.
16. **Opening balance corrections:** opening balances are immutable and cannot be reversed. Decide whether a controlled correction RPC is needed instead of recreating the account.
