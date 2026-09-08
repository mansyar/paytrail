# Implementation Plan — Invoice Builder UI (invoices_ui_20260908)

Branch: `feat/invoice-builder-ui`

### Phase 1 — Logic Glue: Units, Suggestions, Derived Status (TDD)
- [x] Task: Write failing tests for decimal-input → integer minor-units conversion helper (parsing, rounding, negative/invalid input) — `b5d8e68`
- [x] Task: Write failing tests for rate-rule suggestion mapping (description + rules → matched suggestion with rule cue; no match → null; user override untouched) — `b5d8e68`
- [x] Task: Implement `src/lib/` helpers to pass tests (reuse `pricing-engine` matching; no new data-layer logic) — `b5d8e68`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

### Phase 2 — `/invoices` List Page (Status Hub)
- [ ] Task: List server page + user-scoped data load via `listInvoices`, newest-first
- [ ] Task: Status chips incl. derived OVERDUE; status filter chips + text search (client name / invoice number)
- [ ] Task: Row actions — Edit/Send/Mark Paid/Delete with confirmation dialogs; server-action errors surfaced as snackbars
- [ ] Task: Responsive table→cards layout (390px), guided empty state, `error.tsx`/`loading.tsx`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

### Phase 3 — Builder Form & Live Preview
- [ ] Task: Builder routes + RHF form with Zod input schemas; prefills (client→currency read-only, project scope, profile tax rate, dates, auto number via counter preview)
- [ ] Task: Inline line-items editor (add/remove/reorder, description + amount via minor-units helper, rate-rule auto-suggest cue)
- [ ] Task: Adjustments block (tax %, flat discount) + live totals bar via `invoice-totals`
- [ ] Task: Live preview panel (desktop side panel / mobile collapsible) rendering profile, logo, client, items, totals
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

### Phase 4 — Lifecycle Actions & Read-Only Mode
- [ ] Task: Save draft (create/update) with server re-validation; collision error surfaced inline
- [ ] Task: Send action with lock-explaining confirmation; transition to read-only view
- [ ] Task: Read-only mode for SENT/PAID (disabled inputs, status badge, Mark Paid for SENT); delete DRAFT
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

### Phase 5 — Dashboard Link, E2E & Review Gate
- [ ] Task: Dashboard Invoices link with outstanding count badge
- [ ] Task: Playwright critical-path E2E (dashboard → new invoice → suggestion → send) within <2 min / <10 clicks; desktop + mobile viewport checks
- [ ] Task: Local review gate & docs (Biome, `tsc --noEmit`, coverage >80% on new lib modules, self-review vs guidelines)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
