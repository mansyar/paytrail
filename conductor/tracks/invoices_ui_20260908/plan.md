# Implementation Plan — Invoice Builder UI (invoices_ui_20260908)

Branch: `feat/invoice-builder-ui`

### Phase 1 — Logic Glue: Units, Suggestions, Derived Status (TDD) [checkpoint: 86f780f]
- [x] Task: Write failing tests for decimal-input → integer minor-units conversion helper (parsing, rounding, negative/invalid input) — `b5d8e68`
- [x] Task: Write failing tests for rate-rule suggestion mapping (description + rules → matched suggestion with rule cue; no match → null; user override untouched) — `b5d8e68`
- [x] Task: Implement `src/lib/` helpers to pass tests (reuse `pricing-engine` matching; no new data-layer logic) — `b5d8e68`
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

### Phase 2 — `/invoices` List Page (Status Hub) [checkpoint: ef395b4]
- [x] Task: List server page + user-scoped data load via `listInvoices`, newest-first — `6251357`
- [x] Task: Status chips incl. derived OVERDUE; status filter chips + text search (client name / invoice number) — `6251357`
- [x] Task: Row actions — Edit/Send/Mark Paid/Delete with confirmation dialogs; server-action errors surfaced as snackbars — `6251357`
- [x] Task: Responsive table→cards layout (390px), guided empty state, `error.tsx`/`loading.tsx` — `6251357`
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

### Phase 3 — Builder Form & Live Preview [checkpoint: d57a9e6]
- [x] Task: Builder routes `dcc0926` + RHF form with Zod input schemas; prefills (client→currency read-only, project scope, profile tax rate, dates, auto number via counter preview)
- [x] Task: Inline line-items editor `dcc0926` (add/remove/reorder, description + amount via minor-units helper, rate-rule auto-suggest cue)
- [x] Task: Adjustments block `dcc0926` (tax %, flat discount) + live totals bar via `invoice-totals`
- [x] Task: Live preview panel `dcc0926` (desktop side panel / mobile collapsible) rendering profile, logo, client, items, totals
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

### Phase 4 - Lifecycle Actions & Read-Only Mode [checkpoint: 80fe2da]
- [x] Task: Save draft (create/update) `c7eadac` with server re-validation; collision error surfaced inline
- [x] Task: Send action with lock `c7eadac`-explaining confirmation; transition to read-only view
- [x] Task: Read-only mode for SENT/PAID `c7eadac` (disabled inputs, status badge, Mark Paid for SENT); delete DRAFT
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

### Phase 5 - Dashboard Link, E2E & Review Gate [checkpoint: bf72155]
- [x] Task: Dashboard Invoices link with outstanding count badge ``7351382``
- [x] Task: Playwright critical-path E2E (dashboard → new invoice → suggestion → send) within <2 min / <10 clicks; desktop + mobile viewport checks ``7351382``
- [x] Task: Local review gate & docs (Biome, `tsc --noEmit`, coverage >80% on new lib modules, self-review vs guidelines) ``7351382``
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
