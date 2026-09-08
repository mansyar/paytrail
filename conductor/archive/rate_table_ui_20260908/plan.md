# Plan: Rate Table Management UI

> **Amended 2026-09-08:** Discovery showed `/profile` already ships a rate-rules editor with shared server actions. Per user decision, the track pivots to polishing the existing UI (duplicate guard, delete confirm, currency adornment) instead of a standalone `/rate-table` page. See spec deviation note.

## Phase 1: Duplicate-guard logic + server actions (TDD)
- [x] Task: Write failing tests for unique-keyword guard (Red Phase) — `ffb7033`
  - Add cases covering `assertUniqueKeyword(userId, keyword, excludeId?)`: rejects case-insensitive duplicates for the user, allows the rule's own keyword on update, allows unique keywords, errors on conflict.
- [x] Task: Implement unique-keyword guard in `src/lib/rate-rules.ts` (Green Phase) — `ffb7033`
  - Case-insensitive duplicate check scoped to `userId`, excluding the rule being edited.
- [x] Task: Wire the duplicate guard into the shared rate-rule server actions (`src/app/profile/actions.ts`) — `5e33903`
  - `updateRateRuleAction` calls `assertUniqueKeyword(userId, keyword, ruleId)` before updating and returns a distinct "keyword already exists" message; other actions unchanged.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Profile rate-rules UI polish
- [x] Task: Add two-click delete confirmation in `profile-editor.tsx` — `e4d6b89`
  - First click swaps the row's delete button into Confirm/Cancel state; auto-cancel after a few seconds; `deleteRateRuleAction` only fires on Confirm.
- [x] Task: Show the home currency on the rate field — `e4d6b89`
  - MUI `InputAdornment` with the user's currency code (from `initialProfile.currency`) on the rate TextField.
- [ ] Task: Manual verification pass — desktop + mobile 390px viewport (Refer to workflow.md)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: E2E + review gate
- [x] Task: Playwright e2e spec (`e2e/profile-rate-rules.spec.ts`) — `9408bc6`
  - On `/profile`: add → edit → duplicate keyword rejected with visible error → reorder → delete (confirm + cancel paths).
- [x] Task: Local review gate — Biome, `tsc --noEmit`, `vitest run`, `pnpm build`, self-review vs product-guidelines + security checklist (Refer to workflow.md) — `9408bc6`

## Phase: Review Fixes
- [~] Task: Apply review suggestions
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
