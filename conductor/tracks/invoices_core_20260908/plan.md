# Implementation Plan — Invoice Core Data Model & CRUD

Spec: [spec.md](./spec.md) · Branch: `feat/invoice-core` · Workflow: [workflow.md](../../workflow.md)

Testing discipline: red→green for every logic-bearing task; coverage >80% on new
`src/lib/` modules; `invoices-actions.ts` wrappers excluded from the coverage gate
(workflow note 2026-09-07). After schema edits run `pnpm exec prisma generate` explicitly
(Prisma 7). All money math in integer minor units.

## Phase 1 — Schema & Migration [checkpoint: fa60f69]

- [x] Task: Prisma schema — add `InvoiceStatus` enum, `Invoice`, `InvoiceItem`,
      `InvoiceNumberCounter` models with relations to `User`/`Client`/`Project`,
      per-user-unique `invoiceNumber`, `(userId, year)` unique counter, nullable FX
      snapshot fields (reserved, unpopulated) `fa60f69`
  - [ ] Edit `prisma/schema.prisma`
  - [ ] Run `pnpm exec prisma migrate dev --name invoice_core` (commit migration)
  - [ ] Run `pnpm exec prisma generate` and confirm client regenerated in `src/generated/prisma`
  - [ ] `pnpm exec tsc --noEmit` clean
- [x] Task: Phase Verification & Checkpoint (refer to workflow.md) [fa60f69]

## Phase 2 - Domain Logic: Numbering, Totals, Schemas (TDD) [checkpoint: ba44c1b]

- [x] Task: Invoice numbering (per-user yearly sequence, manual override, collision skip) [ba44c1b]
  - [ ] Write failing tests `src/lib/invoice-numbering.test.ts`: first invoice of a year
        is `INV-<year>-0001`; sequence increments; per-user isolation; per-year isolation;
        manual override rejects collisions; auto-counter advances past manually taken
        numbers (skip behavior)
  - [ ] Confirm tests fail (red)
  - [ ] Implement `src/lib/invoice-numbering.ts`
  - [ ] Tests pass (green); coverage on module >80%
- [x] Task: Totals math in integer minor units (subtotal, flat discount, percent tax) [62c16d3]
  - [ ] Write failing tests `src/lib/invoice-totals.test.ts`: subtotal = Σ items;
        discount applied before tax, floored at 0; tax rounded half-up to minor unit;
        zero items / zero discount / zero tax edge cases
  - [ ] Confirm tests fail (red)
  - [ ] Implement `src/lib/invoice-totals.ts`
  - [ ] Tests pass (green)
- [x] Task: Zod input/output schemas for invoice CRUD [c22fa84]
  - [ ] Write failing tests `src/lib/invoice-schemas.test.ts`: input schemas
        transform-free (form-compatible), output schemas coerce/transform, invalid
        payloads rejected (missing items, bad dates, negative amounts, bad enum)
  - [ ] Confirm tests fail (red)
  - [ ] Implement `src/lib/invoice-schemas.ts` following the input/output split
  - [ ] Tests pass (green)
- [x] Task: Phase Verification & Checkpoint (refer to workflow.md) [ba44c1b]

## Phase 3 - Repo: Ownership Scoping, Status Lifecycle, Deletion Safety (TDD) [checkpoint: 663b72f]

- [x] Task: Invoice repository `src/lib/invoices-repo.ts` [e9b5ee2]
  - [ ] Write failing tests `src/lib/invoices-repo.test.ts` (mock/DB per existing
        repo-test style, e.g. `clients-repo.test.ts`): create with items; list/get
        user-scoped (cross-user access impossible); update restricted to DRAFT; delete
        restricted to DRAFT; send DRAFT→SENT stamps `sentAt` and locks; markPaid
        SENT→PAID stamps `paidAt`; invalid transitions rejected with typed errors;
        OVERDUE derived on read, never stored; number uniqueness enforced per user
  - [ ] Confirm tests fail (red)
  - [ ] Implement `src/lib/invoices-repo.ts`
  - [ ] Tests pass (green); coverage >80%
- [x] Task: Deletion safety for clients/projects with attached invoices [663b72f]
  - [ ] Write failing tests extending `src/lib/clients-repo.test.ts` /
        `src/lib/projects-repo.test.ts`: client deletion blocked when invoices attached;
        project deletion blocked when invoices attached; deletion allowed when none;
        clear error surfaced
  - [ ] Confirm tests fail (red)
  - [ ] Implement guards in `src/lib/clients-repo.ts` / `src/lib/projects-repo.ts`
  - [ ] Tests pass (green)
- [x] Task: Phase Verification & Checkpoint (refer to workflow.md) [663b72f]

## Phase 4 - Server Actions & Local Review Gate [checkpoint: 0c75ada]

- [x] Task: Server action wrappers `src/lib/invoices-actions.ts` [1fc8930]
  - [ ] Implement `"use server"` wrappers: session resolution + delegation to repo,
        Zod re-validation on every action (no business logic — excluded from coverage)
  - [ ] `pnpm vitest run` full suite green
- [x] Task: Local review gate & docs [0c75ada]
  - [ ] `pnpm biome check --write .`, `pnpm exec tsc --noEmit`, `pnpm vitest run`,
        `pnpm build` — all pass
  - [ ] Self-review diff vs. spec: user-scoped queries, Zod on all inputs, minor-unit
        math, lock semantics
  - [ ] Manual verification plan drafted (data-layer track — verified via tests +
        future E2E; note dev-server smoke via a temporary script if useful)
- [x] Task: Phase Verification & Checkpoint (refer to workflow.md) [0c75ada]
