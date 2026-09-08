import { describe, expect, it } from "vitest";
import { formatFxRate, formatMoney } from "./money-format";

describe("formatMoney", () => {
	it("formats two-decimal currencies from minor units", () => {
		expect(formatMoney(123456, "USD")).toBe("$1,234.56");
		expect(formatMoney(5, "USD")).toBe("$0.05");
	});

	it("treats zero-decimal currencies as 2-decimal to match storage", () => {
		// The data layer stores every currency ×100 (invoice-schemas
		// transform), so JPY minor units are "sen", not yen — display
		// must divide by 100 too or stored amounts render 100x smaller.
		expect(formatMoney(1234, "JPY")).toBe("¥12.34");
	});

	it("groups thousands", () => {
		expect(formatMoney(999999999, "EUR")).toBe("€9,999,999.99");
	});

	it("formats zero", () => {
		expect(formatMoney(0, "GBP")).toBe("£0.00");
	});
});

describe("formatFxRate", () => {
	it("formats a multiplier with up to 6 decimals, trimmed", () => {
		expect(formatFxRate("1.08")).toBe("1.08");
		expect(formatFxRate("1.11111111")).toBe("1.11111111");
		expect(formatFxRate("0.0000625")).toBe("0.0000625");
	});

	it("falls back to the raw string for unparseable input", () => {
		expect(formatFxRate("")).toBe("");
	});
});
