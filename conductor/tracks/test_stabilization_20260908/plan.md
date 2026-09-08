# Plan — Test Suite Stabilization & CI Hardening

## Phase 1: E2E Stability

- [x] Task: Extract shared E2E helpers and fix drifted specs (eb4980e)
	- [x] Create `e2e/utils.ts` with `uniqueEmail()`, shared `password`, single `signUp(page, opts)`, `signUpToProfile()`, retry helpers (`openAddClientDialog`, `openClientDetail`)
	- [x] Update `auth.spec.ts`, `clients.spec.ts`, `onboarding.spec.ts`, `profile-rate-rules.spec.ts` to use shared helpers
	- [x] Fix `clients.spec.ts` post-signup expectation to `/onboarding`
	- [x] Verify: `pnpm test:e2e` green against current dev server (baseline)
- [x] Task: Fix wizard ghost-click bug and remove timeout workarounds (red/green: spec assertions written first, wizard fix makes them pass) (90be032)
	- [x] Replace `waitForTimeout` pacing in `onboarding.spec.ts` + `profile-rate-rules.spec.ts` with auto-retrying assertions
	- [x] Disable Next/Finish buttons during step transitions in `onboarding-wizard.tsx`
	- [x] Verify: rapid-click manual check + E2E green
- [x] Task: Production-build webServer + failure diagnostics (7f7c756)
	- [x] `playwright.config.ts`: webServer → `next build && next start` (prod default), opt-in dev flag, keep `PLAYWRIGHT_PORT`/`reuseExistingServer`
	- [x] Add `trace: "retain-on-failure"`, `screenshot: "only-on-failure"`
	- [x] Verify: full E2E suite green against prod build
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Vitest Hygiene

- [x] Task: Split unit/integration Vitest projects (aad6cee)
	- [x] Convert `vitest.config.mts` to `test.projects`: `unit` (node env, no DB), `integration` (node env, DB suites, `fileParallelism: false`)
	- [x] Add `describe.skipIf(!process.env.DATABASE_URL)` to DB suites
	- [x] Replace hardcoded `TEST_USER_ID` in `onboarding.test.ts` with unique-id helper
	- [x] Scripts: `test` → unit, `test:integration` → integration, `test:all` → both
	- [x] Verify: `pnpm test` passes with Postgres stopped
- [x] Task: Config + dependency cleanup (24895d3)
	- [x] Remove no-op `resolve.tsconfigPaths` from `vitest.config.mts`
	- [x] Remove `@testing-library/react`, `@testing-library/dom`, `jsdom` deps + jsdom config
	- [x] Add `"db:setup"` script
	- [x] Verify: `pnpm install`, lint, typecheck, full suites green
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: CI / Release Hardening

- [x] Task: CI — E2E gate + concurrency (e85d614)
	- [x] Add Playwright job to `ci.yml` on every PR (chromium install, prod-build webServer, upload `playwright-report/` + `test-results/` on failure)
	- [x] Add `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`
	- [x] Verify: push branch, observe PR checks green (or validate YAML + workflow syntax)
- [x] Task: Release — test gate + layer caching (633fc67)
	- [x] Add `verify` job (lint + typecheck + unit tests) to `release.yml`; `release` job `needs: verify`
	- [x] Add `cache-from: type=gha` / `cache-to: type=gha,mode=max` to `build-push-action`
	- [x] Verify: YAML valid; workflow syntax check
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Documentation & Closure

- [ ] Task: Document decisions
	- [ ] Dated testing notes in `tech-stack.md` (dep removal, prod-build webServer default, project split)
	- [ ] Update `conductor/workflow.md` dev commands if test script names changed
- [ ] Task: Final local review gate (`biome ci`, `tsc --noEmit`, `test:all`, `pnpm build`) + PR
	- [ ] Push `test/stabilize-suites`, open PR, confirm all CI jobs (incl. E2E) green, merge
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
