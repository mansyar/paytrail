# Plan: FX Snapshot + Multi-Currency (fx_multi_currency_20260908)

Branch: `feat/fx-snapshot-multi-currency` · Spec: [spec.md](./spec.md)

## Phase 1: Data model + FX rate service [checkpoint: c45da0f]

- [x] Task: Add FxRate Prisma model + migration (69025ef)
  - [x] Add `FxRate` model to `prisma/schema.prisma` (unique `(baseCurrency, quoteCurrency)`, `rate Decimal(18,8)`, `fetchedAt`, `source`)
  - [x] Run `pnpm exec prisma migrate dev` and commit migration; verify existing invoice rows untouched (`fxRate` still null)
- [x] Task: FX provider client — TDD red → green (bcf98bc)
  - [x] Write failing unit tests: Zod-validated parsing of a mocked open.er-api.com payload (success shape, `result !== "success"`, malformed/absent rates, non-positive rates rejected)
  - [x] Run tests, confirm red
  - [x] Implement `src/lib/fx/provider.ts` (injectable fetch, ≤5s timeout, validated rates map); run tests, confirm green
- [x] Task: FX rate service — TDD red → green (31e672e)
  - [x] Write failing unit tests for `getRate`: same-currency → 1 (no fetch); fresh cache → no fetch; stale (>24h) → refetch + upsert full payload; fetch failure → last cached rate (any age); empty cache + failure → null
  - [x] Run tests, confirm red
  - [x] Implement `src/lib/fx/rate-service.ts` (lazy 24h TTL, batch upsert, invoice→home derivation `1 / rates[quote]`); run tests, confirm green
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Invoice snapshot integration [checkpoint: f7d0d84]

- [x] Task: Snapshot semantics in invoices-repo — TDD red → green (69f64b6)
  - [x] Write failing tests: draft created with non-home-currency client stamps `fxRate` + `fxRateCurrency`; draft currency change re-derives snapshot; `sendInvoice` freezes (no refetch/mutation); manual override stamps flagged value; missing-rate case leaves `null`
  - [x] Run tests, confirm red
  - [x] Implement snapshotting in `src/lib/invoices-repo.ts` via rate service; run tests, confirm green
- [x] Task: Manual-override server action — TDD red → green (4b13a92)
  - [x] Write failing tests for action-level validation: Zod output schema (positive decimal, sane bound), draft-only guard, session-user scoping
  - [x] Run tests, confirm red
  - [x] Implement `setInvoiceFxRate` action in `src/lib/invoices-actions.ts`; run tests, confirm green
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: UI wiring (no unit tests; manual + E2E verified) [checkpoint: 700abea]

- [x] Task: Invoice builder rate field + manual override (e95404c)
  - [x] Show effective rate (source-aware) when client currency ≠ home; editable field prefilled with effective rate on DRAFT invoices
  - [x] Wire save to `setInvoiceFxRate` action; inline error states for invalid input / missing rate prompt
- [x] Task: Home-currency equivalent display (e95404c)
  - [x] Invoice list + detail: `≈ {home total} @ {rate} {home}` when invoice currency ≠ home AND snapshot exists; nothing otherwise
  - [x] Reuse `money-format` helpers for home-currency formatting
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: E2E + closeout [checkpoint: 8ddef7f]

- [x] Task: Playwright E2E for non-home-currency invoice (595ac5b)
  - [x] Test: create + send invoice for non-home-currency client; assert home-currency equivalent visible on list/detail; run `pnpm test:e2e`
- [x] Task: Final review gate + docs
  - [ ] Self-review diff vs product-guidelines.md + code_styleguides (session scoping, Zod, mobile 390px)
  - [ ] Update tech-stack.md notes (FX provider decision, dated) — required by workflow principle #2
  - [x] Run full pre-push suite: `pnpm biome check --write .`, `pnpm exec tsc --noEmit`, `pnpm test:all`, `pnpm build`
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)


## Phase: Review Fixes

- [x] Task: Apply review suggestions (e5718cc)
  - [x] Concurrent fxRates resolution on new/[id] pages (Promise.all instead of serial awaits)
  - [x] Rethrow non-provider errors in getRate (FxProviderError-wrapped payload gaps still fall back) + regression test
  - [x] INVALID_STATE reason for InvoiceValidationError in toErrorResult
  - [x] Documented display-only float math on home-equivalent previews
