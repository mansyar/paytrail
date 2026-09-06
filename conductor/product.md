# PayTrail — Product Definition

## Vision

PayTrail lets a solo freelancer send a professional invoice in **under 2 minutes**. The business profile and rate table are captured once during guided onboarding; every invoice after that pre-fills from client, project, and imported task data. The defining promise is **speed to invoice** — measured as <2 minutes AND <10 clicks from dashboard to a sent invoice.

## Target Users

- **Primary (only) user:** a solo freelancer billing per-task flat rates — specifically a vacation-rental cleaner whose work lives in an employer's Breezeway app (no API access).
- Teams, multi-user workspaces, and client portals are **explicitly cut**.

## Core Value Proposition

1. **One-click draft + send:** guided setup once → invoices pre-fill from client/project/rate-table data → send in <2 min / <10 clicks (measured both ways, through manual entry AND screenshot import).
2. **AI-assisted ingestion (signature feature):** phone screenshots of Breezeway task lists are parsed by a vision AI into draft line items (task name, property, date), auto-priced via a customizable **keyword → flat-rate table**, then applied **only after explicit human review**. Nothing enters an invoice without confirmation.
3. **Genuinely usable + portfolio-grade:** real daily-use tool AND a public-GitHub showcase of full-stack + DevOps skills.

## v1 Scope (Core Loop)

- **Auth:** email/password only, real bcrypt verification, JWT sessions. Password reset deferred to Phase 2 (no server email in v1).
- **Onboarding:** full business profile — name, address, email, tax ID, logo, home currency, default tax rate, payment terms, initial rate-table keyword rules.
- **Clients & Projects:** full CRUD, scoped to the owning user.
- **Invoices:** line items typed manually or imported; per-invoice tax rate + flat discount; per-user yearly numbering (INV-YYYY-0001) with manual override (auto-counter skips collisions); **locked once sent** — corrections cancel + reissue.
- **Invoice status:** DRAFT → SENT → PAID / OVERDUE. Overdue computed on read (dueDate < today && unpaid) — no scheduler in v1.
- **Payments:** full payments only (no partial-payment model in v1).
- **Deletion safety:** clients/projects with attached invoices cannot be deleted.
- **Delivery:** PDF generation (fixed template + logo) → download + prefilled email draft in the user's own mail client. **No server-side email in v1.**

## Currency Model

- One currency **per client**; account has a home currency.
- Home-currency reporting via **live FX API** (free tier, server-side cache, manual rate fallback).
- **Every invoice snapshots the FX rate used at creation** — historical reports never rewrite themselves.

## Deployment & Delivery (First-Class Requirement)

- Self-hosted: VPS + Docker + **Coolify** + custom domain (infra ready).
- Release pipeline: **CI on PR**; on git tag in main → Docker build → push to GHCR → DB migration → Coolify deploy API trigger (bearer token).
- Public GitHub repo from day one; conventional commits.

## Phase 2 Roadmap

1. Reports & analytics (charts, home-currency aggregation, CSV/PDF export)
2. Email infrastructure (transactional service) → in-app sending, overdue reminders, password reset
3. Full settings page (branding, defaults, payment terms)
4. Invoice templates
5. Breezeway API integration (if API access ever becomes available — richer data: tracked time, billable supplies)

## Cut Permanently

Recurring invoices · client portal · multi-user/teams · payment gateway integration · time tracking

## Known Limitations (Accepted Risks)

- **No database backups** (explicit decision; recorded, not hidden).
- Screenshot parsing sends own task data (property names, task names) to a hosted AI API — accepted by the user.
- Reminder emails and password reset are unavailable until email infra lands in Phase 2.
