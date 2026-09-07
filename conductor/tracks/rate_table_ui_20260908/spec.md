# Spec: Rate Table Management UI

## Overview

A standalone `/rate-table` page giving the user full CRUD management of their keyword → flat-rate rules through an inline-editable MUI table. This gives the tested `src/lib/rate-rules.ts` layer its missing UI consumer and lets users maintain their pricing rules after onboarding.

## Functional Requirements

1. **Page & access:** `/rate-table`, server-verified session (same pattern as dashboard/profile); unauthenticated → redirect to `/login`. Linked from the dashboard navigation.
2. **Table display:** columns — # (order), Keyword, Rate (formatted from `rateMinor` using the user's home currency), and actions. Rows sorted by `sortOrder`.
3. **Add rule:** "Add rule" appends an empty editable row; keyword + decimal rate required. Saved via `addRateRule`.
4. **Inline editing:** keyword and rate are editable in place; changes save via `updateRateRule`.
5. **Rate input:** decimal amount (e.g., `25.50`) converted to integer `rateMinor` server-side via the existing `rateRuleSchema` transform; Zod output schema re-validated in every server action (existing input/output schema split).
6. **Duplicate keywords:** rejected — server action checks case-insensitive duplicates for the user and returns an inline field error.
7. **Reorder:** up/down arrow buttons per row call `reorderRateRules`; first/last rows disable the respective button.
8. **Delete:** two-click inline undo — first click puts the row into a "Confirm delete? [Confirm] [Cancel]" state for a few seconds; `deleteRateRule` fires only on Confirm.
9. **Empty state:** zero rules → table headers plus a single "Add your first rate rule" inline CTA row.
10. **Errors:** server-action failures surface as user-friendly inline messages; loading states during saves.

## Non-Functional Requirements

- Server actions filter strictly by session user id (ownership enforced in lib, verified server-side).
- All external input Zod-validated (transform-free input schema for forms, transforming output schema server-side).
- Usable at mobile viewport 390px — touch targets ≥44px, no horizontal scroll.
- No new dependencies.

## Acceptance Criteria

- Authenticated user can add, edit, reorder, and delete rules on `/rate-table`; changes persist and reflect in `sortOrder`.
- Duplicate (case-insensitive) keywords are rejected with a clear inline error.
- Unauthenticated access to `/rate-table` redirects to `/login`.
- Vitest covers the new server-action/validation paths (duplicate check, decimal→minor conversion); coverage >80% for touched `src/lib/` modules.
- Playwright e2e covers the lifecycle: add → edit → reorder → delete, at desktop + mobile viewport.
- Biome, `tsc --noEmit`, `vitest run`, and `pnpm build` all pass.

## Out of Scope

- Bulk import/export, per-rule currency (rules use home currency), drag-and-drop, client/project assignment to rules, any pricing-engine changes.
