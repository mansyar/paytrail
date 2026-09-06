# Project Workflow

## Guiding Principles

1.  **The Plan is the Source of Truth:** All work must be tracked in `plan.md`
2.  **The Tech Stack is Deliberate:** Changes to the tech stack must be
    documented in `tech-stack.md` *before* implementation
3.  **Tests for Logic-Bearing Code:** Test-first discipline applies to domain
    logic (pricing, invoice numbering, FX snapshotting, rate-table matching,
    ownership guards, parsing). Pure UI scaffolding and presentational
    components are verified manually and via E2E — no mandatory unit tests.
    **Coverage target: >80% for logic-bearing modules (`src/lib/`); UI is
    excluded from coverage measurement.**
4.  **Speed is a Measured Requirement:** The critical path (dashboard → sent
    invoice) must stay under 2 minutes and 10 clicks — E2E-verified.
5.  **User Experience First:** Every decision should prioritize user experience
6.  **Non-Interactive & CI-Aware:** Prefer non-interactive commands. Use
    `CI=true` for watch-mode tools (tests, linters) to ensure single execution.

## Task Workflow

All tasks follow a strict lifecycle:

### Standard Task Workflow

1.  **Select Task:** Choose the next available task from `plan.md` in sequential
    order

2.  **Mark In Progress:** Before beginning work, edit `plan.md` and change the
    task from `[ ]` to `[~]`

3.  **Branch:** Create a feature branch from `main`:
    `git checkout -b feat/<short-slug>` (also `fix/`, `chore/`, `test/` by type)

4.  **Write Failing Tests (Red Phase) — logic-bearing tasks only:**

    -   Create a new test file for the domain logic the task introduces.
    -   Write one or more unit tests that clearly define the expected behavior
        and acceptance criteria.
    -   **CRITICAL:** Run the tests and confirm that they fail as expected.
        Do not proceed until you have failing tests.
    -   For pure UI/scaffolding tasks, skip to step 5.

5.  **Implement to Pass Tests (Green Phase):**

    -   Write the minimum amount of application code necessary to make the
        failing tests pass.
    -   Run the test suite again and confirm that all tests now pass.

6.  **Refactor (Optional but Recommended):**

    -   With the safety of passing tests, refactor implementation and test code
        to improve clarity without changing external behavior.
    -   Rerun tests to ensure they still pass.

7.  **Document Deviations:** If implementation differs from tech stack:

    -   **STOP** implementation
    -   Update `tech-stack.md` with new design
    -   Add dated note explaining the change
    -   Resume implementation

8.  **Local Review Gate (before any push):**

    -   Run the full pre-push check suite (see Before Committing below).
    -   Perform a self-review of the diff against `product-guidelines.md` and
        `code_styleguides/` — functionality, security invariants
        (user-scoped queries, Zod on all external input), style, mobile.
    -   **Do not `git push` or open a PR until the local review passes.**

9.  **Commit Code Changes:**

    -   Stage all code changes related to the task.
    -   Propose a clear, concise Conventional Commit message, e.g.
        `feat(invoices): Add per-user yearly invoice numbering`.
    -   Perform the commit.

10. **Attach Task Summary with Git Notes:**

    -   **Step 10.1: Get Commit Hash:** `git log -1 --format="%H"`.
    -   **Step 10.2: Draft Note Content:** Task name, summary of changes, list
        of created/modified files, and the core "why".
    -   **Step 10.3: Attach Note:** `git notes add -m "<note content>" <commit_hash>`

11. **Get and Record Task Commit SHA:**

    -   **Step 11.1: Update Plan:** In `plan.md`, update the task from `[~]` to
        `[x]` and append the first 7 characters of the commit hash.
    -   **Step 11.2: Write Plan:** Write the updated content back to `plan.md`.

12. **Commit Plan Update:**

    -   Stage the modified `plan.md`.
    -   Commit: `conductor(plan): Mark task '<task name>' as complete`

13. **Push and Open PR:**

    -   `git push -u origin <branch>`
    -   Open a PR into `main`. CI runs lint + typecheck + tests on the PR.
    -   Merge after green. Delete the branch.

### Task Correction & Plan Amendment Workflows

1.  **In-Flight Refinements:** If minor gaps are found while a task is
    in-progress (`[~]`), adjust directly in the active stream and ensure passing
    tests before committing.
2.  **Code Review Corrections (`conductor-review`):** If issues are identified
    during review, a `Review Fixes` phase is appended to `plan.md` so correction
    tasks are formally tracked.
3.  **Logical State Reversions (`conductor-revert`):** If a task implementation
    is fundamentally flawed, revert the commits and reset the task state in
    `plan.md` back to pending `[ ]`.

### Phase Completion Verification and Checkpointing Protocol

**Trigger:** Executed immediately after a task completes a phase in `plan.md`.

1.  **Announce Protocol Start.**

2.  **Ensure Test Coverage for Phase Changes:**

    -   **Step 2.1: Determine Phase Scope:** Find the previous phase checkpoint
        SHA in `plan.md`; if none, scope is all changes since the first commit.
    -   **Step 2.2: List Changed Files:** `git diff --name-only <prev_sha> HEAD`
    -   **Step 2.3: Verify and Create Tests:** For each changed code file:
        -   If it is **logic-bearing** (in `src/lib/` — pricing, numbering, FX,
            rate matching, auth guards, parsing): a corresponding test file
            **must** exist; create one if missing, matching existing test style.
        -   If it is UI/presentational: no unit test required; note it for
            manual verification.
        -   Non-code files (`.json`, `.md`, `.yaml`) are excluded.

3.  **Execute Automated Tests with Proactive Debugging:**

    -   Announce the exact command, e.g. "Running test suite.
        **Command:** `pnpm vitest run`"
    -   Execute. If tests fail, propose a fix a **maximum of two times**; if
        still failing, **stop** and ask the user for guidance.

4.  **Propose a Detailed, Actionable Manual Verification Plan:**

    -   Analyze `product.md`, `product-guidelines.md`, and `plan.md` to
        determine the user-facing goals of the completed phase.
    -   Present a step-by-step manual verification plan with commands and
        expected outcomes, e.g.:

        > **Manual Verification Steps:**
        > 1. **Start the dev server:** `pnpm dev`
        > 2. **Open your browser to:** `http://localhost:3000`
        > 3. **Confirm that you see:** the new invoice list with status chips

5.  **Await Explicit User Feedback:** Pause for an explicit yes or change
    requests. Do not proceed without confirmation.

6.  **Identify Target Commit for Report:** Use the last functional commit of
    the phase (no empty checkpoint commits).

7.  **Attach Auditable Verification Report using Git Notes:** Full report —
    test command, manual steps, user confirmation — attached via `git notes`.

8.  **Get and Record Phase Checkpoint SHA:** Append
    `[checkpoint: <sha-first-7>]` to the phase heading in `plan.md`.

9.  **Commit Plan Update:** `conductor(plan): Mark phase '<PHASE NAME>' as complete`

10. **Announce Completion.**

## Quality Gates

Before marking any task complete, verify:

- [ ] All tests pass (logic-bearing code)
- [ ] Coverage >80% for logic-bearing modules (`src/lib/`); UI excluded
- [ ] Code follows project's code style guidelines (`code_styleguides/`)
- [ ] Type safety enforced; `tsc --noEmit` clean
- [ ] No Biome lint/format errors
- [ ] Every server-side query/mutation filters by the session user's id
- [ ] External input Zod-validated (including AI-parse output)
- [ ] Works correctly on mobile viewport (if UI)
- [ ] Documentation updated if needed
- [ ] No security vulnerabilities introduced

## Development Commands

**Stack alignment: pnpm · Next.js 16 · TypeScript 7 · Biome · Vitest · Playwright · Prisma**

### Setup

```bash
pnpm install                                   # install dependencies
pnpm exec prisma migrate dev                   # apply migrations to local Postgres
pnpm exec prisma generate                      # regenerate client (src/generated)
```

### Daily Development

```bash
pnpm dev                                       # dev server (Turbopack) at localhost:3000
pnpm vitest                                    # unit/integration tests in watch mode
pnpm exec playwright test                      # E2E suite
pnpm exec playwright test --project=chromium --viewport "390,844"   # mobile viewport pass
```

### Before Committing (Local Review Gate)

```bash
pnpm biome check --write .                     # lint + format (auto-fix)
pnpm exec tsc --noEmit                         # typecheck (native CLI; next build also type-checks via project-local tsc)
pnpm vitest run                                # full test suite, single run
pnpm build                                     # production build check
```

All four must pass before `git push` / opening a PR.

## Testing Requirements

### Unit / Integration (logic-bearing code)

-   **Required for:** pricing & totals math (integer minor units), invoice
    numbering (yearly sequence, manual override collision handling), FX rate
    snapshotting, keyword→rate table matching, invoice state transitions
    (draft→sent lock, cancel & reissue), ownership scoping, Zod schemas,
    AI-parse result mapping.
-   Mock external dependencies (FX API, vision AI API, DB where appropriate).
-   Test both success and failure cases.
-   **Coverage: >80%** on `src/lib/` modules (`pnpm vitest run --coverage`).
-   **Not required for:** layout, styling, presentational components, route
    files — these are covered by manual verification and E2E.

### E2E (Playwright)

-   **Critical path:** dashboard → select client → create invoice (manual and
    screenshot-import) → send. Must complete under the <2 min / <10 click budget.
-   Auth flow: signup, login, protected-route redirect.
-   Responsive spot-checks at desktop + mobile viewports.

## Code Review Process (Local, Pre-Push)

Review happens **locally, before `git push` or opening a PR** — this is a hard
gate, not a suggestion.

### Self-Review Checklist

1.  **Functionality** — works as specified; edge cases handled; error messages
    user-friendly.
2.  **Code Quality** — style guide followed; DRY; clear names; comments explain why.
3.  **Testing** — logic-bearing code covered; all tests green.
4.  **Security** — no hardcoded secrets; session-scoped queries; input validated;
    AI output treated as untrusted; XSS-safe rendering.
5.  **Performance** — no N+1 queries; minimal payload; caching where sensible.
6.  **Mobile** — usable at 390px; touch targets ≥44px; no horizontal scroll.
7.  **Product fit** — consistent with `product-guidelines.md` (voice, status
    legibility, review gates, locked-record clarity).

## Commit Guidelines

### Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

-   `feat`: New feature
-   `fix`: Bug fix
-   `docs`: Documentation only
-   `style`: Formatting only
-   `refactor`: Neither fixes a bug nor adds a feature
-   `test`: Adding/adjusting tests
-   `chore`: Maintenance
-   `ci`: Pipeline changes

### Examples

```bash
git commit -m "feat(invoices): Add yearly numbering with manual override"
git commit -m "fix(clients): Block deletion when invoices are attached"
git commit -m "test(pricing): Cover tax and discount rounding in minor units"
git commit -m "ci(release): Trigger Coolify deploy on version tag"
```

## Definition of Done

A task is complete when:

1.  All code implemented to specification
2.  Logic-bearing code tested and passing
3.  Code passes Biome + `tsc --noEmit`
4.  Local review checklist completed
5.  Works on mobile viewport (if UI)
6.  Implementation notes added to `plan.md`
7.  Changes committed with a Conventional Commit message
8.  Git note with task summary attached
9.  PR open/merged with CI green

## Emergency Procedures

### Critical Bug in Production

1.  Create `hotfix/<slug>` branch from `main`
2.  Write failing test reproducing the bug (if logic-bearing)
3.  Implement minimal fix; pass local review gate
4.  Tag a patch release → pipeline deploys
5.  Verify on production; document in `plan.md`

### Data Loss

1.  Stop all write operations immediately
2.  **No backups exist (accepted product risk)** — assess what is lost
3.  Reconstruct from source of truth where possible (sent PDFs in email,
    Breezeway task list, bank statements)
4.  Document the incident and lesson learned in `plan.md`
5.  Revisit the no-backups decision explicitly if losses are material

### Security Breach

1.  Rotate all secrets immediately (DB password, `BETTER_AUTH_SECRET`, API keys)
2.  Review access logs
3.  Patch vulnerability; deploy via hotfix flow
4.  Document and update security procedures

## Deployment Workflow

**Pipeline: GitHub Actions — CI on PR; on version tag in `main` → Docker build
→ push to GHCR (public) → Prisma migrate → Coolify deploy API (bearer token).**

### Pre-Deployment Checklist

- [ ] All tests passing; Biome + `tsc --noEmit` clean
- [ ] Environment variables configured in Coolify
- [ ] Database migrations committed and tested locally
- [ ] E2E critical path green

### Deployment Steps

1.  Merge feature PR to `main` (CI green)
2.  Tag release: `git tag -a v0.x.y && git push origin v0.x.y`
3.  Pipeline builds Docker image → pushes to GHCR
4.  Pipeline runs Prisma migrations against production DB
5.  Pipeline triggers Coolify deploy via API (bearer token)
6.  Verify deployment on the custom domain; smoke-test critical path

### Post-Deployment

1.  Check error logs in Coolify
2.  Verify the <2 min / <10 click invoice flow manually
3.  Note issues for next iteration in `plan.md`

## Continuous Improvement

-   Update based on pain points; document lessons learned in `plan.md`
-   Keep the workflow lean — prune steps that stop earning their cost
