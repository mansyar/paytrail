# Plan: FX Snapshot + Multi-Currency (fx_multi_currency_20260908)

Branch: `feat/fx-snapshot-multi-currency` · Spec: [spec.md](./spec.md)

## Phase 1: Data model + FX rate service

- [ ] Task: Add FxRate Prisma model + migration
  - [ ] Add `FxRate` model to `prisma/schema.prisma` (unique `(baseCurrency, quoteCurrency)`, `rate Decimal(18,8)`, `fetchedAt`, `source`)
  - [ ] Run `pnpm exec prisma migrate dev` and commit migration; verify existing invoice rows untouched (`fxRate` still null)
- [ ] Task: FX provider client — TDD red → green
  - [ ] Write failing unit tests: Zod-validated parsing of a mocked open.er-api.com payload (success shape, `result !== "success"`, malformed/absent rates, non-positive rates rejected)
  - [ ] Run tests, confirm red
  - [ ] Implement `src/lib/fx/provider.ts` (injectable fetch, ≤5s timeout, validated rates map); run tests, confirm green
- [ ] Task: FX rate service — TDD red → green
  - [ ] Write failing unit tests for `getRate`: same-currency → 1 (no fetch); fresh cache → no fetch; stale (>24h) → refetch + upsert full payload; fetch failure → last cached rate (any age); empty cache + failure → null
  - [ ] Run tests, confirm red
  - [ ] Implement `src/lib/fx/rate-service.ts` (lazy 24h TTL, batch upsert, invoice→home derivation `1 / rates[quote]`); run tests, confirm green
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Invoice snapshot integration

- [ ] Task: Snapshot semantics in invoices-repo — TDD red → green
  - [ ] Write failing tests: draft created with non-home-currency client stamps `fxRate` + `fxRateCurrency`; draft currency change re-derives snapshot; `sendInvoice` freezes (no refetch/mutation); manual override stamps flagged value; missing-rate case leaves `null`
  - [ ] Run tests, confirm red
  - [ ] Implement snapshotting in `src/lib/invoices-repo.ts` via rate service; run tests, confirm green
- [ ] Task: Manual-override server action — TDD red → green
  - [ ] Write failing tests for action-level validation: Zod output schema (positive decimal, sane bound), draft-only guard, session-user scoping
  - [ ] Run tests, confirm red
  - [ ] Implement `setInvoiceFxRate` action in `src/lib/invoices-actions.ts`; run tests, confirm green
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: UI wiring (no unit tests; manual + E2E verified)

- [ ] Task: Invoice builder rate field + manual override
  - [ ] Show effective rate (source-aware) when client currency ≠ home; editable field prefilled with effective rate on DRAFT invoices
  - [ ] Wire save to `setInvoiceFxRate` action; inline error states for invalid input / missing rate prompt
- [ ] Task: Home-currency equivalent display
  - [ ] Invoice list + detail: `≈ {home total} @ {rate} {home}` when invoice currency ≠ home AND snapshot exists; nothing otherwise
  - [ ] Reuse `money-format` helpers for home-currency formatting
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: E2E + closeout

- [ ] Task: Playwright E2E for non-home-currency invoice
  - [ ] Test: create + send invoice for non-home-currency client; assert home-currency equivalent visible on list/detail; run `pnpm test:e2e`
- [ ] Task: Final review gate + docs
  - [ ] Self-review diff vs product-guidelines.md + code_styleguides (session scoping, Zod, mobile 390px)
  - [ ] Update tech-stack.md notes (FX provider decision, dated) — required by workflow principle #2
  - [ ] Run full pre-push suite: `pnpm biome check --write .`, `pnpm exec tsc --noEmit`, `pnpm test:all`, `pnpm build`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
