# Plan — Project Bootstrap (bootstrap_20260907)

Follows `conductor/workflow.md`. Logic-bearing-code test-first where applicable; the auth vertical slice is verified E2E-first (Playwright). Each phase ends with a verification checkpoint per the workflow protocol.

## Phase 1: Scaffold & Tooling

- [ ] Task: Scaffold Next.js 16 app — pnpm, App Router, Turbopack, TypeScript 7 strict (`typescript@^7`), `src/` structure, no `ignoreBuildErrors`
  - [ ] Install MUI v7 + Emotion; customized light theme per product guidelines
  - [ ] Install RHF + Zod; Biome + Vitest + Playwright with configs
  - [ ] `next-env.d.ts` gitignored; generated Next.js types in tsconfig `include`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Local Database & Prisma

- [ ] Task: `docker-compose.yml` — Postgres 17, no volumes, `restart: "no"`; `.env.example` + `.env` (DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL)
- [ ] Task: Prisma 7 setup — schema with Better Auth tables only (user, session, account, verification), client output `src/generated`, initial migration, DB singleton in `src/lib/`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Better Auth Integration

- [ ] Task: Root `src/lib/auth.ts` — Prisma adapter (postgresql), `emailAndPassword.enabled`, `nextCookies()` last in plugins
- [ ] Task: Route handler `app/api/auth/[...all]/route.ts` + React client `createAuthClient()` (better-auth/react)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Vertical Slice (E2E-First)

- [ ] Task: Write failing Playwright E2E `auth.spec.ts` (signup → login → dashboard → logout); confirm RED
- [ ] Task: `proxy.ts` route protection for `/dashboard` + redirect logic
- [ ] Task: `/signup`, `/login` pages (MUI, RHF + Zod); dashboard placeholder showing session user; sign-out
- [ ] Task: E2E GREEN + full local review gate (Biome, `tsc --noEmit`, Vitest, build)
- [ ] Task: Phase Verification & Checkpoint (manual browser walkthrough) (Refer to workflow.md)

## Phase 5: CI & Release Pipeline

- [ ] Task: `ci.yml` — PR: pnpm frozen install → Biome → `tsc --noEmit` → Vitest → next build
- [ ] Task: `Dockerfile` multi-stage (Node 24, standalone output) + `.dockerignore`
- [ ] Task: `release.yml` — on `v*` tag: Docker build → GHCR public → `prisma migrate deploy` → Coolify deploy API (bearer token secret; endpoint resolved from Coolify docs at implementation)
- [ ] Task: README — local dev workflow, env vars, release flow
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 6: Repository & Ship

- [ ] Task: Create public GitHub repo `paytrail`, add remote, push branch, open PR, CI green, merge to main
- [ ] Task: Tag `v0.1.0` → verify GHCR image published + Coolify deploy triggered
- [ ] Task: Track review (conductor-review) before close
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
