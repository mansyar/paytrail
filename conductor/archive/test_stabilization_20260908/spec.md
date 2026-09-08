# Spec — Test Suite Stabilization & CI Hardening

## Overview

The test suite is architecturally sound (unit → DB integration → E2E) but has structural defects that undermine trust in it: a likely-failing `clients.spec.ts` from drifted, copy-pasted E2E helpers; E2E flakes caused by running against `next dev` and `waitForTimeout` pacing around a real wizard bug; a Vitest suite with a hidden Postgres dependency; a no-op config key; unused testing deps; and pipeline gaps (no E2E in CI, unguarded release path, no docker caching). This track makes all three test layers genuinely stable and turns CI into a gate that stays green.

**Decisions locked during planning (2026-09-08):**

- Track type: Chore
- Playwright webServer: production build (`next build && next start`) as default everywhere — local and CI; dev server as opt-in flag
- Testing deps (`@testing-library/react`, `@testing-library/dom`, `jsdom`): removed until component tests are actually written
- Branch: reuse existing `test/stabilize-suites`
- Single PR for the whole track
- E2E runs in CI on every PR
- Wizard ghost-click: fix the component AND remove the spec workarounds
- E2E data cleanup (item #11): out of scope

## Functional Requirements

### A. E2E stability

1. Extract shared E2E helpers into `e2e/utils.ts`: `uniqueEmail()`, shared `password`, a single `signUp()` (explicit post-signup destination per spec), `signUpToProfile()`, hydration-retry helpers (`openAddClientDialog`, `openClientDetail`). Replace all four local copies (`auth`, `clients`, `onboarding`, `profile-rate-rules`).
2. Fix the stale expectation in `clients.spec.ts` (signup lands on `/onboarding`, not `/dashboard`) — verified against actual app behavior (signup → `/dashboard` push → onboarding gate redirect).
3. Fix the onboarding wizard ghost-click bug at the root in `onboarding-wizard.tsx`: disable Next/Finish buttons during step transitions (instead of swallowing clicks).
4. Remove all `waitForTimeout` workarounds from `e2e/`; replace with auto-retrying assertions (`await expect(...).toBeVisible()`).
5. Change `playwright.config.ts` webServer default to a production build (`next build && next start`), local and CI alike; dev server available via opt-in flag for debugging; keep `reuseExistingServer` and `PLAYWRIGHT_PORT` override.
6. Add `trace: "retain-on-failure"` and `screenshot: "only-on-failure"`.

### B. Vitest hygiene

7. Split into `test.projects`: `unit` (node env, no DB dependency, runs via `pnpm test`) and `integration` (node env, DB suites, `fileParallelism: false`, runs via `test:integration`; `test:all` runs both). Add `describe.skipIf(!process.env.DATABASE_URL)` to DB suites.
8. Replace the hardcoded seed user id in `onboarding.test.ts` with the unique-id pattern used elsewhere.
9. Fix the no-op `resolve: { tsconfigPaths: true }` in `vitest.config.mts` (remove; no aliases currently needed in tests).
10. Remove unused deps: `@testing-library/react`, `@testing-library/dom`, `jsdom` (and jsdom from test config).
11. Add `"db:setup": "docker compose up -d db && pnpm exec prisma migrate deploy"`.

### C. CI / Release hardening

12. `ci.yml`: add Playwright E2E job against the production build on **every PR** (install chromium, upload `playwright-report/` + `test-results/` on failure); add `concurrency` group (`ci-${{ github.ref }}`, cancel-in-progress).
13. `release.yml`: add a `verify` job (lint + typecheck + unit tests) gating the release job; add GHA docker layer caching (`cache-from`/`cache-to: type=gha,mode=max`).

## Non-Functional Requirements

- No changes to application behavior except the wizard transition fix.
- Workflow compliance: TDD where logic-bearing code changes; conventional commits; local review gate (`biome`, `tsc --noEmit`, `vitest run`, `pnpm build`) before push.
- Coverage discipline on `src/lib/` (>80%) must not regress; `*-actions.ts` exclusion stands.
- CI runtime stays reasonable: parallel jobs, cached installs, E2E limited to chromium + chromium-mobile projects (as today).

## Acceptance Criteria

- [ ] `pnpm test` (unit) passes with **no database running**; `pnpm test:integration` passes against a migrated Postgres; `pnpm test:all` green.
- [ ] `pnpm test:e2e` is green locally against the production build — all 5 specs, no `waitForTimeout` remaining, one shared `signUp` definition.
- [ ] CI runs lint → typecheck → unit → integration → build → **E2E** on every PR; superseded runs cancel.
- [ ] A `v*` tag on a commit failing `verify` cannot build/push/migrate.
- [ ] Release image builds reuse GHA cache layers.
- [ ] `tsc --noEmit`, `biome ci`, coverage threshold all green; unused deps gone from `package.json`.

## Out of Scope

- Component testing setup (revisit when component tests are actually written).
- E2E test-data cleanup / `globalTeardown` truncation (item #11) — deferred until E2E targets a persistent DB.
- Any product feature work; migration or schema changes; changes to the release deploy mechanism (Coolify webhook flow) beyond the added gate and caching.
