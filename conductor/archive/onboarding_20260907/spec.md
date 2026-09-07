# Spec — Onboarding: Business Profile (onboarding_20260907)

## Overview

Implement guided, one-time business-profile onboarding: a 3-step wizard that captures the freelancer's business identity, financial defaults, and initial rate-table keyword rules. The profile becomes the foundation every future invoice pre-fills from. Onboarding is a **mandatory gate** — the dashboard is unreachable until the profile is complete — and the profile remains editable afterwards via a profile page.

## Functional Requirements

### 1. Data Model (Prisma)

- New `BusinessProfile` model, 1:1 with `User` (userId unique, cascade delete): business name (required), address lines, contact email, tax ID, logo (base64 text, nullable), home currency (ISO 4217 code), default tax rate, payment terms, onboarding-completed flag.
- New `RateRule` model: keyword (required), flat rate (required), scoped to the owning user, ordered (display order), cascade delete with profile.

### 2. Onboarding Wizard (`/onboarding`)

- 3 steps with progress indication: **Business identity** (name, address, email, tax ID, logo) → **Financial defaults** (home currency select — fixed ISO 4217 list, default tax rate, payment terms) → **Initial rate rules** (repeatable keyword + flat-rate rows, at least one row encouraged but can skip).
- React Hook Form + Zod per step; shared Zod schemas re-used server-side.
- Logo upload: client-side file → base64, preview, size-limited (≤ 500 KB, PNG/JPEG).
- Completion saves profile + rules in one server action; sets `onboardingCompleted`.

### 3. Mandatory Gate

- Server-side check (dashboard page + `/onboarding`): authenticated user without completed profile → redirect `/onboarding`; completed profile hitting `/onboarding` → redirect `/dashboard` (or `next` param target after completion).

### 4. Profile Editing

- `/profile` page with the same sections/forms for editing all fields (including rate-rule CRUD: add, edit, remove, reorder) after onboarding.
- Rate-rule mutations are user-scoped server actions (session-user filter — workflow security invariant).

### 5. Validation (Zod, client + server)

- Required: business name, home currency. Optional: address, contact email, tax ID, logo, payment terms.
- Default tax rate: non-negative percent; flat rates: non-negative decimal strings; currency: must match ISO list.
- Server actions re-validate ALL input with the same Zod schemas.

## Non-Functional Requirements

- Mobile-usable at 390px (wizard steps short, touch targets ≥ 44px).
- Logic-bearing modules unit-tested; > 80% coverage for new `src/lib/` modules.
- All queries/mutations filtered by session user id.

## Acceptance Criteria

1. New signup → redirected to `/onboarding`; cannot reach `/dashboard` until completion.
2. Wizard completes → profile + rate rules persisted; dashboard reachable; re-visiting `/onboarding` redirects to dashboard.
3. `/profile` edits (including logo replace and rate-rule add/remove) persist and are enforced as user-scoped.
4. Invalid input (missing name, bad currency, negative rate, oversized logo) rejected on both client and server.
5. Local review gate green: Biome, `tsc --noEmit`, Vitest (>80% on new lib modules), build; Playwright E2E for signup → onboarding → dashboard → profile edit.

## Out of Scope

- Live FX API + rate caching/snapshotting (separate track)
- Full rate-table matching engine used by screenshot ingestion (pricing engine track; onboarding only stores rules)
- Client/Project/Invoice models, PDF, reports, settings branding beyond profile fields
