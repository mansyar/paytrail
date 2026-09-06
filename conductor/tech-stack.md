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
| Forms | React Hook Form + Zod | Zod for client + server validation |

## Auth

| Layer | Technology | Notes |
|---|---|---|
| Auth | **Better Auth** (1.7.x) | User's explicit choice. Email/password with **Argon2id** hashing (OWASP default), Prisma adapter, `nextCookies()` plugin, session cookie + `proxy.ts` protection. Fully Next.js 16 compatible. Password reset support available for Phase 2 |

## Database / ORM

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Database | PostgreSQL | 17 | Self-hosted in Docker (Coolify) |
| ORM | Prisma | **7.x** | GA and fully supported. (Prisma 8 just GA'd 2026-08-28 — days old — recommend 7.x for a solo project; revisit before v1 ships. Better Auth's Prisma adapter targets Prisma 7 schema output.) |

## Invoice / Documents

| Layer | Technology | Notes |
|---|---|---|
| PDF generation | pdfkit | Server-side, fixed template, logo embed |

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
| CI | GitHub Actions | Biome lint + `tsc --noEmit` + build + tests on every PR |
| Release | GitHub Actions (tag-triggered) | Docker build → GHCR (**public image**) → Prisma migrate → Coolify deploy API (bearer token) |
| Hosting | VPS + Coolify + Docker Compose | Custom domain, Postgres in Docker |
| Registry | GHCR | Public images |

## Testing

| Layer | Technology | Notes |
|---|---|---|
| Unit/integration | Vitest | Server logic (pricing, numbering, FX snapshot) |
| E2E | Playwright | Critical path: dashboard → invoice sent <2 min |
