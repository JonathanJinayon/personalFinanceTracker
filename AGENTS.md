# AGENTS.md

## Project Context

Personal-use finance tracker for manually recording accounts, income, expenses, transfers, and savings goals in PHP. Single user, no bank sync, no SaaS features.

Stack: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Auth + PostgreSQL), Recharts, Vercel.

Sources of truth:
- `docs/PROJECT_SPEC.md` — scope, features, financial requirements, acceptance criteria.
- `docs/TECHNICAL_DESIGN.md` — architecture, schema, financial logic, security, testing.

Read only the sections relevant to the current task.

## Coding Standards

- TypeScript everywhere; no `any` unless justified.
- Follow the folder structure in the technical design (`app/`, `components/`, `features/`, `lib/`). Create folders only for real features.
- Reuse existing components and helpers; prefer small focused functions.
- Clear naming: `feature/actions.ts`, `feature/queries.ts`, `feature/schemas.ts`, PascalCase components, camelCase functions.
- Add dependencies only when necessary; explain why.
- No comments unless they clarify non-obvious financial logic.

## Financial Rules

- Never use JavaScript floating-point arithmetic as the authoritative source for money.
- Store and compute money as PostgreSQL `numeric(14,2)`; JS may use `decimal.js` for display only.
- Validate all financial operations on the server (Zod + Postgres functions).
- Balance-affecting multi-row operations must be atomic in one Postgres function.
- Internal transfers are never income or expenses; only a transfer fee is an expense.
- Opening balances are recorded once as `opening_balance` transactions and excluded from income.
- Preserve transaction history; correct via reversal, never silent edits or hard deletes.
- Prevent duplicates with idempotency keys and unique constraints.
- Never trust client-supplied balances, user IDs, or ownership; re-derive from the database.

## Security

- Require Supabase Authentication for all app routes and actions.
- Enforce RLS on every user-owned table; never disable it as a shortcut.
- Never expose the Supabase service-role key in browser code or `NEXT_PUBLIC_*`.
- Verify account/category/goal ownership inside server actions and RPC functions.
- Keep credentials in environment variables; commit no secrets.

## AI Agent Workflow

Before implementing a task:

1. Read this file.
2. Identify the requested feature.
3. Read only the relevant sections of the two docs.
4. Inspect existing code before modifying files.
5. Follow existing architectural decisions.
6. Implement only the requested feature.
7. Run relevant tests, typecheck, lint, and build checks.
8. Report changed files and actual test results.

## Documentation Rules

- Do not create unnecessary Markdown files.
- Update existing docs when approved decisions change.
- Do not invent requirements; unresolved items stay in Open Questions.
- Ask before major architectural changes.

## Development Rules

- Do not implement unrelated features.
- Do not rewrite working code without reason.
- Do not install dependencies without a clear reason.
- Do not ignore TypeScript or build errors.
- Never claim tests passed unless they were actually run.
