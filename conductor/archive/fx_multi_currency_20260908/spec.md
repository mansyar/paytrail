# Spec: FX Snapshot + Multi-Currency

## Overview

Complete the v1 currency model: every invoice snapshots the FX rate used at creation so home-currency reporting never rewrites history. A new FX rate service fetches live rates from **open.er-api.com** (free tier, no API key), caches them server-side in Postgres with a lazy 24h TTL, and falls back to the last cached rate — with a per-invoice manual override — when the provider is unreachable. When a client's currency differs from the account's home currency, the invoice list and detail show the home-currency equivalent. This populates the schema fields reserved for exactly this track (`Invoice.fxRate`, `Invoice.fxRateCurrency`).

## Rate Semantics (canonical)

- `fxRate` = **multiplier converting invoice-currency amounts to home-currency amounts** (multiply). `fxRateCurrency` = the home currency code. Example: invoice in EUR, home USD, 1 EUR = 1.08 USD → `fxRate = 1.08`, `fxRateCurrency = "USD"`.
- Rates are fetched with **home currency as base** (`GET https://open.er-api.com/v6/latest/{home}`); the response's full rates payload is cached as one batch (one row per pair). The invoice→home multiplier is derived as `1 / rates[invoiceCurrency]` when invoice currency ≠ home; `1` when equal (no fetch, no snapshot needed).
- Provider responses are Zod-validated (`result === "success"`, positive numeric `rates` map) and the provider is behind a mockable client for tests.

## Functional Requirements

1. **FxRate model (new):** `baseCurrency`, `quoteCurrency`, `rate Decimal(18,8)`, `fetchedAt`, `source` (`"live"` | `"manual"` reserve for future use), unique on `(baseCurrency, quoteCurrency)`. Migration adds only this model — existing invoice rows are untouched and keep `fxRate = null`.
2. **Rate service (`src/lib/fx/`, logic-bearing, tested):**
   - `getRate(base, quote)`: same-currency → `1` without fetching; fresh cache (≤24h TTL) → cached rate; stale/missing → fetch full payload for base, upsert all pairs, return derived rate.
   - Fetch failure → use last cached rate regardless of age (product-mandated fallback). No cache at all and fetch failure → return `null`; callers handle the missing-rate case (see 5).
   - No scheduler; refresh is lazy on read.
3. **Snapshot timing (invoices-repo, logic-bearing, tested):**
   - Snapshot is stamped when a **draft** first has a currency different from the user's home currency (at creation, or when a client with a non-home currency is selected).
   - If a draft's currency changes while editable, the snapshot is **re-fetched/re-derived**.
   - **Frozen at SENT:** `sendInvoice` never refreshes or mutates the snapshot. PAID/OVERDUE likewise.
   - If no rate is available at snapshot time (fetch failed, no cache), `fxRate` stays `null` and the builder prompts for manual entry (see 4).
4. **Manual override:** on an editable (DRAFT) invoice with a non-home currency, the builder exposes the rate as an editable field prefilled with the current effective rate. Saving a manual value stamps `fxRate` with that value (validated: positive, sane upper bound) via a session-scoped, Zod-validated server action. A currency change replaces the manual rate with a fresh derived one.
5. **Display:** invoice list and invoice detail show `≈ {home-formatted total} @ {rate} {home}` **only when** invoice currency ≠ home currency and a snapshot exists. Invoices with `fxRate = null` (all pre-existing rows, and any missing-rate case) show no equivalent.
6. **Existing invoices:** untouched; `null` snapshot is treated as "no conversion info", never as rate 1 for display of non-home currencies.

## Non-Functional Requirements

- Provider calls are server-side only; no API key to manage; request timeout ≤5s so invoice flows never hang on the provider.
- All external input Zod-validated (provider payload, manual override input) — transform-free input schemas for forms, transforming output schemas re-validated server-side.
- Every server action resolves the session user and scopes queries by it.
- Usable at 390px mobile viewport (rate field and equivalents must not cause horizontal scroll).
- No new npm dependencies (global `fetch` only).
- Test coverage >80% on new/touched `src/lib/` modules; provider mocked in tests (never hit the network).

## Acceptance Criteria

- Creating an invoice for a client with non-home currency stamps `fxRate` + `fxRateCurrency`; sending the invoice freezes the snapshot (subsequent rate changes do not alter it).
- Changing a draft's currency re-derives the snapshot; a manual override persists until the currency changes.
- Killing the provider (mocked failure) falls back to the last cached rate; with an empty cache, snapshot is `null` and the builder prompts for manual entry.
- Invoice list/detail show the home-currency equivalent only for non-home currencies with a snapshot; existing invoices render exactly as before.
- Vitest covers provider parsing, TTL/fallback/derivation logic, and snapshot semantics; >80% coverage on touched `src/lib/` modules.
- Playwright E2E: create + send an invoice for a non-home-currency client; equivalent amount visible on list/detail.
- Biome, `tsc --noEmit`, `pnpm test:all`, and `pnpm build` all pass.

## Out of Scope

- Dashboard/home-currency revenue aggregation (later dashboard/reports tracks), Phase 2 reports & analytics.
- Historical FX time series, backfilling old invoices, scheduled refresh jobs.
- Partial payments, payment methods, currency of RateRules (rules stay in home currency), invoice templates.
