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
- **Server Actions** handle all writes: create account, post income/expense/transfer, reverse transaction, add savings contribution.
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

All user-owned tables carry `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`. Monetary columns use `numeric(14,2)`. Currency is `char(3)` and fixed to `PHP` at launch.

### 4.1 Enums

- `account_type`: `bank`, `ewallet`, `cash`
- `transaction_type`: `opening_balance`, `income`, `expense`, `transfer`, `reversal`

### 4.2 `accounts`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | NOT NULL, FK `auth.users(id)` |
| `name` | `text` | NOT NULL, length 1–80 |
| `type` | `account_type` | NOT NULL |
| `currency` | `char(3)` | NOT NULL, default `'PHP'`, CHECK `= 'PHP'` |
| `is_archived` | `boolean` | NOT NULL, default `false` |
| `archived_at` | `timestamptz` | NULL |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

- Unique index on `(user_id, lower(name)) WHERE is_archived = false`.
- No stored balance column. Archived accounts keep all history.

### 4.3 `categories`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK `auth.users(id)` |
| `name` | `text` | NOT NULL, length 1–60 |
| `is_archived` | `boolean` | NOT NULL, default `false` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

- Unique index on `(user_id, lower(name)) WHERE is_archived = false`.
- Default categories are inserted for the user (e.g., Food, Transport, Bills, Shopping, Health, Transfer Fees, Other).

### 4.4 `transactions`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK `auth.users(id)` |
| `type` | `transaction_type` | NOT NULL |
| `transaction_date` | `date` | NOT NULL |
| `description` | `text` | NOT NULL, default `''`, length ≤ 500 |
| `category_id` | `uuid` | NULL, FK `categories(id)` ON DELETE RESTRICT |
| `related_transaction_id` | `uuid` | NULL, FK `transactions(id)` |
| `idempotency_key` | `text` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

Constraints:
- `UNIQUE (user_id, idempotency_key)`.
- `CHECK (type = 'expense' AND category_id IS NOT NULL) OR (type <> 'expense' AND category_id IS NULL)`.
- `CHECK (type = 'reversal' AND related_transaction_id IS NOT NULL) OR (type <> 'reversal')`.
- `related_transaction_id` is also used by a transfer-fee expense to reference its transfer.
- No UPDATE/DELETE of financial rows by the application except explicit reversal flow.

### 4.5 `transaction_entries`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK `auth.users(id)` |
| `transaction_id` | `uuid` | NOT NULL, FK `transactions(id)` ON DELETE RESTRICT |
| `account_id` | `uuid` | NOT NULL, FK `accounts(id)` ON DELETE RESTRICT |
| `amount` | `numeric(14,2)` | NOT NULL, CHECK `<> 0` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

- `UNIQUE (transaction_id, account_id)`.
- Index `(user_id, account_id)`.
- `user_id` is denormalized from `transactions` purely to make RLS direct and simple; it must match the parent transaction's `user_id` (enforced in the Postgres functions and a trigger).
- **Sign convention:** positive = money into that account; negative = money out of that account.

### 4.6 `savings_goals`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK `auth.users(id)` |
| `name` | `text` | NOT NULL, length 1–80 |
| `target_amount` | `numeric(14,2)` | NOT NULL, CHECK `> 0` |
| `currency` | `char(3)` | NOT NULL, default `'PHP'`, CHECK `= 'PHP'` |
| `target_date` | `date` | NULL |
| `is_archived` | `boolean` | NOT NULL, default `false` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

### 4.7 `savings_contributions`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK `auth.users(id)` |
| `goal_id` | `uuid` | NOT NULL, FK `savings_goals(id)` ON DELETE RESTRICT |
| `amount` | `numeric(14,2)` | NOT NULL, CHECK `> 0` |
| `contribution_date` | `date` | NOT NULL |
| `note` | `text` | NOT NULL, default `''`, length ≤ 300 |
| `idempotency_key` | `text` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

- `UNIQUE (user_id, idempotency_key)`.
- Contributions are **informational only** in this design and do not change account balances (see §5.5 and Open Questions).

### 4.8 Views

**`account_balances`** (`security_invoker = true`):

```sql
account_id, user_id, account_name, account_type, is_archived,
balance = SUM(transaction_entries.amount)
```

**`transaction_totals`** for dashboard/reports:

- Income total = `SUM(amount)` of entries whose transaction `type = 'income'`.
- Expense total = `SUM(-amount)` of entries whose transaction `type = 'expense'` (stored negative, displayed positive).
- Overall funds (active accounts) = `SUM(entries.amount)` joined to accounts where `is_archived = false`.
- Opening balances and transfers are excluded from income/expense totals.

Balances are derived, never stored. At personal-usage data volumes, summing an indexed entries table is inexpensive. A materialized view is not needed for MVP.

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

- A goal has a target and optional target date.
- Progress = `SUM(savings_contributions.amount)` for that goal.
- Remaining = `MAX(target_amount - progress, 0)`.
- Completion % = `LEAST(progress / target_amount * 100, 100)` computed in SQL/`numeric`.
- Contributions are progress records only; the money stays in the linked real accounts and is already counted there. This is the explicit choice that prevents double-counting.
- If contributions must move real money, that requires a separate decision: model each contribution as a transfer to a designated savings account instead (see Open Questions).

### 5.6 Transaction history, editing, cancellation

- `transactions` and `transaction_entries` are append-oriented. Financial fields are **immutable** after posting.
- **Correction:** a `reversal` transaction is created whose entries are the exact negation of the original entries (reversing a transfer with fee also reverses its linked fee transaction atomically). History retains both records; totals net to zero for the reversed item.
- A corrected entry is then posted as a new transaction.
- **Cancellation** is therefore a reversal, not a hard delete.
- Non-financial metadata (description) may be edited in a future revision; that rule is unresolved (Open Questions).
- UI must never silently overwrite or delete a posted financial row.

### 5.7 Duplicate prevention

- Every mutating form receives a client-generated `idempotency_key` (UUID).
- `UNIQUE (user_id, idempotency_key)` on `transactions` and `savings_contributions`.
- On unique violation, the server returns the existing record instead of inserting again.
- Postgres functions take the key as an argument and perform the insert once.

### 5.8 Postgres functions (RPC)

All are `SECURITY INVOKER` (RLS applies), use a fixed `search_path`, derive the user from `auth.uid()`, and validate ownership:

- `create_account(name, type, opening_balance, idempotency_key)`
- `post_income(account_id, amount, transaction_date, description, idempotency_key)`
- `post_expense(account_id, category_id, amount, transaction_date, description, idempotency_key)`
- `post_transfer(source_account_id, destination_account_id, amount, fee, transaction_date, description, idempotency_key)`
- `reverse_transaction(transaction_id, transaction_date, description, idempotency_key)`
- `add_savings_contribution(goal_id, amount, contribution_date, note, idempotency_key)`
- `archive_account(account_id)` (sets archive flag; does not delete)

Validation inside functions: positive amounts, valid account/category ownership, distinct transfer accounts, active status rules, fee ≥ 0.

## 6. Security

- Supabase Authentication required for every app route; middleware redirects unauthenticated sessions to `/login`.
- RLS enabled on `accounts`, `categories`, `transactions`, `transaction_entries`, `savings_goals`, `savings_contributions`.
- Policies use `user_id = auth.uid()` for `SELECT`, `INSERT`, `UPDATE`, `DELETE` (with `WITH CHECK` on writes). Views are `security_invoker` so they inherit RLS.
- Server actions call `supabase.auth.getUser()` and reject requests without a valid session.
- Every Postgres function re-checks that all referenced account/goal/category rows belong to `auth.uid()`. Never trust IDs supplied by the client.
- The **service-role key** is never placed in `NEXT_PUBLIC_*` variables, client code, or the Vercel frontend environment. Normal application flows do not need it.
- The anon/publishable key is safe to expose because RLS is mandatory on all user tables.
- Database is not publicly accessible outside Supabase's API; direct Postgres access is restricted to the project owner.
- Sign-ups are disabled after the single owner account exists (exact policy in Open Questions). Additional authenticated users would see no rows due to RLS, but sign-ups should still be closed.
- Financial writes only occur through validated server actions and the RPC functions; no client-side balance writes.
- Enforce `updated_at` via triggers where rows are editable (accounts, goals).

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
- **Savings goal:** progress = sum of contributions; remaining and percentage correct at 0%, partial, and > 100% (capped display).
- **Reversal:** reversal entries negate originals; net balance returns to pre-transaction value; original remains visible.
- **Idempotency:** submitting the same key twice creates one transaction and returns the same result.
- **Archived account:** excluded from active totals; historical transactions still visible and account filterable.
- **Decimal correctness:** sums of many `numeric` values are exact (e.g., 0.10 × 3 = 0.30; no 0.30000000000000004).
- **RLS:** user B cannot `SELECT`, `INSERT`, `UPDATE`, or `DELETE` user A's rows; RPC calls with A's account IDs fail for B.
- **Unauthenticated access:** API/RPC calls without a valid JWT are rejected.

### 7.3 End-to-end (Playwright)

- Login and redirect protection.
- Create account → dashboard shows opening balance once.
- Add income and expense → dashboard and transaction list update.
- Transfer with fee → both accounts and expense report correct.
- Filter/search transactions and open details.
- Create goal, add contribution, see progress.
- Browser tests run against a test deployment/project, not production data.

### 7.4 Financial regression suite

Keep a small fixed dataset with expected values (balances, income, expenses, category totals) and assert after every schema or logic change. Any change to financial functions requires this suite to pass.

## 8. Deployment

- **Vercel:** production and preview deployments from the repository. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No service-role key.
- **Supabase:** one production project; SQL changes applied as versioned migrations via the Supabase CLI. Enable RLS in the same migration that creates each table.
- **Auth config:** set Site URL and redirect URLs to the Vercel domain; disable public sign-ups per the chosen policy.
- **Backups:** rely on Supabase backups for the plan tier; export a manual backup before destructive migration reviews.
- **Monitoring:** Supabase logs for failed auth/queries and Vercel runtime logs for server action errors.
- **Free tier:** adequate for single-user traffic; no caching/queueing infrastructure is introduced.

## 9. Open Questions

Carried from the spec:

1. **Sign-up policy:** fully disable sign-ups, or allow only a specific email? (Recommended: create the owner account, then disable sign-ups.)
2. **Savings contributions:** informational only (this design), or should they move real money between accounts?
3. **Savings funding source:** if contributions must affect balances, which account funds them?
4. **Transfer fees:** is a dedicated "Transfer Fees" expense category acceptable as the default?
5. **Expense categories:** fixed defaults for MVP, or user-editable categories?
6. **Transaction corrections:** is reversal-plus-repost acceptable, or is controlled in-place editing required?
7. **Negative balances:** block operations that would make an account negative, or allow it? (This design does not add a non-negative constraint until decided.)
8. **Credit accounts:** only asset accounts for MVP, or are credit/liability accounts needed?
9. **Date semantics:** user-entered `transaction_date` only (this design), or also a recorded time for ordering? Ordering currently uses `created_at` as tiebreaker.
10. **Reporting periods:** current month with optional range selection, or fixed monthly views only?

New questions introduced by this design:

11. **Metadata edits:** may `description` be edited after posting (with an audit trail), or are all edits reversal-only?
12. **Account archiving with nonzero balance:** is archiving allowed when the derived balance is not zero, and does it require a transfer-out first?
13. **Default categories:** confirm the starter category list.
14. **Deletion:** should any user data ever be hard-deleted (e.g., an accidentally created empty account), or is archive/reversal always used?
