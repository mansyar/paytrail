# PayTrail — Code Style Guide (TypeScript + Next.js)

*Tooling note: Biome is the sole authority for formatting and mechanical lint rules (indentation, quote style, import ordering). This guide covers the conventions Biome cannot enforce — architecture, naming intent, and React/Next.js patterns. Google TS guide influence: strict typing discipline, no `any`, no non-null assertions without justification.*

## General TypeScript

- **Strict mode always.** `strict: true`; no `any` — use `unknown` + narrowing, or domain types.
- **No type assertions (`x as T`) or non-null assertions (`y!`)** without a written justification comment. Zod parsing is the preferred boundary between unknown and typed.
- `const` by default; never `var`. Arrow functions for callbacks; function declarations for named exported functions.
- **No default exports except where Next.js requires them** (pages, layouts, route handlers, `proxy.ts`). Everything else: named exports.
- **No barrel files** (`index.ts` re-exports) — import directly from module paths. Faster builds, cleaner graphs.
- Explicit return types on exported functions. Inference allowed inside function bodies.
- Dates: **UTC everywhere internally** (per product decision); convert to UI-local only at render.
- Money: store as integers (minor units, e.g. cents) in the database; format at render with the invoice currency. **Never float arithmetic on money.**

## Naming

- `PascalCase` — components, types, interfaces, Zod schemas (`InvoiceSchema`).
- `camelCase` — variables, functions, props.
- `SCREAMING_SNAKE_CASE` — true constants (e.g. `MAX_LINE_ITEMS`).
- Boolean variables/props read as predicates: `isLocked`, `hasInvoice`, `canDelete`.
- Server Actions end with the verb: `createInvoice`, `markInvoicePaid`.
- No `_` prefixes; no `I` prefix on interfaces.

## Project Structure (Next.js App Router)

```
src/
  app/                  # Routes only — thin pages, no business logic
    (auth)/             #   login, signup
    (app)/              #   authenticated shell: dashboard, clients, projects, invoices
    api/                #   route handlers (auth, AI ingest)
  components/           # Presentational + form components, grouped by domain
  lib/                  # Server-side domain logic
    auth/               #   Better Auth config + helpers
    invoices/           #   numbering, pricing, FX snapshot, PDF
    ingest/             #   vision AI parsing, rate-table matching
    validation/         #   Zod schemas shared by client + server
  generated/            #   Prisma client output (gitignored)
```

- **Routes are thin:** a page fetches/composes and renders. All business rules live in `lib/` as pure, testable functions.
- **Server Actions** are the mutation boundary: validate with Zod, verify session + ownership, call `lib/` logic, return typed results (never throw raw Prisma errors to the client).
- One concept per file; co-locate single-use types with their module.

## React / Next.js

- **Server Components by default.** `'use client'` only for interactivity (forms, dialogs) — never for data fetching that could be server-side.
- **Server Actions over API routes** for internal mutations; API routes reserved for auth handler + external callbacks (AI webhooks).
- **No `useEffect` for data fetching.** Server Components + Actions cover our flows.
- MUI: wrap app in a single theme provider; never hardcode colors/spacing — use theme tokens (per product guidelines).
- Loading/error states are mandatory: every data route gets `loading.tsx` and `error.tsx` before its feature is "done".
- Keys: stable IDs, never array index.

## Security Invariants (non-negotiable)

- Every server-side query/mutation **filters by the session user's id** — no exceptions (the old codebase's ownership bug never recurs).
- Zod-validate **every** external input: request bodies, form actions, AI-parse output (especially AI output — it's untrusted data).
- Secrets only via environment variables; never in client components (`NEXT_PUBLIC_` prefix discipline).

## Comments

- `//` for implementation notes; JSDoc only for exported lib functions with non-obvious contracts.
- Comments explain **why**, never restate the code. No commented-out code in commits.

## Git

- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`, `ci:`.
- Small, single-purpose commits; the working tree compiles at every commit.
