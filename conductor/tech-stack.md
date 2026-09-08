# PayTrail — Technology Stack

*Versions verified as current stable, September 2026. Exact patch versions pinned in package.json at implementation time; major versions fixed here.*

## Core

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Language | TypeScript | **7.x** | Native Go compiler (GA 2026-07-08), strict mode default. Next.js 16 officially supports TS 7: `next build` type-checks via the project-local native `tsc` CLI by default (verified against nextjs.org TypeScript config docs, Sep 2026). `ignoreBuildErrors` must NOT be set. Explicit `tsc --noEmit` also runs as an independent CI step for fast pre-build feedback |
| Runtime | Node.js | **24 LTS** | Base for Next.js + Docker |
| Framework | Next.js | **16** (16.3.x LTS) | App Router, Server Actions, Turbopack default, `proxy.ts` for route protection |
| UI Library | React | **19.2** | Per Next.js 16 pairing |
| Package Manager | pnpm | latest | |

## UI / Styling

| Layer | Technology | Notes |
|---|---|---|
| Component library | MUI **v9** + Emotion | Customized light theme, per product guidelines. **Deviation note (2026-09-07):** spec planned v7; `pnpm add @mui/material` resolves to v9 (9.4.0) as current stable — documented per workflow principle #2. Includes `@mui/material-nextjs` for App Router cache provider |
| Icons | MUI Icons | |
| Forms | React Hook Form + Zod | Zod for client + server validation. **Decision note (2026-09-07):** shared schemas are split into a transform-free *input* schema (used by forms via `zodResolver`) and a transforming *output* schema (re-validated server-side in every server action), so RHF field types match what users type while the server still owns validation |

## Auth

| Layer | Technology | Notes |
|---|---|---|
| Auth | **Better Auth** (1.7.x) | User's explicit choice. Email/password with **Argon2id** hashing (OWASP default), Prisma adapter, `nextCookies()` plugin, session cookie + `proxy.ts` protection. Fully Next.js 16 compatible. Password reset support available for Phase 2 |

## Database / ORM

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Database | PostgreSQL | 17 | Self-hosted in Docker (Coolify) |
| ORM | Prisma | **7.x** | GA and fully supported. (Prisma 8 just GA'd 2026-08-28 — days old — recommend 7.x for a solo project; revisit before v1 ships. Better Auth's Prisma adapter targets Prisma 7 schema output.) Prisma 7 **requires a SQL driver adapter**: install `@prisma/adapter-pg` and construct `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })` (see `src/lib/db.ts`). After schema edits, run `pnpm exec prisma generate` explicitly — `migrate dev` may not regenerate the client. |

## Invoice / Documents

| Layer | Technology | Notes |
|---|---|---|
| PDF generation | pdfkit | Server-side, fixed template, logo embed. **Implementation notes (2026-09-08, pdf_delivery_20260908):** pdfkit loads its AFM font metric files from disk at runtime — it MUST stay in `serverExternalPackages` in `next.config.ts` or text rendering breaks in bundled server output. Dev deps: `unpdf` (extracts text from generated PDFs in unit tests) and `@types/pdfkit`. Currency in PDFs uses ISO-code prefix (`USD 1,234.50`) via the renderer's own `formatMoneyIso`, distinct from UI symbol formatting in `money-format.ts` |

## AI Ingestion (Screenshot → Line Items)

| Layer | Technology | Notes |
|---|---|---|
| Vision AI | Hosted vision API (provider decided at planning: Claude / GPT / Gemini) | Parse Breezeway screenshots → structured task data; **review gate before apply** |
| FX rates | Live FX API (free tier; provider at planning) | Server-side cached; manual fallback rate |

## Code Quality

| Layer | Technology | Notes |
|---|---|---|
| Linter + Formatter | **Biome** | Single tool replacing ESLint + Prettier; TS 7-compatible (no typescript-eslint dependency) |

## DevOps (First-Class)

| Layer | Technology | Notes |
|---|---|---|
| CI | GitHub Actions | Biome lint + `tsc --noEmit` + unit/integration tests + build + Playwright E2E on every PR; concurrency-canceled |
| Release | GitHub Actions (tag-triggered) | Gated on `verify` job (lint + typecheck + unit) → Docker build (GHA layer cache) → GHCR (**public image**) → Prisma migrate → Coolify deploy API (bearer token) |
| Hosting | VPS + Coolify + Docker Compose | Custom domain, Postgres in Docker |
| Registry | GHCR | Public images |

## Testing

| Layer | Technology | Notes |
|---|---|---|
| Unit/integration | Vitest | Server logic (pricing, numbering, FX snapshot) |
| E2E | Playwright | Critical path: dashboard → invoice sent <2 min |

Testing notes (dated):
- **2026-09-07 (clients_projects_20260907):** `use server` action wrappers (`src/lib/*-actions.ts`) are excluded from the Vitest coverage gate — they contain no business logic (session resolution + delegation); their behavior is verified by the Playwright E2E suite. Coverage threshold (>80% on `src/lib/`) applies to the remaining logic-bearing modules.
- **2026-09-07 (clients_projects_20260907):** Playwright `baseURL`/`webServer.url` are overridable via `PLAYWRIGHT_PORT` so parallel worktrees can run E2E without colliding with another checkout's dev server; default port 3000 unchanged (CI unaffected).
- **2026-09-08 (test_stabilization_20260908):** Vitest split into `unit` and `integration` projects (`pnpm test` = unit only — passes with Postgres stopped; `pnpm test:integration`; `pnpm test:all`). Integration suites skip with a marker when `DATABASE_URL` is absent and run with `fileParallelism: false` (shared instance, fixed fixtures). `pnpm db:setup` starts the Docker DB and applies migrations.
- **2026-09-08 (test_stabilization_20260908):** Playwright webServer defaults to the production build (`next build && next start`) locally and in CI — `next dev`'s on-demand compilation caused hydration-race flakes. `PLAYWRIGHT_DEV=1` opts back into the dev server. Failures retain traces + screenshots. Playwright sets `E2E=1` on the app server process so better-auth's production rate limiter is disabled for the suite only (real deployments keep it on).
- **2026-09-08 (test_stabilization_20260908):** Removed unused component-testing deps (`@testing-library/react`, `@testing-library/dom`, `jsdom`, `@vitejs/plugin-react`) until component tests are actually written; reintroduce with a Vitest setup file when needed.
