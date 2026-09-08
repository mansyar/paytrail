/**
 * Currency-aware display formatting for integer minor-unit amounts.
 * Always divides by 100 with 2 decimals: the data layer stores every
 * currency ×100 (see invoice-schemas.ts), so per-ISO-4217 zero-decimal
 * handling (e.g. JPY) would render stored amounts 100x too small.
 */
export function formatMoney(minor: number, currencyCode: string): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currencyCode,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(minor / 100);
}
