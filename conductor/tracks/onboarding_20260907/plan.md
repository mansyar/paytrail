# Plan — Onboarding: Business Profile (onboarding_20260907)

Follows `conductor/workflow.md`. Logic-bearing code (Zod schemas, validation, gate logic, rate-rule mutations) is test-first; UI is verified via E2E + manual walkthrough. Each phase ends with a verification checkpoint per the workflow protocol.

## Phase 1: Data Model & Validation Schemas [checkpoint: b089c13]

- [x] Task: Write failing Vitest tests for shared Zod schemas (profile fields, ISO 4217 currency, money/percent formats, rate-rule rows, logo size/type); confirm RED
- [x] Task: Prisma migration — `BusinessProfile` (1:1 User, cascade) + `RateRule` models; regenerate client *(implementation to make tests GREEN)*
- [x] Task: Shared Zod schemas in `src/lib/` + currency constant list; GREEN + coverage
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Onboarding Gate [checkpoint: b1cdbb1]

- [x] Task: Server-side profile-completion check helper in `src/lib/` (session-scoped) + failing tests; confirm RED
- [x] Task: Wire gate — `/dashboard` redirects to `/onboarding` when incomplete; `/onboarding` redirects to `/dashboard` (or `next` param) when complete; GREEN
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Onboarding Wizard UI [checkpoint: 1ea21e5]

- [x] Task: `/onboarding` 3-step wizard shell (progress steps, RHF + Zod, mobile 390px)
- [x] Task: Step forms — Business identity (logo file → base64 preview, size/type limits), Financial defaults (currency select, tax rate, payment terms), Rate rules (repeatable rows)
- [x] Task: Server action — persist profile + rules in one transaction, re-validate via shared schemas, set `onboardingCompleted`
- [x] Task: Phase Verification & Checkpoint (manual browser walkthrough) (Refer to workflow.md)

## Phase 4: Profile Editing

- [x] Task: Failing tests for rate-rule CRUD server actions (user-scoped, Zod-validated); confirm RED *(bfb2cfa)*
- [x] Task: `/profile` page reusing wizard sections; rate-rule add/edit/remove/reorder; logo replace; GREEN *(b0deec5)*
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5: E2E & Review Gate

- [ ] Task: Playwright E2E — signup → onboarding (all 3 steps) → dashboard → profile edit → logout; mobile viewport spot-check
- [ ] Task: Full local review gate (Biome, `tsc --noEmit`, `vitest run --coverage`, `pnpm build`) + self-review against product-guidelines
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
