# Track: Test Suite Stabilization & CI Hardening

- **Type:** Chore
- **Status:** new
- **Branch:** `test/stabilize-suites`
- **Created:** 2026-09-08

## Documents

- [Specification](./spec.md)
- [Implementation Plan](./plan.md)
- [Metadata](./metadata.json)

## Summary

Makes all three test layers (unit, integration, E2E) genuinely stable: deduplicated E2E helpers with the drifted `clients.spec.ts` fixed, the onboarding wizard ghost-click bug fixed at the root, production-build E2E webServer, Vitest unit/integration project split with no hidden Postgres dependency, dependency cleanup, and CI/release hardening (E2E gate on every PR, release test gate, concurrency control, docker layer caching).
