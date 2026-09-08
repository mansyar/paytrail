# Spec: PDF Generation & Delivery

## Overview

Complete the v1 delivery promise: any invoice can be downloaded as a client-facing PDF and a prefilled email draft can be opened in the user's own mail client. Server-side rendering via **pdfkit** (per tech-stack.md); no server-side email in v1.

## Functional Requirements

### FR1 — PDF renderer module (`src/lib/`)

- New logic-bearing module that takes an invoice aggregate (invoice, items, client, project, business profile) and returns PDF bytes (`Uint8Array`/`Buffer`).
- Fixed single template (per product-guidelines "Invoice PDF Style"): **A4**, light background, conservative fonts; business logo (decoded from `BusinessProfile.logo` base64/data-URL string) + name + address + tax ID; client name; invoice number, issue date, due date; itemized lines (description, amount in invoice currency); tax rate, discount, totals; payment terms (from business profile); invoice currency labeled via **ISO code prefix** (e.g. `USD 1,234.50`).
- **DRAFT watermark:** light-gray diagonal "DRAFT" when `status === DRAFT`; clean render for SENT/PAID.
- **Missing logo:** skip the logo block gracefully (logo is optional in the profile).
- **Long invoices:** item table flows across pages, column header repeated on each page; totals block once on the final page.
- Amounts formatted via existing `money-format` conventions (integer minor units in, formatted string out).

### FR2 — PDF route handler

- `GET /api/invoices/[id]/pdf`, session-guarded and **user-scoped** (query filters by session user id).
- Errors: unauthenticated → **401**; invoice not found or owned by another user → **404**; malformed id → **400**.
- Response headers: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="<invoiceNumber>.pdf"` (manual-override numbers respected), `Cache-Control: no-store`.

### FR3 — Email draft (mailto:)

- "Email client" action on the invoice detail page opens `mailto:` with:
  - Subject: `Invoice <number> from <businessName>`
  - Body: greeting with client name, invoice number, total amount due, due date, payment terms — **no line items** (concise summary).
- The user attaches the downloaded PDF themselves (mailto cannot prefill attachments).

### FR4 — UI placement

- **Invoice detail page only:** "Download PDF" and "Email client" actions, available for **all statuses** (DRAFT included — doubles as a send preview). Terse verb-labeled buttons per voice & tone guidelines; ≥44px touch targets; usable at 390px.

## Non-Functional Requirements

- Renderer is a pure function of its input (no DB access inside) → unit-testable; DB fetch + auth happen in the route.
- No caching (`Cache-Control: no-store`) — invoices change and the endpoint is authenticated.
- No secrets in code; Zod validation of route params; output is a binary download (XSS-safe by construction).

## Acceptance Criteria

1. Given a complete invoice, `GET /api/invoices/<id>/pdf` returns a valid PDF (`%PDF-` magic bytes) with correct headers and filename.
2. The PDF shows logo (when present), business details, client, items, tax/discount/totals in invoice currency with ISO prefix, due date, payment terms.
3. A DRAFT invoice's PDF carries the DRAFT watermark; a SENT invoice's does not.
4. A profile without a logo produces a valid PDF without the logo block.
5. Requesting another user's invoice returns 404; unauthenticated returns 401; garbage id returns 400.
6. "Email client" opens a prefilled mailto: draft with correct subject and summary body.
7. Playwright E2E asserts download response headers + PDF magic bytes; unit tests cover the renderer (watermark, missing logo, multi-page flow) at >80% module coverage.
8. `pnpm biome check`, `tsc --noEmit`, `test:all`, `build` all green before push.

## Out of Scope

- Server-side email sending, attachments in the draft, overdue reminder emails (Phase 2)
- Multiple PDF templates / user-template selection (Phase 2)
- FX-converted totals display (FX track — `fxRate` fields untouched here)
- PDF pagination themes, per-profile paper size, PDF/A compliance
