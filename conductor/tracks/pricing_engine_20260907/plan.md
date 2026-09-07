# Plan — Pricing Engine (pricing_engine_20260907)

Follows `conductor/workflow.md`. The engine is logic-bearing domain code (rate-table matching is explicitly listed in workflow §Testing Requirements), so every phase is test-first. No UI → no E2E; verification is unit tests + coverage + the local review gate.

## Phase 1: Red — Failing Tests `[checkpoint: 22e01a7]`

- [x] Task: Write failing Vitest tests for `priceTasks` matching semantics — case-insensitive substring (trimmed input, case-folded keyword + text); confirm RED `[task: ae4360b]`
- [x] Task: Write failing Vitest tests for tie-breaking — longest keyword wins; equal length → ascending `sortOrder`; stable fallback to rule order; confirm RED `[task: 17b73e5]`
- [x] Task: Write failing Vitest tests for unmatched + edge cases — empty task list, empty rule list, whitespace-only task, overlapping keywords ("hot tub" vs "tub"), special characters, no input mutation; confirm RED `[task: 22e01a7]`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Green — Implement Engine `[checkpoint: 9f21a62]`

- [x] Task: Implement `src/lib/pricing-engine.ts` — pure module, discriminated-union `PricingResult`, longest-then-sortOrder matcher, single pass; no DB/Next/React imports; GREEN `[task: 9f21a62]`
- [x] Task: Refactor pass for clarity; rerun tests `[task: 9f21a62]`
- [x] Task: Coverage check — `pnpm vitest run --coverage` >80% on the new module `[task: 9f21a62]`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Review Gate

- [ ] Task: Full local review gate (`pnpm biome check --write .`, `pnpm exec tsc --noEmit`, `pnpm vitest run --coverage`, `pnpm build`) + self-review against `product-guidelines.md`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
