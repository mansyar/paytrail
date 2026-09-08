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

/**
 * Compact display for an FX rate multiplier (fx_multi_currency_20260908):
 * trims trailing zeros while keeping up to 8 decimals (the snapshot column
 * precision), e.g. "1.08", "0.0000625". Falls back to the raw string for
 * empty or unparseable input.
 */
export function formatFxRate(rate: string): string {
	const parsed = Number(rate);
	if (!rate.trim() || !Number.isFinite(parsed)) return rate;
	return parsed.toLocaleString("en-US", { maximumFractionDigits: 8 });
}
