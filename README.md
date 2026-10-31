# Personal Finance Tracker

A private, single-user finance tracker for recording accounts, income, expenses, transfers, and savings goals in Philippine Peso (PHP). It does not connect to banks or external financial institutions.

## Status

Frontend-first. The interface currently runs on local mock data. There is no authentication, database connection, server action, or transaction persistence yet.

- Application shell and design system: complete
- Dashboard UI: in progress
- Accounts, Transactions, Savings, Reports, Settings: placeholders

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Lucide React icons
- Recharts
- Supabase + PostgreSQL (planned; not connected)

## Getting Started

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root route redirects to `/dashboard`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
  app/                  # App Router routes and layouts
  components/
    layout/             # App shell: sidebar, header, navigation
    shared/             # Reusable UI (money, empty states, transaction dialog)
    ui/                 # shadcn/ui primitives
  features/             # Feature-specific UI and logic
  lib/                  # Mock data and utilities
  types/                # TypeScript domain types
```

## Documentation

- [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) — product scope and requirements
- [`docs/TECHNICAL_DESIGN.md`](docs/TECHNICAL_DESIGN.md) — architecture, schema, and financial rules
- [`AGENTS.md`](AGENTS.md) — contributor and AI-agent instructions
