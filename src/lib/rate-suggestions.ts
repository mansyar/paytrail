import { priceTasks, type RateRuleInput } from "./pricing-engine";

export interface RateSuggestion {
	rateMinor: number;
	ruleId: string;
	/** The winning rule's keyword in its original case — shown as the "matched rule" cue. */
	matchedKeyword: string;
}

/**
 * Maps a single line-item description to a rate suggestion from the
 * user's rate table. Matching is delegated entirely to the pricing
 * engine (case-insensitive substring, longest keyword wins). The
 * suggestion is advisory: the user can always override the amount.
 */
export function suggestRateForDescription(
	description: string,
	rules: readonly RateRuleInput[],
): RateSuggestion | null {
	const [result] = priceTasks([description], rules);
	if (!result || result.status === "unmatched") return null;
	return {
		rateMinor: result.rateMinor,
		ruleId: result.ruleId,
		matchedKeyword: result.matchedKeyword,
	};
}
