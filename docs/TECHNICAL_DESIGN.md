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
- TIGOM is a single-owner application. Public sign-ups are enabled only long enough to create the owner account, then disabled in Supabase Auth. Login and password recovery remain enabled. Multi-user financial sharing is not implemented.
- RLS still isolates every user, so a second account (created by an admin or before sign-ups are disabled) would see no other user's data.

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

- `account_type`: `bank`, `ewallet`, `cash`. Only asset accounts are supported at launch. Liabilities are deliberately excluded; a future migration can add enum values (for example `credit_card`, `loan`) plus the liability-specific balance and reporting rules without reshaping the ledger.
- `account_status`: `active`, `archived`
- `category_type`: `income`, `expense`
- `transaction_type`: `opening_balance`, `income`, `expense`, `transfer`, `reversal`, `balance_adjustment`
  - `balance_adjustment` is an explicit, auditable correction that changes an account balance without being income or an expense.
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
- **Opening balance is not a stored account column.** It is recorded exactly once as an `opening_balance` transaction with one positive entry when the account is created. The `account_balances` view exposes it as `opening_balance`, so it is stored separately from income and cannot be counted twice.
- Before any other financial activity exists, the opening balance can be corrected in place through `update_opening_balance`, including setting it to zero. Every accepted change writes an append-only `account_opening_balance_changes` audit row (previous value, new value, timestamp, account). Once any non-opening entry exists, the original opening balance is preserved and later corrections use `adjust_account_balance`.
- Archived accounts keep their opening balance, derived balance, and full history. They are excluded from active totals but remain available for historical reports. Archiving is allowed with a non-zero balance; archived accounts reject new ledger writes.
- A trigger keeps `archived_at` consistent with `status`.
- No stored balance column; see §4.11.

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
| `transaction_date` | `timestamptz` | NOT NULL, instant the activity occurred |
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
- No `updated_at`: posted financial headers are immutable. `created_at` is the immutable record-creation instant.
- **Date semantics:** `transaction_date` is when the financial activity occurred and is stored as `timestamptz` (UTC instant). `created_at` is when the row was written. Reporting never uses `created_at` for period boundaries.
- **Deterministic ordering:** `ORDER BY transaction_date DESC, created_at DESC, id DESC`. The index `(user_id, transaction_date DESC, created_at DESC, id DESC)` supports it.
- **Reporting timezone:** Asia/Manila (UTC+8, no daylight saving). Calendar-month boundaries are computed with `transaction_date AT TIME ZONE 'Asia/Manila'`.
- `balance_adjustment` is an explicit correction type. It has one signed entry, is excluded from income/expense totals, and cannot be reversed; an opposite adjustment is posted instead.

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
  - balance adjustment: exactly one entry, positive or negative.
  - transfer: exactly two entries, one positive and one negative, summing to zero; the unique constraint guarantees distinct accounts.
  - reversal: entries must exactly negate the original entry set. Opening balances and balance adjustments cannot be reversed.
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
- Allocations are append-only. Corrections use the `savings_allocation_adjustments` table rather than editing or deleting the original row.
- `UNIQUE (id, user_id)` supports same-user references from adjustments.

### 4.9 `savings_allocation_adjustments`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK `auth.users(id)` |
| `allocation_id` | `uuid` | NOT NULL, same-user FK `savings_allocations(id, user_id)` |
| `amount` | `numeric(14,2)` | NOT NULL, CHECK `<> 0`, signed |
| `adjustment_date` | `date` | NOT NULL |
| `note` | `text` | NOT NULL, default `''`, length ≤ 300 |
| `idempotency_key` | `text` | NOT NULL, unique per user |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

- Positive adjustments increase the effective allocation; negative adjustments reduce it.
- The effective allocation is `original amount + SUM(adjustments)` and can never go below zero.
- Adjustments never change account balances and never appear in income or expense totals.
- `savings_allocation_effective` exposes original, adjustment, and effective amounts; `savings_goal_progress` aggregates effective amounts.

### 4.10 `account_opening_balance_changes`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK `auth.users(id)` |
| `account_id` | `uuid` | NOT NULL, same-user FK `accounts(id, user_id)` |
| `previous_amount` | `numeric(14,2)` | NOT NULL, CHECK `>= 0` |
| `new_amount` | `numeric(14,2)` | NOT NULL, CHECK `>= 0` |
| `changed_at` | `timestamptz` | NOT NULL, default `now()` |

- Append-only audit of opening-balance edits. Rows are written only by `create_account` and `update_opening_balance`.
- `previous_amount <> new_amount`; a no-op setter call writes no row.
- The audit row is retained even when the opening balance is set to zero and the zero-value opening ledger entry is removed.
- Clients receive `SELECT` only; no update or delete policy.
- The initial opening balance is recorded as `0.00 → opening_balance`.

### 4.11 Views

All views use `security_invoker = true`, so the caller's RLS applies.

- **`account_balances`** — one row per account: `opening_balance`, `balance_adjustments`, `balance = SUM(transaction_entries.amount)`, and `entry_count`. This is the only balance source of truth; balances are never stored.
- **`transaction_effects`** — entry-level ledger with `effective_type`: a reversal inherits its original transaction's type and category, so reports net reversals correctly. Opening balances, transfers, and balance adjustments remain excluded from income/expense.
- **`transaction_summary`** — transaction view with amount, source/destination accounts, category name, and linked transfer fee.
- **`monthly_totals`** — per-user calendar-month income/expense/net totals grouped in Asia/Manila using `transaction_date`. Transfer fees are expenses; opening balances, transfers, and balance adjustments are excluded. `transfer_net` is an integrity check and should remain zero.
- **`savings_allocation_effective`** — original amount, adjustment total, and effective amount for each allocation.
- **`savings_goal_progress`** — effective allocated amount, remaining, and completion percentage for each goal.

Balances and reports are derived from the indexed entries table. At personal-usage volume, a materialized view is unnecessary.

## 5. Financial Logic

Sign convention: a positive entry adds to an account; a negative entry subtracts.

### 5.1 Opening balance

- Creating an account with initial balance `X` creates one `opening_balance` transaction with one entry `+X` for that account, in the same database transaction as the account insert.
- If `X = 0`, no opening-balance transaction is created.
- Opening-balance transactions are excluded from income and expense reports, so the money is counted exactly once in balances and never as income.
- Accounts cannot have a second opening balance. While the account has no non-opening entries, `update_opening_balance` may edit the single opening entry (or remove it when set to zero).
- Every accepted opening-balance change is recorded in `account_opening_balance_changes` with the account, previous amount, new amount, and timestamp. The audit row is never updated or deleted.
- Setting the opening balance to zero removes the zero-value opening ledger entry but keeps the audit history showing the previous amount and the change to zero.
- Once financial activity exists, the opening balance is immutable. Corrections use `adjust_account_balance`, which posts a separate `balance_adjustment` transaction so the original opening balance remains visible.
- `balance_adjustment` entries change the derived balance but are never income or expenses.

Example: Cash account, initial 1,000.00 → entry `+1000.00` and audit `0.00 → 1000.00`. Cash balance = 1,000.00. Income total = 0.00. Later correction `+50.00` → `balance_adjustments = 50.00`, `balance = 1050.00`, income total still 0.00.

### 5.2 Income

- One `income` transaction with one entry `+amount` on the destination account.
- Increases that account and total funds.
- An optional income category may be attached; it is validated as an active income category owned by the user.

Example: BPI receives salary 30,000.00 → BPI entry `+30000.00`. BPI balance +30,000.00; total income +30,000.00.

### 5.3 Expenses

- One `expense` transaction with one entry `-amount` on the payment account.
- Requires `account_id` and `category_id`.
- Decreases that account and total funds; appears in expense reports.
- The account row is locked and the derived balance is checked in the same transaction. An expense that would make the account negative is rejected with `insufficient funds`.

Example: BPI 1,000.00, Jollibee 250.00, Food → BPI entry `-250.00`. BPI balance 750.00; expenses +250.00. A 2,000.00 expense is rejected.

### 5.4 Transfers

Performed inside one Postgres function in a single transaction:

1. Transfer transaction (`type = 'transfer'`) with two entries:
   - source `-amount`
   - destination `+amount`
2. If `fee > 0`, a linked `expense` transaction with one entry `-fee` on the source account, category = Transfer Fees, `related_transaction_id` = transfer ID.

Atomicity: both entries (and the fee transaction, if any) commit together or not at all. Transfers never count as income or expense; only the fee is an expense, so overall funds change by exactly the fee.

Concurrency and sufficiency: the RPC locks both account rows in deterministic ID order (avoiding deadlocks) and checks `source balance >= amount + fee` before writing. Concurrent expenses, transfers, reversals, and downward adjustments on the same accounts serialize on those row locks, so they cannot both pass the check against a stale balance.

Example: BPI 10,000.00, GCash 2,000.00. Transfer 1,500.00 with 15.00 fee:

- Transfer entries: BPI `-1500.00`, GCash `+1500.00`.
- Fee expense entry: BPI `-15.00`.
- Result: BPI 8,485.00, GCash 3,500.00, total funds 11,985.00 (down 15.00).
- Expenses increase by 15.00; transfer is not reported as income or expense.

### 5.5 Savings goals

- A goal has a target, optional target date, and status.
- Effective allocation = original allocation + `SUM(savings_allocation_adjustments.amount)`.
- Progress = `SUM(effective allocation)` for that goal.
- Remaining = `MAX(target_amount - allocated, 0)`.
- Completion % = `LEAST(allocated / target_amount * 100, 100)` computed in SQL/`numeric`.
- Allocations are progress records only; the money stays in the real accounts and is already counted there. This explicit choice prevents double-counting.
- Allocations never create `transactions` or `transaction_entries`, so they cannot inflate balances, income, or expenses.
- **Corrections:** the original allocation is never edited or deleted. `adjust_savings_allocation` appends a signed adjustment, locks the allocation row, and rejects a reduction that would make the effective amount negative. Each adjustment keeps its own date, note, creator, and idempotency key, so the history is auditable.
- Adjustments remain possible after a goal is archived, because they correct historical goal progress rather than account balances.

### 5.6 Transaction history, editing, cancellation

- `transactions` and `transaction_entries` are append-oriented. Financial fields are **immutable** after posting; clients receive `SELECT` only on both tables and no write policy.
- **Correction:** a `reversal` transaction is created whose entries are the exact negation of the original entries. Reversing a transfer with a fee also creates a reversal for each linked fee expense atomically.
- A reversal inherits the original type and category in `transaction_effects`, so income/expense reports net correctly. It is dated on the reversal date, making the correction visible in the period it was made.
- A reversal is rejected if any negative entry it would create would make an account negative. Accounts touched by the reversal are locked in ID order before the check. The error states the available and required amounts and directs the user to post a real deposit or an explicit balance adjustment first.
- A corrected entry is then posted as a new transaction.
- **Cancellation** is therefore a reversal, not a hard delete. Opening balances cannot be reversed; use `update_opening_balance` before activity or `adjust_account_balance` after activity.
- Balance adjustments cannot be reversed; post the opposite adjustment so the correction remains explicit.
- The only in-place financial edit is the opening-balance entry, and only while no other financial activity exists.
- **Historical correction process:** if a reversal would overdraw an account, first record the real funds movement (genuine income/deposit) or an explicit `balance_adjustment` with a reason, then reverse the original transaction. Do not fabricate income or a deposit to bypass the balance rule. Both the adjustment and the reversal remain in the audit trail.
- Posted transaction descriptions and metadata are immutable in this initial version. There is no general-purpose transaction editing; corrections must use reversal or balance adjustment.
- UI must never silently overwrite or delete a posted financial row.

### 5.7 Duplicate prevention

- Every mutating financial form receives a client-generated `idempotency_key` (UUID).
- `UNIQUE (user_id, idempotency_key)` on `accounts`, `transactions`, `savings_allocations`, and `savings_allocation_adjustments`.
- Each RPC checks for an existing key before inserting and uses `ON CONFLICT ... DO NOTHING` plus a re-select to handle concurrent retries.
- Internal rows created by one RPC (opening balance, transfer fee, fee reversal) receive generated keys because the parent operation is already idempotent.
- `update_opening_balance` is a setter, not a repeatable event, so it is naturally idempotent and does not require a key.
- On a duplicate key, the RPC returns the existing record instead of creating another.

### 5.8 Postgres functions (RPC)

Ledger-mutating functions are `SECURITY DEFINER` with a fixed `search_path`, derive the user from `auth.uid()`, and re-check ownership of every referenced row. This prevents direct PostgREST writes from bypassing atomic financial rules; RLS still governs all reads. `EXECUTE` is revoked from `public`/`anon` and granted only to `authenticated`.

- `create_account(name, type, opening_balance, idempotency_key)` — creates the account and, when opening balance > 0, its `opening_balance` transaction and entry in one transaction.
- `update_opening_balance(account_id, amount)` — setter for the single opening entry; allowed only while no non-opening entry exists. Setting zero removes the opening transaction.
- `adjust_account_balance(account_id, amount, effective_date, reason, idempotency_key)` — posts a signed `balance_adjustment` transaction. Excluded from income/expense and cannot be reversed.
- `post_income(account_id, amount, transaction_date, description, idempotency_key, category_id default null)`
- `post_expense(account_id, category_id, amount, transaction_date, description, idempotency_key)`
- `post_transfer(source_account_id, destination_account_id, amount, fee, transaction_date, description, idempotency_key)`
- `reverse_transaction(transaction_id, transaction_date, description, idempotency_key)`
- `add_savings_allocation(goal_id, amount, allocation_date, note, idempotency_key)`
- `adjust_savings_allocation(allocation_id, amount, adjustment_date, note, idempotency_key)` — signed append-only allocation correction.

`transaction_date` and `effective_date` are `timestamptz`; savings dates remain `date` because they are informational only.

Validation inside functions: signed or positive amounts as appropriate, two-decimal precision, valid active account/category/goal ownership, distinct transfer accounts, active account status, fee ≥ 0, non-negative resulting balances for expenses, transfers, reversals, and downward adjustments, and an effective allocation never below zero. Every balance-changing function locks the affected account rows in deterministic ID order before checking balances, so concurrent requests cannot bypass the check.

Non-financial metadata writes stay direct but RLS-protected: profile display name, category create/edit/archive, account name/type/archive, and goal create/edit/archive. None of these touch the ledger. Account and goal archive timestamps are kept consistent by trigger. Archived accounts reject all ledger RPCs, including adjustments; their history remains readable.

## 6. Security

- Supabase Authentication required for every app route; middleware redirects unauthenticated sessions to `/login`.
- RLS is enabled on `profiles`, `accounts`, `account_opening_balance_changes`, `categories`, `transactions`, `transaction_entries`, `savings_goals`, `savings_allocations`, and `savings_allocation_adjustments`.
- Policies use `user_id = (select auth.uid())` (or `id = auth.uid()` for profiles). `SELECT` policies exist on every table; `INSERT`/`UPDATE` policies exist only for non-financial tables.
- **Ledger tables are read-only to clients:** `transactions` and `transaction_entries` have no `INSERT`/`UPDATE`/`DELETE` policy and only `SELECT` is granted. `savings_allocations`, `savings_allocation_adjustments`, and `account_opening_balance_changes` are also read-only and written through their RPCs.
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
- Public sign-ups are disabled in Supabase Auth immediately after the owner account is created. Login and password recovery stay enabled. No user-invite or sharing flow is implemented.
- Additional authenticated users, if any were created by an administrator, see no rows due to RLS; they are not a financial sharing feature.
- Financial writes only occur through validated server actions and the RPC functions; no client-side balance writes.
- Archived accounts are read-only for the ledger: `post_income`, `post_expense`, `post_transfer`, `reverse_transaction`, `adjust_account_balance`, and `update_opening_balance` reject non-active accounts. Accounts with history are never deleted (no client DELETE policy, and foreign keys use `ON DELETE NO ACTION`).
- `updated_at` is enforced by triggers on editable rows (profiles, accounts, categories, goals). Ledger headers, entries, allocations, and allocation adjustments are immutable and have no `updated_at`.

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
- **Insufficient funds:** an expense larger than the derived balance is rejected; the balance and totals are unchanged.
- **Transfer:** both balances change by exact amount; overall funds unchanged when fee = 0; atomicity checked by forcing an error on the second entry (no partial commit).
- **Transfer with fee:** overall funds decrease by fee only; transfer excluded from income/expense; fee appears as expense.
- **Transfer sufficiency:** a transfer is rejected when `amount + fee` exceeds the source balance; a transfer exactly equal to the balance succeeds.
- **Concurrent balance checks:** two concurrent expenses or transfers against the same source cannot both commit if their sum exceeds the balance; the loser receives insufficient-funds. The prepared test is `supabase/tests/concurrency.test.mjs`, run against a dedicated Supabase test project with `node --test supabase/tests/concurrency.test.mjs`. It uses two independent HTTP sessions and is **not yet executed**; PGlite single-connection tests cannot prove multi-session safety.
- **Savings goal:** progress = sum of effective allocations; remaining and percentage correct at 0%, partial, and > 100% (capped display).
- **Allocation adjustments:** a negative adjustment reduces progress; the original allocation row is unchanged; an adjustment that would make the effective amount negative is rejected; adjustments never alter account balances.
- **Opening balance edit:** before activity, `update_opening_balance` updates or removes the opening entry and appends an audit row with previous and new values; after activity it is rejected, the original opening entry is unchanged, and no audit row is written.
- **Balance adjustment:** a signed `balance_adjustment` changes the derived balance and `balance_adjustments`; income/expense totals are unchanged; a downward adjustment below zero is rejected; the adjustment cannot be reversed.
- **Reversal:** reversal entries negate originals; net balance returns to pre-transaction value; original remains visible; a reversal that would overdraw is rejected.
- **Transfer reversal:** reversing a transfer with a fee also reverses the fee expense; balances and expense totals return to pre-transfer values.
- **Savings allocation isolation:** an allocation changes goal progress but leaves every account balance and income/expense total unchanged.
- **Ledger shape:** a transfer with one entry or unequal entries is rejected by the deferred constraint trigger; duplicate accounts in one transaction are rejected by the unique constraint.
- **Same-user references:** a transaction cannot reference another user's category/account even when written directly.
- **Direct ledger write denial:** authenticated clients cannot `INSERT`/`UPDATE`/`DELETE` transactions or entries.
- **Idempotency:** submitting the same key twice creates one transaction and returns the same result.
- **Archived account:** can be archived with a non-zero derived balance; balance and history are preserved and visible in historical reports; new postings, opening edits, and adjustments are rejected; the account cannot be deleted while it has history.
- **Date and month boundaries:** a transaction at 2026-01-31 23:30 UTC (2026-02-01 07:30 Asia/Manila) is reported in February; ordering follows `transaction_date DESC, created_at DESC, id DESC`.
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

### 7.5 Multi-session concurrency tests (prepared, not yet executed)

`supabase/tests/concurrency.test.mjs` uses two independent HTTP/PostgREST sessions against a dedicated Supabase test project:

```
SUPABASE_URL=... SUPABASE_ANON_KEY=... TIGOM_TEST_EMAIL=... TIGOM_TEST_PASSWORD=... \
node --test supabase/tests/concurrency.test.mjs
```

- Test 1 fires two 600.00 expenses against a 1,000.00 account and requires exactly one success and a final balance of 400.00.
- Test 2 fires two 250.00 transfers with a 10.00 fee against a 500.00 source and requires exactly one success, source 240.00, destination 250.00.
- Both assert the final balances are non-negative.
- The tests create data in the configured test project and do not clean it up because financial rows are append-only. Use a disposable test project.
- These tests have **not** been executed. Do not report them as passing until they run successfully against Supabase.

## 8. Deployment

- **Vercel:** production and preview deployments from the repository. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No service-role key.
- **Supabase:** one production project; SQL changes applied as versioned migrations via the Supabase CLI. Apply `001_initial_schema.sql`, then `002_row_level_security.sql`, then `003_database_functions.sql`; RLS is enabled before any application traffic uses the tables. Migrations are not applied automatically by the app.
- **Auth config (deployment requirement, not applied yet):** set Site URL and redirect URLs to the Vercel domain. Create the single owner account, verify login and password recovery, then disable public sign-ups in Supabase Auth. Do not enable user invitations or multi-user sharing. SQL migrations do not change Auth settings; this must be applied manually in the Supabase dashboard after owner registration.
- **Reporting timezone:** Asia/Manila is the initial reporting timezone. Store instants in `timestamptz` (UTC) and derive calendar months in SQL with `AT TIME ZONE 'Asia/Manila'`.
- **Backups:** rely on Supabase backups for the plan tier; export a manual backup before destructive migration reviews.
- **Monitoring:** Supabase logs for failed auth/queries and Vercel runtime logs for server action errors.
- **Free tier:** adequate for single-user traffic; no caching/queueing infrastructure is introduced.

## 9. Resolved Decisions

1. **Sign-up policy — resolved.** TIGOM is single-owner. Public registration is enabled only to create the owner account, then disabled in Supabase Auth. Login and password recovery remain enabled. No multi-user financial sharing is implemented, and RLS still isolates users. Disabling sign-ups is a deployment configuration requirement and has not been applied by the migrations.
2. **Negative balances — resolved.** Ordinary expenses, transfers (including fee), reversals, and downward balance adjustments cannot make an account negative. The RPC locks the affected account rows in deterministic ID order, re-derives the balance from `transaction_entries`, and rejects the operation when funds are insufficient. Transfers require `amount + fee`. Multi-session integration tests are prepared but have not been executed; PGlite single-connection tests do not prove concurrency safety.
3. **Credit and liability accounts — resolved for MVP.** Only `bank`, `ewallet`, and `cash` asset accounts are supported. The ledger is not reshaped for liabilities; a future migration can add `account_type` values and liability-specific rules.
4. **Date semantics and ordering — resolved.** `transaction_date` is `timestamptz` and records when the activity occurred; `created_at` records when the row was written; `updated_at` exists only on editable metadata rows. Reporting uses `transaction_date`. Ordering is `transaction_date DESC, created_at DESC, id DESC`. The initial reporting timezone is Asia/Manila.
5. **Reporting period — resolved.** Reports use calendar months interpreted in Asia/Manila via `transaction_date AT TIME ZONE 'Asia/Manila'`. Income and expenses use `transaction_date`, not `created_at`. Transfers, opening balances, balance adjustments, and savings allocations never appear in income or expense totals.
6. **Account archiving — resolved.** Accounts may be archived with any derived balance. Opening balance, derived balance, and history are preserved; archived accounts are excluded from active totals but remain in historical reports; they reject all new ledger writes, including reversals and adjustments, and cannot be physically deleted while history exists.
7. **Savings allocation corrections — resolved.** Original allocations are immutable. `savings_allocation_adjustments` records signed corrections with their own date, note, and idempotency key. Effective allocation is original plus adjustments and can never be negative. Adjustments never affect account balances or income/expense totals.
8. **Opening-balance corrections — resolved.** Before any non-opening financial activity, `update_opening_balance` may edit or remove the opening entry. Every accepted change writes an immutable `account_opening_balance_changes` row with previous amount, new amount, account, and timestamp. Setting the opening to zero removes the zero-value ledger entry but preserves the audit history. Afterwards the original opening balance is preserved and `adjust_account_balance` posts an auditable `balance_adjustment` transaction. Adjustments change the derived balance but are not income or expenses and cannot be reversed; the opposite adjustment is posted instead.
9. **Posted transaction metadata — intentional limitation.** Descriptions and all posted transaction metadata are immutable in the initial version. General-purpose transaction editing is not implemented; corrections use reversal or balance adjustment.
10. **Liability modelling — deferred.** Credit cards, loans, and liability accounts are excluded. No liability calculations are implemented. A future version can add enum values and liability-specific rules.
11. **Concurrency verification — pending execution.** Row locking is implemented. The concurrent expense and transfer tests in `supabase/tests/concurrency.test.mjs` are prepared for a dedicated Supabase test project but have not been run, so multi-session concurrency safety is not yet proven.

Previously open items that are now settled: transfer fees use the seeded `Transfer Fees` category; categories are per-user with seeded defaults; transaction corrections use reversal plus repost; financial rows are never hard-deleted; default categories are fixed as documented in §4.4.

## 10. Remaining Limitations

1. **Concurrency integration tests have not been executed against Supabase PostgreSQL.** They must be run with a dedicated test project before claiming multi-session safety.
2. **Public sign-up disabling is not applied.** It remains a manual Supabase Auth deployment step after owner registration.
3. **Posted metadata is immutable by design.** There is no general-purpose transaction editing in this version.
4. **Liability accounts and calculations are not implemented.** They are deferred future functionality.
