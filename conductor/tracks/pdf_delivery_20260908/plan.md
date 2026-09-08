# Plan: PDF Generation & Delivery

Branch: `feat/pdf-generation-delivery`

## Phase 1: PDF renderer module (logic-bearing — TDD)

- [x] Task: Write failing renderer tests (Red) — sha 5a296ef
	- [x] New `src/lib/invoice-pdf.test.ts`: valid PDF magic bytes; contains invoice number, client name, ISO-prefixed total (e.g. `USD 1,234.50`); DRAFT watermark present for DRAFT and absent for SENT; missing logo renders without error; many items (25+) flow across pages without throw
	- [x] Run `pnpm vitest run` — confirm failures
- [x] Task: Implement renderer to pass (Green) — sha 5a296ef
	- [x] `src/lib/invoice-pdf.ts`: pdfkit A4 template — header (logo decode/skip, business name/address/tax ID), meta block (number, issue/due date, status), client block, items table with page-flow + repeated column header, totals block on final page (subtotal, tax, discount, total), payment terms
	- [x] ISO-code-prefix currency formatting via `formatMoneyIso` helper; integer minor units throughout; totals math reused from `computeInvoiceTotals`
- [x] Task: Refactor + coverage check — 97% stmts / 100% funcs / 97% lines on `invoice-pdf.ts`; 115 unit tests pass — sha 5a296ef
- [ ] Task: Commit `feat(invoices): pdf renderer module with watermark and ISO currency totals` + git note + plan update
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: PDF route handler (logic-bearing — TDD)

- [x] Task: Write failing tests for the route's logic (Red) — sha cb14628
	- [x] `src/lib/invoice-pdf-mapper.test.ts`: user-scoped fetch of the full aggregate (invoice + items + client + project + business profile); 404 on other user's invoice / missing; 400 on malformed id; filename derived from `invoiceNumber` — mapper logic unit-tested (5 tests); route auth/scope exercised by E2E in Phase 4
	- [x] Run tests — confirm failures
- [x] Task: Implement (Green) — sha cb14628
	- [x] Aggregate mapping in `invoice-pdf-mapper.ts` (pure; session-scoped fetch via `getInvoice` + profile/project in route)
	- [x] `src/app/api/invoices/[id]/pdf/route.ts`: session guard → 401; `invoiceIdSchema` Zod validation → 400; scope check → 404; response with `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="<number>.pdf"`, `Cache-Control: no-store`
	- [x] `next.config.ts`: `serverExternalPackages: ["pdfkit"]` (runtime AFM font files)
- [x] Task: Refactor + verify Zod on external input, ownership guard per quality gates — sha cb14628
- [ ] Task: Commit `feat(invoices): authenticated pdf download route` + git note + plan update
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Detail page actions (UI + small logic)

- [ ] Task: mailto builder — logic-bearing (Red → Green)
	- [ ] Failing tests: `src/lib/invoice-email-draft.test.ts` — subject `Invoice <number> from <businessName>`, concise body (greeting, number, total, due date, payment terms), URL-encoded mailto href
	- [ ] Implement `src/lib/invoice-email-draft.ts`
- [ ] Task: Detail page UI (manual + E2E verified)
	- [ ] "Download PDF" button (anchor to route, all statuses, both draft & read-only views)
	- [ ] "Email client" button (mailto: href); terse labels, ≥44px targets, 390px-safe
- [ ] Task: Commit `feat(invoices): download and email actions on invoice detail` + git note + plan update
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: E2E, docs, and pre-push gate

- [ ] Task: Playwright E2E — download response headers + PDF magic bytes; DRAFT vs SENT watermark via unit-covered renderer; mobile viewport pass
- [ ] Task: Update tech-stack.md notes if any deviations surfaced (pdfkit specifics)
- [ ] Task: Full local review gate — `pnpm biome check --write .`, `tsc --noEmit`, `test:all`, `build`
- [ ] Task: Push, open PR, merge after green CI
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
