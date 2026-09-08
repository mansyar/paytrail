import { describe, expect, it } from "vitest";
import { formatMoney } from "./money-format";

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
