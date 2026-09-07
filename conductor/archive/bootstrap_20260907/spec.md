# Spec — Project Bootstrap (bootstrap_20260907)

## Overview

Establish the complete, verified technical foundation for PayTrail: full stack scaffolded and wired end-to-end, a thin auth vertical slice proving the stack integrates, PR CI and the tag-triggered release pipeline live, and the public GitHub repo established. Every future feature track builds on this verified base.

## Functional Requirements

### 1. Scaffold & Tooling

- Next.js 16 (App Router, Server Actions, Turbopack) + React 19.2 + TypeScript 7 strict via pnpm (`pnpm add -D typescript@^7`)
- **TS 7 is officially supported by Next.js 16**: `next build` type-checks via the project-local native `tsc` CLI by default — no extra config, `ignoreBuildErrors` must NOT be set (verified against nextjs.org TypeScript config docs, Sep 2026)
- Explicit `tsc --noEmit` retained as an independent CI + local pre-push check (officially recommended for CI)
- MUI v7 + Emotion, customized light theme per product guidelines; RHF + Zod for forms
- Biome (lint + format), Vitest, Playwright configured and runnable
- `next-env.d.ts` gitignored per official docs; generated Next.js types included in tsconfig

### 2. Local Database (non-persistent)

- `docker-compose.yml` running PostgreSQL 17: **no volumes, no restart policy** (`restart: "no"`)
- Workflow: `docker compose up -d` → `pnpm exec prisma migrate dev` → dev against fresh DB; `docker compose down` discards data (accepted)

### 3. Auth (Better Auth 1.7)

- Prisma schema: **Better Auth tables only** (user, session, account, verification); business models deferred to their feature tracks
- Prisma client generated to `src/generated`
- Root `src/lib/auth.ts` server instance: Prisma adapter, `emailAndPassword.enabled`, `nextCookies()` last in plugins
- Handler at `app/api/auth/[...all]/route.ts`; React client via `createAuthClient()`
- Env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`

### 4. Vertical Slice (auth, end-to-end)

- `/signup` and `/login` pages (MUI, RHF + Zod validation): real signup, login, logout
- `proxy.ts` protecting `/dashboard`; full session validation server-side (`auth.api.getSession`)
- Minimal dashboard placeholder showing the session user (proof of the protected route)

### 5. CI (GitHub Actions)

- On every PR: pnpm install (frozen lockfile) → `biome check` → `tsc --noEmit` → `vitest run` → `next build`

### 6. Release Pipeline (GitHub Actions, tag-triggered)

- On `v*` tag in `main`: multi-stage Docker build (Node 24, standalone output) → push to GHCR (**public**) → `prisma migrate deploy` → Coolify deploy API trigger (bearer token via GitHub secret; exact endpoint resolved at implementation from Coolify docs)

### 7. Repository

- Public GitHub repo **`paytrail`**, remote wired, feature branch → PR → merge with conventional commits

## Non-Functional Requirements

- All secrets via environment variables only; no hardcoded credentials
- README documents the full local dev workflow (compose up → migrate → dev)
- Pipeline statelessness: containers rebuildable from scratch (accepted non-persistent data loss)

## Acceptance Criteria

1. `docker compose up -d` + `prisma migrate dev` → `pnpm dev` serves the app; signup → login → dashboard → logout works in the browser
2. Local review gate passes: `biome check`, `tsc --noEmit`, `vitest run`, `pnpm build` all green
3. Playwright E2E: signup → login → dashboard → logout passes
4. CI green on the bootstrap PR
5. Pushing a `v0.1.0` tag → image appears in GHCR → Coolify deploy triggered successfully
6. Repo is public at `github.com/<user>/paytrail`; history uses conventional commits

## Out of Scope

- Client/Project/Invoice/Payment models & UI · onboarding flow · rate table · AI screenshot ingestion · PDF generation · FX rates · reports · settings · email/password reset · database backups (accepted risk) · Coolify/VPS provisioning itself (infra ready)
