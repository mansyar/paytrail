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

- [ ] Task: Split unit/integration Vitest projects
	- [ ] Convert `vitest.config.mts` to `test.projects`: `unit` (node env, no DB), `integration` (node env, DB suites, `fileParallelism: false`)
	- [ ] Add `describe.skipIf(!process.env.DATABASE_URL)` to DB suites
	- [ ] Replace hardcoded `TEST_USER_ID` in `onboarding.test.ts` with unique-id helper
	- [ ] Scripts: `test` → unit, `test:integration` → integration, `test:all` → both
	- [ ] Verify: `pnpm test` passes with Postgres stopped
- [ ] Task: Config + dependency cleanup
	- [ ] Remove no-op `resolve.tsconfigPaths` from `vitest.config.mts`
	- [ ] Remove `@testing-library/react`, `@testing-library/dom`, `jsdom` deps + jsdom config
	- [ ] Add `"db:setup"` script
	- [ ] Verify: `pnpm install`, lint, typecheck, full suites green
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: CI / Release Hardening

- [ ] Task: CI — E2E gate + concurrency
	- [ ] Add Playwright job to `ci.yml` on every PR (chromium install, prod-build webServer, upload `playwright-report/` + `test-results/` on failure)
	- [ ] Add `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`
	- [ ] Verify: push branch, observe PR checks green (or validate YAML + workflow syntax)
- [ ] Task: Release — test gate + layer caching
	- [ ] Add `verify` job (lint + typecheck + unit tests) to `release.yml`; `release` job `needs: verify`
	- [ ] Add `cache-from: type=gha` / `cache-to: type=gha,mode=max` to `build-push-action`
	- [ ] Verify: YAML valid; workflow syntax check
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Documentation & Closure

- [ ] Task: Document decisions
	- [ ] Dated testing notes in `tech-stack.md` (dep removal, prod-build webServer default, project split)
	- [ ] Update `conductor/workflow.md` dev commands if test script names changed
- [ ] Task: Final local review gate (`biome ci`, `tsc --noEmit`, `test:all`, `pnpm build`) + PR
	- [ ] Push `test/stabilize-suites`, open PR, confirm all CI jobs (incl. E2E) green, merge
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
