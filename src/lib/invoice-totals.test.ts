import { describe, expect, it } from "vitest";
import { computeInvoiceTotals } from "./invoice-totals";

describe("computeInvoiceTotals", () => {
	it("sums item amounts into a subtotal in minor units", () => {
		const totals = computeInvoiceTotals({
			items: [{ amountMinor: 1000 }, { amountMinor: 2000 }],
			taxRate: 0,
			discountMinor: 0,
		});
		expect(totals.subtotalMinor).toBe(3000);
		expect(totals.totalMinor).toBe(3000);
	});

	it("applies discount before tax and rounds tax half-up", () => {
		// Spec example: items 1000 + 2000, discount 500, tax 10% → 2750.
		const totals = computeInvoiceTotals({
			items: [{ amountMinor: 1000 }, { amountMinor: 2000 }],
			taxRate: 10,
			discountMinor: 500,
		});
		expect(totals.subtotalMinor).toBe(3000);
		expect(totals.discountAppliedMinor).toBe(500);
		expect(totals.taxableMinor).toBe(2500);
		expect(totals.taxMinor).toBe(250);
		expect(totals.totalMinor).toBe(2750);
	});

	it("rounds fractional tax half-up (e.g. 9% of 555 → 50)", () => {
		const totals = computeInvoiceTotals({
			items: [{ amountMinor: 555 }],
			taxRate: 9,
			discountMinor: 0,
		});
		// 555 * 0.09 = 49.95 → 50
		expect(totals.taxMinor).toBe(50);
		expect(totals.totalMinor).toBe(605);
	});

	it("rounds exact halves up (e.g. 12.5% of 100 → 13)", () => {
		const totals = computeInvoiceTotals({
			items: [{ amountMinor: 100 }],
			taxRate: 12.5,
			discountMinor: 0,
		});
		expect(totals.taxMinor).toBe(13);
		expect(totals.totalMinor).toBe(113);
	});

	it("clamps discount at the subtotal so totals never go negative", () => {
		const totals = computeInvoiceTotals({
			items: [{ amountMinor: 800 }],
			taxRate: 10,
			discountMinor: 1000,
		});
		expect(totals.discountAppliedMinor).toBe(800);
		expect(totals.taxableMinor).toBe(0);
		expect(totals.taxMinor).toBe(0);
		expect(totals.totalMinor).toBe(0);
	});

	it("handles an empty item list without negative or NaN results", () => {
		const totals = computeInvoiceTotals({
			items: [],
			taxRate: 10,
			discountMinor: 500,
		});
		expect(totals.subtotalMinor).toBe(0);
		expect(totals.discountAppliedMinor).toBe(0);
		expect(totals.taxMinor).toBe(0);
		expect(totals.totalMinor).toBe(0);
	});

	it("applies fractional tax rates with decimal precision", () => {
		const totals = computeInvoiceTotals({
			items: [{ amountMinor: 3333 }],
			taxRate: 7.25,
			discountMinor: 0,
		});
		// 3333 * 0.0725 = 241.6425 → 242
		expect(totals.taxMinor).toBe(242);
		expect(totals.totalMinor).toBe(3575);
	});
});
