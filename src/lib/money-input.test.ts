import { describe, expect, it } from "vitest";
import { minorToAmountString, parseAmountToMinor } from "./money-input";

describe("parseAmountToMinor", () => {
	it("converts plain integer dollar strings", () => {
		expect(parseAmountToMinor("12")).toBe(1200);
	});

	it("converts two-decimal amounts", () => {
		expect(parseAmountToMinor("12.34")).toBe(1234);
	});

	it("converts one-decimal amounts", () => {
		expect(parseAmountToMinor("12.5")).toBe(1250);
	});

	it("trims surrounding whitespace", () => {
		expect(parseAmountToMinor("  12.34  ")).toBe(1234);
	});

	it("rounds away float representation errors (e.g. 8.86 → 886)", () => {
		// 8.86 * 100 = 885.9999999999999 without rounding
		expect(parseAmountToMinor("8.86")).toBe(886);
	});

	it("accepts zero", () => {
		expect(parseAmountToMinor("0")).toBe(0);
		expect(parseAmountToMinor("0.00")).toBe(0);
	});

	it("caps at 7 integer digits to mirror the money string schema", () => {
		expect(parseAmountToMinor("9999999.99")).toBe(999999999);
		expect(parseAmountToMinor("12345678")).toBeNull();
	});

	it("rejects more than 2 decimal places", () => {
		expect(parseAmountToMinor("12.345")).toBeNull();
	});

	it("rejects negatives, thousands separators, and letters", () => {
		expect(parseAmountToMinor("-5")).toBeNull();
		expect(parseAmountToMinor("1,234")).toBeNull();
		expect(parseAmountToMinor("abc")).toBeNull();
	});

	it("rejects empty and whitespace-only input", () => {
		expect(parseAmountToMinor("")).toBeNull();
		expect(parseAmountToMinor("   ")).toBeNull();
	});
});

describe("minorToAmountString", () => {
	it("formats minor units as a fixed 2-decimal string", () => {
		expect(minorToAmountString(1250)).toBe("12.50");
		expect(minorToAmountString(5)).toBe("0.05");
		expect(minorToAmountString(0)).toBe("0.00");
	});

	it("round-trips with parseAmountToMinor", () => {
		expect(parseAmountToMinor(minorToAmountString(999999999))).toBe(999999999);
	});

	it("throws on negative or non-integer minor units", () => {
		expect(() => minorToAmountString(-5)).toThrow();
		expect(() => minorToAmountString(12.5)).toThrow();
	});
});
