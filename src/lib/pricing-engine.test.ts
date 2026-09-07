import { describe, expect, it } from "vitest";
import { priceTasks, type RateRuleInput } from "./pricing-engine";

const RULES: RateRuleInput[] = [
	{ id: "r1", keyword: "standard clean", rateMinor: 4550, sortOrder: 0 },
	{ id: "r2", keyword: "hot tub", rateMinor: 2000, sortOrder: 1 },
];

describe("priceTasks matching semantics", () => {
	it("prices a task whose text contains the keyword", () => {
		const results = priceTasks(["Clean the hot tub and patio"], RULES);
		expect(results).toEqual([
			{
				status: "matched",
				input: "Clean the hot tub and patio",
				rateMinor: 2000,
				ruleId: "r2",
				matchedKeyword: "hot tub",
			},
		]);
	});

	it("matches case-insensitively on both sides", () => {
		const results = priceTasks(["STANDARD CLEAN of the unit"], [
			{ id: "r1", keyword: "Standard Clean", rateMinor: 4550, sortOrder: 0 },
		]);
		expect(results[0]).toMatchObject({
			status: "matched",
			rateMinor: 4550,
			ruleId: "r1",
			matchedKeyword: "Standard Clean",
		});
	});

	it("trims surrounding whitespace from the task text before matching", () => {
		const results = priceTasks(["   Standard clean   "], RULES);
		expect(results[0]).toMatchObject({
			status: "matched",
			input: "Standard clean",
			ruleId: "r1",
		});
	});

	it("returns unmatched for text with no keyword occurrence", () => {
		const results = priceTasks(["Wash the windows"], RULES);
		expect(results).toEqual([{ status: "unmatched", input: "Wash the windows" }]);
	});

	it("prices multiple tasks independently, preserving input order", () => {
		const results = priceTasks(
			["Hot tub refill", "Window washing", "Standard clean + linen"],
			RULES,
		);
		expect(results.map((r) => r.status)).toEqual([
			"matched",
			"unmatched",
			"matched",
		]);
		expect(results[0]).toMatchObject({ ruleId: "r2", rateMinor: 2000 });
		expect(results[2]).toMatchObject({ ruleId: "r1", rateMinor: 4550 });
	});

	it("matches a keyword in the middle of the text, not only at the start", () => {
		const results = priceTasks(["Deep clean: includes hot tub drain"], RULES);
		expect(results[0]).toMatchObject({ status: "matched", ruleId: "r2" });
	});
});

describe("priceTasks tie-breaking", () => {
	it("prefers the longest matching keyword over a shorter one", () => {
		const rules: RateRuleInput[] = [
			{ id: "short", keyword: "tub", rateMinor: 1000, sortOrder: 0 },
			{ id: "long", keyword: "hot tub", rateMinor: 2000, sortOrder: 1 },
		];
		const results = priceTasks(["Clean the hot tub"], rules);
		expect(results[0]).toMatchObject({
			status: "matched",
			ruleId: "long",
			rateMinor: 2000,
			matchedKeyword: "hot tub",
		});
	});

	it("breaks equal-length ties by ascending sortOrder", () => {
		const rules: RateRuleInput[] = [
			{ id: "later", keyword: "clean", rateMinor: 300, sortOrder: 5 },
			{ id: "earlier", keyword: "clean", rateMinor: 150, sortOrder: 2 },
		];
		const results = priceTasks(["Standard clean"], rules);
		expect(results[0]).toMatchObject({
			status: "matched",
			ruleId: "earlier",
			rateMinor: 150,
		});
	});

	it("falls back to stable rule order when keyword and sortOrder tie", () => {
		const rules: RateRuleInput[] = [
			{ id: "first", keyword: "clean", rateMinor: 100, sortOrder: 1 },
			{ id: "second", keyword: "clean", rateMinor: 200, sortOrder: 1 },
		];
		const results = priceTasks(["Deep clean"], rules);
		expect(results[0]).toMatchObject({
			status: "matched",
			ruleId: "first",
			rateMinor: 100,
		});
	});
});
