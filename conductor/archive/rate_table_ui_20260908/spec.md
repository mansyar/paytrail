# Spec: Rate Table Management UI

> **Deviation note (2026-09-08, during implementation):** Discovery revealed `/profile` already ships a working rate-rules editor (inline edit, reorder, delete) in `profile-editor.tsx`, backed by shared server actions in `profile/actions.ts`. The user approved pivoting the track to *polishing the existing UI* instead of building a duplicate standalone `/rate-table` page. Spec below amended accordingly; original standalone-page requirements struck.

## Overview

Full management of the user's keyword → flat-rate rules through the existing inline-editing rate-rules UI on the `/profile` page (`profile-editor.tsx`), wired to the tested `src/lib/rate-rules.ts` layer. This track adds the missing safety and clarity features: duplicate-keyword rejection, two-click delete confirmation, and currency-formatted rate display.

## Functional Requirements

1. **Page & access:** unchanged — management lives on `/profile` (already session-gated server-side). No new route.
2. **Table display:** existing list UI stays; **rate field gains a currency-code adornment** (the user's home currency, already available in `initialProfile.currency`).
3. **Add rule:** unchanged (blank row append via `addRateRuleAction`).
4. **Inline editing:** unchanged (save-on-blur via `updateRateRuleAction`).
5. **Rate input:** unchanged — decimal amount validated/converted by the existing `rateRuleSchema` transform in every server action.
6. **Duplicate keywords:** **new** — `updateRateRuleAction` calls the new `assertUniqueKeyword` guard (case-insensitive, user-scoped, excluding the edited rule) and returns a distinct inline error message when a duplicate exists.
7. **Reorder:** unchanged (up/down buttons via `reorderRateRulesAction`).
8. **Delete:** **new** — two-click inline confirm in the profile editor: first click switches the row's delete button into a "Confirm delete? [Confirm] [Cancel]" state (auto-cancels after a few seconds); `deleteRateRuleAction` fires only on Confirm.
9. **Empty state:** unchanged — "Add rate rule" button already serves as the CTA.
10. **Errors:** duplicate and validation failures surface as user-friendly inline messages (existing alert pattern).

## Non-Functional Requirements

- Server actions filter strictly by session user id (ownership enforced in lib, verified server-side).
- All external input Zod-validated (transform-free input schema for forms, transforming output schema server-side).
- Usable at mobile viewport 390px — touch targets ≥44px, no horizontal scroll.
- No new dependencies.

## Acceptance Criteria

- Editing a rule to a keyword that duplicates another of the user's rules (case-insensitive) is rejected with a clear inline error; editing a rule to its own keyword succeeds.
- Delete requires a second confirming click; Cancel or timeout aborts the deletion.
- Rate field visibly shows the user's home currency.
- Vitest covers the duplicate-guard lib path (>80% coverage for touched `src/lib/` modules).
- Playwright e2e covers the lifecycle on `/profile`: add → edit → duplicate rejected → reorder → delete (with confirm).
- Biome, `tsc --noEmit`, `vitest run`, and `pnpm build` all pass.

## Out of Scope

- Standalone `/rate-table` route (dropped in the 2026-09-08 pivot), bulk import/export, per-rule currency, drag-and-drop, client/project assignment to rules, pricing-engine changes.
