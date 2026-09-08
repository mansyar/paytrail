/**
 * Invoice totals math. All money is integer minor units (cents);
 * taxRate is a percentage (10 = 10%, 12.5 = 12.5%). The discount is a
 * flat minor-unit amount applied BEFORE tax and clamped at the subtotal,
 * so totals can never go negative. Tax rounds half-up to whole minor units.
 */

export interface InvoiceTotalsInput {
	items: { amountMinor: number }[];
	taxRate: number;
	discountMinor: number;
}

export interface InvoiceTotals {
	/** Sum of all item amounts. */
	subtotalMinor: number;
	/** Discount actually applied (clamped to the subtotal). */
	discountAppliedMinor: number;
	/** Subtotal minus the applied discount — the base tax is computed on. */
	taxableMinor: number;
	/** Tax on the taxable amount, rounded half-up. */
	taxMinor: number;
	/** taxableMinor + taxMinor. */
	totalMinor: number;
}

export function computeInvoiceTotals({
	items,
	taxRate,
	discountMinor,
}: InvoiceTotalsInput): InvoiceTotals {
	const subtotalMinor = items.reduce(
		(sum, item) => sum + item.amountMinor,
		0,
	);

	const discountAppliedMinor = Math.min(
		Math.max(discountMinor, 0),
		subtotalMinor,
	);
	const taxableMinor = subtotalMinor - discountAppliedMinor;

	// Half-up rounding in integer cents: round(x) rounds .5 up for positives.
	const taxMinor = Math.round((taxableMinor * taxRate) / 100);

	return {
		subtotalMinor,
		discountAppliedMinor,
		taxableMinor,
		taxMinor,
		totalMinor: taxableMinor + taxMinor,
	};
}
