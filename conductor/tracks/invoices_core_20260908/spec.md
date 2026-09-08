# Specification — Invoice Core Data Model & CRUD (invoices_core_20260908)

## Overview

Foundation of the PayTrail core loop: persistent `Invoice` + `InvoiceItem` entities with
per-user yearly numbering, a status lifecycle (DRAFT → SENT → PAID, OVERDUE computed on
read), integer-minor-unit totals math with per-invoice tax and flat discount, and
ownership-scoped CRUD exposed through server actions. This track is the **data layer
only** — no UI pages; the next track builds the `/invoices` builder UI on top of these
actions. Deleting a client or project with attached invoices is blocked (deletion safety).

Decisions confirmed with the user (2026-09-08):

- **Scope:** data layer + server actions; no UI pages.
- **FX:** snapshot fields reserved now (nullable, unpopulated); fetching lands in the
  future FX track — avoids a second migration on the same table.
- **Payments:** `markPaid` (SENT → PAID, full amount, no history table) is included here;
  OVERDUE is never stored — computed on read.

## Functional Requirements

### FR1 — Prisma models

- `Invoice`: `userId`, `clientId`, optional `projectId`, `invoiceNumber`
  (`INV-YYYY-0001` format, unique per user), `status` enum `DRAFT | SENT | PAID`,
  `issueDate`, `dueDate`, `currencyCode` (defaults to the client's currency),
  `taxRate` Decimal(5,2), `discountMinor` Int (default 0), FX snapshot fields
  (`fxRate` Decimal?, `fxRateCurrency`?) nullable and unpopulated this track,
  `sentAt`?, `paidAt`?, timestamps. Cascade rules: deleting a user deletes invoices;
  deleting a client/project **with invoices is blocked at the application layer** (FR6).
- `InvoiceItem`: `invoiceId`, `description`, `amountMinor` Int, `sortOrder`;
  cascade delete with its invoice.
- `InvoiceNumberCounter`: unique per `(userId, year)`, `lastNumber` Int — backing the
  auto-counter.

### FR2 — Invoice numbering

- Auto number: per-user yearly sequence `INV-<year>-<0001>`; first invoice of a year is
  `-0001`; counter is per user (no cross-user leakage) and per year (no cross-year drift).
- Manual override: the user may set the number; if it collides with an existing number
  for that user, creation fails with a clear error — the auto-counter later **skips**
  taken numbers (collision-safe: counter must advance past any manually taken number).

### FR3 — Totals math (integer minor units)

- Subtotal = Σ item `amountMinor`.
- Discount is flat, applied before tax: taxable = subtotal − discount (floored at 0).
- Tax: `taxRate` (percent, Decimal(5,2)) applied to taxable base, rounded per the
  project's rounding rules (round-half-up to nearest minor unit); rules unit-tested.
- Totals are derived on read; no stored total columns drift.

### FR4 — Status lifecycle

- `DRAFT → SENT` via an explicit send action: stamps `sentAt` and **locks** the invoice —
  items, amounts, tax, discount, dates, and number become immutable.
- `SENT → PAID` via markPaid (full amount): stamps `paidAt`.
- `OVERDUE` is derived on read (`dueDate < today && status !== PAID`) — never stored.
- Invalid transitions (e.g. edit/delete after SENT, PAID → anything) are rejected with
  typed errors.

### FR5 — CRUD (server actions)

- Zod **input** schemas (transform-free, for future forms) and **output** schemas
  (server-validated) per the tech-stack decision; every action re-validates input.
- `createInvoice` (with items), `getInvoice` / `listInvoices` (user-scoped),
  `updateInvoice` (DRAFT only), `deleteInvoice` (DRAFT only), `sendInvoice`,
  `markPaidInvoice`.
- Every query and mutation filters by the session user's id (ownership guard).

### FR6 — Deletion safety

- Deleting a client or project that has attached invoices is blocked with a clear,
  user-facing error; deletion proceeds only when no invoices reference it.

## Non-Functional Requirements

- Logic-bearing modules (`src/lib/invoice-*.ts`, numbering, totals, schemas, repo) are
  test-first with **>80% coverage**; `src/lib/invoices-actions.ts` wrappers are excluded
  from the coverage gate per workflow testing note (2026-09-07), verified via E2E later.
- All money math in integer minor units; no float arithmetic.
- Migrations committed; `pnpm exec prisma generate` run explicitly (Prisma 7).

## Acceptance Criteria

1. First invoice a user creates in a year is numbered `INV-<year>-0001`; a second is
   `-0002`.
2. A manual override that collides is rejected; after a manual number like `0005`, the
   next auto number is `0006` (counter skips taken numbers).
3. Numbers are isolated per user and per year.
4. Totals: items 1000+2000 minor, discount 500, tax 10% → taxable 2500, tax 250, total
   2750. Rounding edge cases covered by tests.
5. Sending locks the invoice; post-send edit/update/delete attempts fail; invalid
   transitions fail.
6. OVERDUE appears only when dueDate < today and not PAID (derived, not stored).
7. Client/project deletion blocked while invoices reference them; allowed otherwise.
8. Cross-user access to invoices is impossible (all queries user-scoped).
9. `pnpm vitest run --coverage` >80% on new logic modules; Biome + `tsc --noEmit` clean.

## Out of Scope

- `/invoices` UI pages (next track: invoice builder UI).
- PDF generation and email/mailto delivery.
- FX rate fetching or population of snapshot fields.
- Screenshot AI ingestion.
- Partial payments, payment history tables, credit notes, cancel-and-reissue flow.
