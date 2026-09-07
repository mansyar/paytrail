# Spec — Pricing Engine: Keyword → Flat-Rate Matching (pricing_engine_20260907)

## Overview

A pure, deterministic TypeScript module in `src/lib/` that auto-prices task line items by matching task text against the user's `RateRule` keyword table (captured during onboarding). It is the pricing core the future screenshot-ingestion track will call to turn parsed Breezeway tasks into priced draft line items. No UI, no persistence — inputs in, priced results out.

## Functional Requirements

### 1. Public API (pure functions, `src/lib/pricing-engine.ts`)

- `priceTasks(tasks: string[], rules: RateRule[]): PricingResult[]` where each `PricingResult` is a discriminated union:
  - **Matched:** `{ status: "matched", input, rateMinor, ruleId, matchedKeyword }`
  - **Unmatched:** `{ status: "unmatched", input }`
- Matching is **case-insensitive substring**: the rule keyword matches if it occurs anywhere in the task text (after trimming input and case-folding both sides).
- **Tie-breaking:** when multiple rules match, the **longest keyword wins** (most specific rule); equal-length ties break by ascending `sortOrder`, then by stable input rule order.
- **No match:** reported explicitly as `status: "unmatched"` — no silent dropping, no placeholder price. The caller (future review UI) decides handling.

### 2. Inputs & Robustness

- Tasks: free text; empty/whitespace-only strings are still processed (result is unmatched — never throw).
- Rules: empty rule list → every task unmatched, no error.
- Duplicate keywords in rules are allowed; longest-then-sortOrder ordering resolves deterministically.
- Unicode case folding via `toLocaleLowerCase("en")` is acceptable (task data is employer-generated English task names); no regex-escaping issues since matching is plain string search.
- The engine never mutates inputs.

### 3. Data Contract

- `RateRule` shape consumed: `{ id, keyword, rateMinor, sortOrder }` (subset of the Prisma model — the engine takes plain objects, keeping it decoupled from the DB layer).
- No Zod validation inside the engine (pure domain function); validation of untrusted input happens at the calling boundary (future server action).

## Non-Functional Requirements

- **Deterministic:** same inputs → same outputs, no Date/random/network.
- **Test coverage >80%** on the new module, including edge cases: empty inputs, empty rules, overlapping keywords ("hot tub" vs "tub"), case variations ("Hot TUB" vs "hot tub"), multiple matches, tie-breaks, special characters.
- Performance is not a concern at expected scale (≤ hundreds of rules/tasks), but implementation must be a straightforward single pass (no premature optimization).

## Acceptance Criteria

1. `priceTasks` prices each task by the longest case-insensitive matching keyword; ties resolve by `sortOrder`.
2. Unmatched tasks return explicit `status: "unmatched"` results.
3. Empty task list and/or empty rule list produce empty/unmatched results without errors.
4. `pnpm vitest run --coverage` shows >80% coverage on the module; all existing tests still pass.
5. Module is pure: no imports of DB (`db.ts`), Next.js, or React.

## Out of Scope

- UI, server actions, endpoints, or persistence
- Screenshot ingestion / AI parsing (separate track)
- Invoice integration (line-item shape coupling)
- Rate-rule CRUD (already exists via onboarding/profile)
