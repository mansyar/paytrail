# Plan — Clients & Projects CRUD (clients_projects_20260907)

Follows `conductor/workflow.md`. Logic-bearing code (Zod schemas, session-scoped queries/mutations, search, delete guard, ownership checks) is test-first; UI is verified via E2E + manual walkthrough. Each phase ends with a verification checkpoint per the workflow protocol.

## Phase 1: Data Model & Validation Schemas

- [ ] Task: Write failing Vitest tests for shared Zod schemas (client fields, ISO 4217 currency, length bounds, project rows); confirm RED
- [ ] Task: Prisma migration — `Client` + `Project` models (userId/clientId cascade FKs, per-client project name uniqueness); regenerate client
- [ ] Task: Shared Zod schemas in `src/lib/` + ISO 4217 constant list; GREEN + coverage
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Server Actions & Queries

- [ ] Task: Write failing Vitest tests for session-scoped client CRUD server actions; confirm RED
- [ ] Task: Write failing Vitest tests for `?q=` search filtering (Zod-validated param, contains on name+email, alphabetical sort) and invoice-attached delete guard (typed error + counts); confirm RED
- [ ] Task: Write failing Vitest tests for project CRUD server actions with client-ownership verification; confirm RED
- [ ] Task: Implement server actions/queries; GREEN + coverage
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Clients UI

- [ ] Task: `/clients` list page — MUI table (name, email, currency, project count), debounced URL-param search, Add/Edit dialogs, empty state; dashboard link
- [ ] Task: Mobile 390px pass (touch targets ≥44px, no horizontal scroll)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Client Detail & Projects

- [ ] Task: `/clients/[id]` detail page — client info card, Edit dialog, Delete with inline blocked-reason alert
- [ ] Task: Projects section — add/rename/delete projects under the client
- [ ] Task: Mobile 390px pass
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5: E2E & Review Gate

- [ ] Task: Playwright E2E — full CRUD: create client → add project → edit → deletion-guard visible → delete project → delete client; mobile viewport spot-check
- [ ] Task: Full local review gate (Biome, `tsc --noEmit`, `vitest run --coverage`, `pnpm build`) + self-review against product-guidelines
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
