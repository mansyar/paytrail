import { describe, expect, it } from "vitest";
import { suggestRateForDescription } from "./rate-suggestions";

const rules = [
	{ id: "r1", keyword: "clean", rateMinor: 5000, sortOrder: 1 },
	{ id: "r2", keyword: "deep clean", rateMinor: 9000, sortOrder: 2 },
	{ id: "r3", keyword: "laundry", rateMinor: 2500, sortOrder: 3 },
];

describe("suggestRateForDescription", () => {
	it("returns the matched rate, rule id, and keyword", () => {
		expect(suggestRateForDescription("Weekly clean of unit 4", rules)).toEqual({
			rateMinor: 5000,
			ruleId: "r1",
			matchedKeyword: "clean",
		});
	});

	it("prefers the longest matching keyword", () => {
		expect(suggestRateForDescription("Deep clean required", rules)).toEqual({
			rateMinor: 9000,
			ruleId: "r2",
			matchedKeyword: "deep clean",
		});
	});

	it("matches case-insensitively", () => {
		expect(suggestRateForDescription("LAUNDRY + LINENS", rules)).toEqual({
			rateMinor: 2500,
			ruleId: "r3",
			matchedKeyword: "laundry",
		});
	});

	it("breaks equal-length keyword ties by lower sortOrder", () => {
		const ties = [
			{ id: "a", keyword: "wash", rateMinor: 1000, sortOrder: 2 },
			{ id: "b", keyword: "wash", rateMinor: 2000, sortOrder: 1 },
		];
		expect(suggestRateForDescription("wash", ties)?.rateMinor).toBe(2000);
	});

	it("returns null when nothing matches", () => {
		expect(suggestRateForDescription("pool service", rules)).toBeNull();
	});

	it("returns null for empty or whitespace-only descriptions", () => {
		expect(suggestRateForDescription("", rules)).toBeNull();
		expect(suggestRateForDescription("   ", rules)).toBeNull();
	});

	it("returns null when there are no rules", () => {
		expect(suggestRateForDescription("clean", [])).toBeNull();
	});

	it("ignores rules with empty keywords", () => {
		const emptyKeyword = [
			{ id: "e", keyword: "", rateMinor: 100, sortOrder: 0 },
		];
		expect(suggestRateForDescription("anything", emptyKeyword)).toBeNull();
	});
});
