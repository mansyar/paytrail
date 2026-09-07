# Plan: Rate Table Management UI

## Phase 1: Duplicate-guard logic + server actions (TDD)
- [ ] Task: Write failing tests for unique-keyword guard (Red Phase)
  - Add cases covering `assertUniqueKeyword(userId, keyword, excludeId?)`: rejects case-insensitive duplicates for the user, allows the rule's own keyword on update, allows unique keywords, errors on conflict.
- [ ] Task: Implement unique-keyword guard in `src/lib/rate-rules.ts` (Green Phase)
  - Case-insensitive duplicate check scoped to `userId`, excluding the rule being edited.
- [ ] Task: Implement rate-table server actions (`src/app/rate-table/actions.ts`)
  - Thin wrappers over `addRateRule` / `updateRateRule` / `deleteRateRule` / `reorderRateRules` + the new guard; session retrieved server-side; Zod validation via `rateRuleInputSchema`/`rateRuleSchema`; typed error results (duplicate, invalid input, not found).
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: /rate-table page UI
- [ ] Task: Create `/rate-table` route (server component)
  - Session verification (redirect unauthenticated → `/login`), load rules ordered by `sortOrder`, pass to client component; add nav link from dashboard.
- [ ] Task: Build inline-editing table client component
  - MUI table: inline keyword/rate editing (decimal input), "Add rule" append, up/down reorder buttons with edge disabling, two-click delete confirm (Confirm/Cancel with timeout), empty-state inline CTA, inline field errors (duplicate/invalid), saving/loading states.
- [ ] Task: Manual verification pass — desktop + mobile 390px viewport (Refer to workflow.md)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: E2E + review gate
- [ ] Task: Playwright e2e spec (`e2e/rate-table.spec.ts`)
  - Full lifecycle: add → edit → reorder → delete; duplicate rejection visible; unauthenticated redirect; desktop + mobile viewports.
- [ ] Task: Local review gate — Biome, `tsc --noEmit`, `vitest run`, `pnpm build`, self-review vs product-guidelines + security checklist (Refer to workflow.md)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
