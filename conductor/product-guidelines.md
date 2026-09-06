# PayTrail — Product Guidelines

## Brand Personality

- **Professional, minimal, fast.** The app should feel like a well-organized desk, not a startup landing page.
- **Trustworthy financial tool first, portfolio showcase second.** Every screen must look like something a real client could see.
- Clean typography, generous whitespace, one accent color; no decorative clutter.

## Voice & Tone (in-app copy)

- **Direct and terse.** Buttons are verbs ("Create invoice", "Send", "Mark as paid"); labels are nouns.
- **Plain language over jargon.** "Amount due", not "Outstanding balance receivable".
- **No exclamation marks, no marketing fluff** inside the workspace. Empty states state facts and offer the next action ("No clients yet — add your first client").
- Error messages say what happened and what to do next; never blame the user.

## UX Principles

1. **Speed is the design constraint.** Any action on the critical invoicing path must be reachable in minimal clicks; prefer sensible defaults over questions. Prefill aggressively from profile/client/rate-table data.
2. **Progressive disclosure.** Advanced options (tax overrides, manual invoice numbers, FX rates) are tucked away; the default path stays one-click.
3. **Review gates for destructive or automated actions.** AI-parsed lines always require confirmation before touching an invoice; deletions are blocked (not warned) when records depend on them.
4. **Locked-record clarity.** Sent invoices are read-only with an obvious explanation and a visible "cancel & reissue" path — never a dead end.
5. **Full responsive (desktop-first).** Invoice creation, review, and sending must work well on a phone — the user screenshots tasks from a phone; the review flow may happen there too.
6. **Status legibility at a glance.** Invoice state (Draft/Sent/Paid/Overdue) must be identifiable by color + label without opening the record.

## Accessibility

- Meets WCAG AA contrast on text and controls.
- All interactive elements keyboard-reachable; forms labeled properly.
- Don't rely on color alone to convey status (color + icon + text).

## Invoice PDF Style

- Single, fixed professional template: business logo + name + address + tax ID, itemized lines, tax/discount, totals in the invoice currency, payment terms, due date.
- Print-safe A4/Letter; no dark backgrounds; conservative fonts.
- The PDF is a client-facing artifact: extra polish allowed here beyond in-app minimalism.

## Visual Style Baseline

- Framework: MUI (Material Design components, customized theme).
- Light theme default; consistent spacing scale; data-dense tables with clear hierarchy.
- Currency values right-aligned, monospaced numerals where possible.
