# Specification — Invoice Builder UI (invoices_ui_20260908)

## Overview

The UI half of the PayTrail core loop, built on the existing `invoices_core` data layer (server actions, numbering, totals, status lifecycle). Adds a **`/invoices` list page** (full status hub) and a **mobile-first invoice builder** with live preview, rate-rule price suggestions, and the send/lock flow. Also exposes the invoices section from the dashboard. No new data-layer logic beyond thin glue — existing `invoices-actions.ts` server actions are the only mutation path.

**Confirmed decisions (2026-09-08):** full status-hub list · pricing-engine auto-suggest · prefill + manual number override · critical-path E2E now · builder + live preview (no separate detail page) · mobile-first · full polish states · inline rows + live totals · inline send with lock confirmation · currency locked to client · read-only builder view for locked invoices · adjustments block · status chips + search · dashboard link.

## Functional Requirements

### FR1 — `/invoices` list page (status hub)

- Server-rendered, user-scoped via `listInvoices`; newest-first.
- Table on desktop; stacked cards on mobile (390px).
- Status chips: `DRAFT`, `SENT`, `PAID`, derived `OVERDUE` (computed from `dueDate` + status; never a stored value).
- Status filter chips: All / Draft / Sent / Paid / Overdue. Text search over client name and invoice number (client-side filtering of the loaded list).
- Row actions: **Edit** (DRAFT only) · **Send** (DRAFT only, confirm dialog) · **Mark Paid** (SENT only) · **Delete** (DRAFT only, confirm dialog). Locked records show view-only.
- Server-action errors (e.g. invalid transition races) surface as user-friendly snackbars/alerts.
- Guided empty state with prominent "New Invoice" CTA.

### FR2 — Builder (`/invoices/new`, `/invoices/[id]`)

- **Prefills:** client → currency (read-only display; changes with client selection), tax rate defaults from profile, project dropdown scoped to the selected client, issue/due dates default (today / per payment terms).
- **Numbering:** auto number prefilled (`INV-YYYY-NNNN` via counter preview) with manual override field; collision rejected with a clear inline error (data layer already enforces).
- **Line items:** inline editable rows — description + amount (decimal input → integer minor units), add/remove, `sortOrder` ordering.
- **Price auto-suggest:** on description match against the keyword → rate table (existing `pricing-engine`), the flat rate is suggested into the amount field (user-overridable); a subtle "matched rule" cue shows when a suggestion applied.
- **Adjustments block:** tax rate (%) + flat discount, above the totals.
- **Live totals bar:** subtotal → discount → tax → total, computed via existing `invoice-totals` (integer minor units), updating as the user types.
- **Live preview panel:** renders the invoice as it will appear (business profile, logo, client, items, totals) beside the form on desktop; collapsible section on mobile.
- **Save draft** via `createInvoice` / `updateInvoice`; forms use RHF + Zod **input** schemas; the server re-validates.
- **Send:** inline button (DRAFT only) with a confirmation dialog explaining the record locks after sending; calls `sendInvoice`.
- **Read-only mode:** SENT/PAID invoices open the same builder view with inputs disabled, status badge shown, and a **Mark Paid** action for SENT.

### FR3 — Dashboard integration

- Dashboard nav gains an **Invoices** link with an outstanding (unpaid) count badge, so the measured critical path starts from the dashboard.

### FR4 — Critical-path E2E

- Playwright: dashboard → new invoice → add item (rate-rule suggestion fires) → send — asserting completion within the **<2 min / <10 click** budget.
- Responsive spot-checks at desktop + mobile viewports.

## Non-Functional Requirements

- Mobile-first: usable at 390px, touch targets ≥44px, no horizontal scroll (per product guidelines).
- MUI v9 + Emotion, consistent with existing clients/theme patterns; route-level `error.tsx` / `loading.tsx` per existing conventions.
- Logic-bearing glue (e.g. decimal→minor-units conversion, suggestion matching) lives in `src/lib/` and is test-first with >80% coverage; pure UI is excluded from coverage per workflow.
- All mutations flow through existing user-scoped server actions; no direct repo calls from UI components.
- Biome + `tsc --noEmit` clean; CI green.

## Acceptance Criteria

1. `/invoices` lists the user's invoices with correct status chips; OVERDUE appears only for unpaid invoices past due.
2. Status filter chips and text search correctly narrow the list.
3. New invoice defaults: client's currency, profile tax rate, auto number `INV-<year>-NNNN`; manual override works, and a colliding number shows an inline error.
4. Typing a description matching a rate-table keyword suggests the flat price; overriding it is allowed and respected.
5. Totals bar matches `invoice-totals` math exactly for tax + discount combinations (unit-tested).
6. Saving a draft persists and appears in the list; editing a DRAFT works; deleting a DRAFT works.
7. Sending requires confirmation and locks the invoice: it renders read-only, further edits are impossible via UI, and Mark Paid transitions SENT → PAID.
8. Cross-user invoices are never visible or reachable (all data through user-scoped actions).
9. Critical-path Playwright E2E passes within the <2 min / <10 click budget; mobile viewport checks pass.
10. `pnpm vitest run --coverage` >80% on new logic modules; Biome + `tsc --noEmit` clean.

## Out of Scope

- PDF generation & delivery (next track).
- FX rate fetching / snapshot population.
- Screenshot AI ingestion.
- Partial payments, payment history, cancel & reissue flow.
- Invoice templates, server-side email, full dashboard analytics (dashboard track).
