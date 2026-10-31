# Personal Finance Tracker — Project Specification

## 1. Project Overview

A private, single-user personal finance web application for manually recording and monitoring everyday money movements. The application tracks accounts, income, expenses, transfers, and savings goals in Philippine Peso (PHP). It does not connect to banks or external financial institutions.

The product is intended strictly for personal use. It is not a commercial SaaS offering, has no multi-tenant or organizational requirements, and does not target public sign-ups.

## 2. Project Objectives

- Provide a single place to see current total money across all accounts.
- Record every financial movement manually and reliably.
- Show where money goes through categories and reports.
- Track progress toward simple savings goals.
- Ensure financial figures are accurate, consistent, and traceable over time.

## 3. Target Usage

- **User:** A single individual managing their own finances.
- **Frequency:** Daily or near-daily entry of expenses; periodic income, transfers, and account updates.
- **Devices:** Desktop and mobile browsers.
- **Access:** Authenticated via Supabase Authentication.
- **Currency:** PHP initially, with the design allowing future currency changes without rework.

## 4. MVP Features

### 4.1 Authentication
- Single-user sign-in via Supabase Authentication.
- Access to all application data requires authentication.

### 4.2 Dashboard
- Overall balance across all active accounts.
- Total money received.
- Total expenses.
- Account balance overview.
- Recent transactions.
- Monthly expense summary.

### 4.3 Account Management
- Create accounts of type bank, e-wallet, or cash.
- Set an initial balance per account.
- Edit account name, type, and related details.
- Archive accounts without deleting their transaction history.

### 4.4 Income
- Record money received.
- Select destination account.
- Enter amount, date, and description.

### 4.5 Expenses
- Record an expense.
- Select payment account (required).
- Select expense category.
- Enter amount, date, and description.

### 4.6 Transfers
- Transfer money between two accounts.
- Select source and destination accounts.
- Enter amount and optional fee.
- Update both account balances correctly.

### 4.7 Categories
- Predefined default expense categories at minimum.
- Ability to manage categories is optional for MVP unless required by expense entry.

### 4.8 Transactions
- View transaction history.
- Search transactions.
- Filter by account, category, type, and date.
- View transaction details.

### 4.9 Savings Goals
- Create a savings goal.
- Set a target amount.
- Track progress via manual contributions.
- View remaining amount and completion percentage.
- Intentionally simple: no envelope budgeting, investment tracking, or forecasting.

### 4.10 Reports
- Monthly expenses.
- Expenses by category.
- Income versus expenses.
- Spending trends over time.

## 5. Functional Requirements

- FR-1: The user must be authenticated before accessing any financial data.
- FR-2: The user can create, edit, and archive accounts of type bank, e-wallet, or cash.
- FR-3: Every account has an initial balance that is recorded once and is not double-counted in totals.
- FR-4: Recording income increases the selected account balance and creates a transaction record.
- FR-5: Recording an expense requires an account and a category and decreases the account balance.
- FR-6: A transfer decreases the source account and increases the destination account by the transferred amount.
- FR-7: A transfer fee, if provided, must be recorded explicitly as a cost and reflected in totals.
- FR-8: Transfers must never be classified as income or expenses in reports.
- FR-9: The user can search and filter transaction history by account, category, type, and date.
- FR-10: The user can view the details of any transaction, including its effect on accounts.
- FR-11: The user can create savings goals with a target amount and record contributions toward them.
- FR-12: Savings goal progress is the sum of recorded contributions relative to the target.
- FR-13: Reports must reflect only recorded transactions and must be internally consistent with dashboard totals.
- FR-14: Financial operations must be validated on the server, not only in the client.
- FR-15: Duplicate financial transactions must be prevented (e.g., repeated submission of the same entry).
- FR-16: Archived accounts remain visible in historical transactions but are excluded from active account listings and available balance totals.
- FR-17: Financial records are not silently modified; corrections must be explicit and traceable.

## 6. Financial Requirements

- **Currency:** PHP is the initial and only supported currency at launch.
- **Monetary storage:** Use decimal-safe storage (PostgreSQL `numeric` with fixed scale) as the authoritative source. Never use JavaScript floating-point arithmetic as the source of truth for balances or totals.
- **Precision:** Monetary values use a consistent decimal scale (e.g., two decimal places) and are handled as decimal/string values between database and UI where practical.
- **Account linkage:** Every expense and every income entry must reference an account.
- **Expenses:** Decrease the associated account balance.
- **Income:** Increase the destination account balance.
- **Transfers:** Decrease the source account and increase the destination account. Internal transfers do not count as income or expenses.
- **Opening balances:** Initial balances are recorded once and included in account and overall balance totals without double-counting against income.
- **Idempotency:** Prevent duplicate financial transactions caused by retries or double submissions.
- **Server-side validation:** All balance-affecting operations are validated and applied on the server.
- **Integrity:** Balances and reports must be derivable from a consistent, append-oriented transaction history.
- **No silent changes:** Financial records must not be altered without an explicit, recorded action.

## 7. UI/UX Requirements

- Clean, modern personal finance dashboard.
- Light theme by default.
- Responsive layouts for desktop and mobile.
- Simple, consistent navigation.
- Fast, low-friction transaction entry.
- Clear financial summaries and totals.
- Readable charts with sensible labeling.
- Consistent typography and spacing.
- Minimal, purposeful motion only.
- Avoid visual clutter and unnecessary controls.

## 8. Out-of-Scope Features

- Bank connections, open banking, or automatic synchronization.
- Multi-user, shared households, or team accounts.
- Commercial SaaS features: billing, subscriptions, public onboarding, marketing.
- Budgeting systems, envelopes, or spending limits enforcement.
- Investment tracking, portfolio management, or net-worth forecasting.
- Debt scheduling, loan amortization, or bill automation.
- Receipt OCR, AI categorization, or AI agents.
- Mobile native applications.
- Spring Boot, microservices, Kafka, or Docker.
- Additional documentation beyond this file.

## 9. Acceptance Criteria

- AC-1: An authenticated user can reach the dashboard and see overall balance, total income, total expenses, account overview, recent transactions, and monthly expense summary.
- AC-2: A user can create bank, e-wallet, and cash accounts with initial balances, and those balances are reflected once in totals.
- AC-3: Recording income increases the correct account balance and appears in transaction history.
- AC-4: Recording an expense requires and correctly debits an account and is categorized.
- AC-5: A transfer moves the exact amount between accounts, updates both balances, and never appears as income or expense in reports.
- AC-6: Transfer fees, when entered, are recorded and reflected in totals without misclassifying the transfer itself.
- AC-7: Transaction history supports search and filtering by account, category, type, and date.
- AC-8: Transaction details show amount, date, description, type, account(s), category, and effect.
- AC-9: Savings goals display target, total contributed, remaining amount, and completion percentage.
- AC-10: Reports for monthly expenses, expenses by category, income vs. expenses, and spending trends match the underlying transaction records.
- AC-11: Monetary values are stored and computed with decimal-safe precision; no authoritative calculation relies on JavaScript floating-point arithmetic.
- AC-12: Duplicate submissions do not create duplicate financial transactions.
- AC-13: Archived accounts remain in history but are excluded from active listings and available totals.
- AC-14: The interface is usable on both desktop and mobile and defaults to a light theme.

## Open Questions

1. **Authentication scope:** Should sign-up be disabled entirely, or allowed but restricted to a single email address?
2. **Savings goal contributions:** Are contributions deducted from an account balance, or tracked separately as informational progress?
3. **Savings goal funding source:** If contributions affect balances, which account(s) fund them?
4. **Transfer fees:** Should fees be attributed to an expense category, and if so, which default category?
5. **Expense categories:** Should categories be user-editable in MVP, or is a fixed default set sufficient?
6. **Transaction corrections:** Is editing/deleting a transaction allowed, or must corrections be reversal entries only?
7. **Account negative balances:** Should expenses or transfers be blocked when they would make a balance negative, or is a negative balance allowed?
8. **Credit accounts:** Are credit cards or liabilities needed, or only asset accounts (bank, e-wallet, cash)?
9. **Date semantics:** Are transactions dated by user-entered date only, or also timestamped for ordering and duplicate detection?
10. **Reporting period:** Do reports default to the current month with selectable ranges, or fixed monthly views only?
