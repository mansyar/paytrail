/**
 * Form-side money helpers mirroring the `moneyString` rules in
 * invoice-schemas.ts: decimal strings in, integer minor units out.
 * The builder's live totals and suggestion flow run these on every
 * keystroke, so they must stay in sync with the server-side transform
 * (Math.round(Number * 100), max 7 integer digits, max 2 decimals).
 */

const MONEY_PATTERN = /^\d{1,7}(\.\d{1,2})?$/;

/**
 * Parses a user-typed decimal amount into integer minor units.
 * Returns null for anything the invoice schema would reject — the
 * caller decides whether that means "empty" or "show a validation error".
 */
export function parseAmountToMinor(input: string): number | null {
	const value = input.trim();
	if (!MONEY_PATTERN.test(value)) return null;
	return Math.round(Number(value) * 100);
}

/** Formats integer minor units back to a fixed 2-decimal string (for prefills/preview). */
export function minorToAmountString(minor: number): string {
	if (!Number.isInteger(minor) || minor < 0) {
		throw new Error(`Invalid minor-unit amount: ${minor}`);
	}
	return (minor / 100).toFixed(2);
}
