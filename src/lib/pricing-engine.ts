/** A user-defined rate rule used to price task descriptions. */
export type RateRuleInput = {
	id: string;
	keyword: string;
	rateMinor: number;
	sortOrder: number;
};

/** Pricing outcome for one task: either matched to a rule, or explicitly unmatched. */
export type PricingResult =
	| {
			status: "matched";
			/** Trimmed task text that was priced. */
			input: string;
			rateMinor: number;
			ruleId: string;
			/** The winning rule's keyword in its original case. */
			matchedKeyword: string;
	  }
	| {
			status: "unmatched";
			/** Trimmed task text that could not be priced. */
			input: string;
	  };

/**
 * Price each task description against the user's rate rules.
 *
 * Matching is a case-insensitive substring test on the trimmed task text.
 * The longest matching keyword wins; equal-length ties break by ascending
 * sortOrder, then by stable rule order. Inputs are never mutated.
 */
export function priceTasks(
	tasks: readonly string[],
	rules: readonly RateRuleInput[],
): PricingResult[] {
	return tasks.map((task) => priceTask(task, rules));
}

type Candidate = { rule: RateRuleInput; keyword: string };

function priceTask(task: string, rules: readonly RateRuleInput[]): PricingResult {
	const input = task.trim();
	const text = input.toLocaleLowerCase("en");

	let best: Candidate | undefined;
	for (const rule of rules) {
		const keyword = rule.keyword.toLocaleLowerCase("en");
		// An empty keyword would match every task; skip it rather than price everything.
		if (keyword.length === 0 || !text.includes(keyword)) continue;
		const candidate: Candidate = { rule, keyword };
		if (!best || beats(candidate, best)) {
			best = candidate;
		}
	}

	if (!best) {
		return { status: "unmatched", input };
	}
	return {
		status: "matched",
		input,
		rateMinor: best.rule.rateMinor,
		ruleId: best.rule.id,
		matchedKeyword: best.rule.keyword,
	};
}

/** Strictly better than the current best: longer keyword, then lower sortOrder. */
function beats(a: Candidate, b: Candidate): boolean {
	if (a.keyword.length !== b.keyword.length) {
		return a.keyword.length > b.keyword.length;
	}
	return a.rule.sortOrder < b.rule.sortOrder;
}
