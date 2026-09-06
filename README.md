# PayTrail

Client and invoice manager for solo freelancers. Fastest path from work done to invoice sent: under 2 minutes and under 10 clicks from dashboard to a sent invoice.

## Stack

- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 7 (native tsc)
- MUI v9 · Emotion
- Better Auth 1.7 (credentials, Argon2id) · Prisma 7 (driver adapter `@prisma/adapter-pg`) · PostgreSQL 17
- Biome (lint + format) · Vitest (unit) · Playwright (E2E)
- GitHub Actions (CI on PR, release on `v*` tag) · Docker · GHCR · Coolify

## Prerequisites

- Node.js 24, pnpm 11 (via Corepack)
- Docker (for the local Postgres)

## Getting started

```bash
pnpm install
docker compose up -d          # local postgres 17 (non-persistent by design)
cp .env.example .env          # then fill in BETTER_AUTH_SECRET
pnpm exec prisma migrate dev  # apply schema, generates client to src/generated
pnpm dev                      # http://localhost:3000
```

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Dev server (Turbopack) |
| `pnpm build` | Production build (type-checks via the native tsc CLI) |
| `pnpm exec tsc --noEmit` | Standalone typecheck |
| `pnpm biome check --write .` | Lint + format |
| `pnpm vitest` / `pnpm vitest run` | Unit tests (watch / single run) |
| `pnpm exec playwright test` | E2E tests (starts dev server automatically) |
| `pnpm exec prisma migrate dev` | Create/apply a migration locally |

> After editing `prisma/schema.prisma`, run `pnpm exec prisma generate` if `migrate dev` doesn't regenerate the client.

## Environment variables

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | Prisma connection string (local + prod) |
| `BETTER_AUTH_SECRET` | Auth session signing secret |
| `BETTER_AUTH_URL` | Base URL of the app (auth origins) |

See `.env.example` for the template. Never commit `.env`.

## Deployment

Tag a release on `main`:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

The release workflow then: builds the Docker image → pushes to GHCR (`ghcr.io/<owner>/paytrail`, public) → applies `prisma migrate deploy` against production → triggers a Coolify deployment.

Repository secrets required by the release workflow:

| Secret | Value |
| --- | --- |
| `PROD_DATABASE_URL` | Production Postgres connection string |
| `COOLIFY_WEBHOOK_URL` | Coolify deploy webhook URL for the app (Settings → Deploy webhook) |
| `COOLIFY_TOKEN` | Coolify token sent as `Authorization: Bearer` on the webhook call |

Migrations run **before** the new image is pulled; keep them backward-compatible with the currently running release.

## Testing policy

Unit tests (Vitest, `src/lib/`) cover logic-bearing code only: pricing math, invoice numbering, FX snapshots, rate-table matching, ownership guards, parsing. UI is covered by Playwright E2E flows and manual verification.
