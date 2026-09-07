# Spec — Clients & Projects CRUD (clients_projects_20260907)

## Overview

Full CRUD for Clients and Projects, scoped to the owning user, per the PayTrail v1 scope. Clients are the billing counterparties for invoices; Projects group billable work. This track unblocks the Invoice Core Engine and is deliberately independent of the unmerged onboarding branch (`feat/onboarding-business-profile`).

## Functional Requirements

### Data model (Prisma, migration)

- `Client`: `id`, `userId` (FK → User, cascade), `name` (required), `email`, `address`, `currencyCode` (ISO 4217 string), `notes`, timestamps. Indexed on `userId`.
- `Project`: `id`, `userId` (FK → User, cascade), `clientId` (FK → Client, cascade), `name` (required), `description`, timestamps. `name` unique per client.
- Deletion: deleting a Client cascades its Projects; Clients and Projects with attached invoices cannot be deleted (enforced server-side once invoices exist — guard written now, invoice FK added by the invoice track).

### Validation (shared Zod schemas in `src/lib/`)

- Client schema: name 1–200 chars; email optional valid email; currencyCode validated against ISO 4217 constant list; address/notes optional, length-bounded.
- Project schema: name 1–200 chars; description optional; client ownership enforced server-side.

### Server actions / queries (all session-scoped)

- Client: create, update, delete; list (with `?q=` search). Search: Zod-validated query param, case-insensitive `contains` on name + email, alphabetical sort by name. No pagination.
- Project: create, update, delete under the parent client; verify client belongs to session user before any project mutation.
- Delete guard: server action returns typed error with counts (e.g. "3 invoices attached"); client-with-projects (no invoices) delete cascades projects.

### Currency

- `currencyCode` defaults to `USD` in the create form until the onboarding track's `BusinessProfile.homeCurrency` merges; afterwards the form pre-fills from home currency (wiring deferred to onboarding merge — noted, not in this track).

### UI (MUI v9, RHF + Zod, mobile-first 390px)

- `/clients`: MUI table (name, email, currency, project count), search field (debounced, URL-param-backed), "Add client" dialog, row → detail. Empty state with CTA.
- `/clients/[id]`: client info card + Edit dialog + Delete (with inline blocked-reason alert on failure); Projects section — add/rename/delete projects.
- Dashboard links to `/clients`.

## Non-Functional Requirements

- Every query/mutation filters by session user id (security invariant).
- All external input Zod-validated server-side.
- Touch targets ≥44px, no horizontal scroll at 390px.

## Acceptance Criteria

- User can create, search, edit, delete clients; each scoped to their own session.
- User can add, rename, delete projects within their client.
- Deleting a client with invoices (once invoice track lands) is blocked with a clear inline reason; deleting a client with only projects removes the projects.
- Client currency is stored as a valid ISO 4217 code.
- Full CRUD E2E passes at desktop + mobile viewports.

## Out of Scope

- Invoices, invoice-client linkage (invoice track), per-client currency conversion/FX.
- Pagination, CSV export, client portal (cut permanently).
- Home-currency pre-fill wiring (lands with onboarding merge).
- Unit-testing UI components (verified manually + E2E per workflow).
