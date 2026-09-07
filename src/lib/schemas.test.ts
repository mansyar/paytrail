import { describe, expect, it } from "vitest";
import {
	CURRENCIES,
	businessProfileSchema,
	onboardingPayloadSchema,
	rateRuleSchema,
} from "./schemas";

describe("CURRENCIES", () => {
	it("contains common ISO 4217 codes", () => {
		for (const code of ["USD", "EUR", "GBP", "IDR", "AUD", "SGD", "JPY"]) {
			expect(CURRENCIES).toContain(code);
		}
	});

	it("only contains uppercase 3-letter codes", () => {
		for (const code of CURRENCIES) {
			expect(code).toMatch(/^[A-Z]{3}$/);
		}
	});
});

describe("businessProfileSchema", () => {
	const validProfile = {
		businessName: "Sparkle Clean Co",
		addressLine1: "Jl. Mawar 12",
		city: "Jakarta",
		contactEmail: "billing@sparkle.example",
		taxId: "01.234.567.8-091.000",
		logo: "data:image/png;base64,iVBORw0KGgo=",
		currency: "IDR",
		defaultTaxRate: "11",
		paymentTerms: "net_14",
	};

	it("accepts a fully populated profile", () => {
		const result = businessProfileSchema.safeParse(validProfile);
		expect(result.success).toBe(true);
	});

	it("accepts a minimal profile with only required fields", () => {
		const result = businessProfileSchema.safeParse({
			businessName: "Solo Cleaner",
			currency: "USD",
			defaultTaxRate: "0",
		});
		expect(result.success).toBe(true);
	});

	it("rejects a missing or whitespace-only business name", () => {
		expect(
			businessProfileSchema.safeParse({ ...validProfile, businessName: "  " })
				.success,
		).toBe(false);
		const { businessName: _omitted, ...withoutName } = validProfile;
		expect(businessProfileSchema.safeParse(withoutName).success).toBe(false);
	});

	it("rejects a currency outside the ISO list", () => {
		expect(
			businessProfileSchema.safeParse({ ...validProfile, currency: "XXQ" })
				.success,
		).toBe(false);
	});

	it("rejects a malformed contact email", () => {
		expect(
			businessProfileSchema.safeParse({
				...validProfile,
				contactEmail: "not-an-email",
			}).success,
		).toBe(false);
	});

	it("rejects a negative default tax rate", () => {
		expect(
			businessProfileSchema.safeParse({ ...validProfile, defaultTaxRate: "-1" })
				.success,
		).toBe(false);
	});

	it("rejects a default tax rate above 100", () => {
		expect(
			businessProfileSchema.safeParse({
				...validProfile,
				defaultTaxRate: "100.01",
			}).success,
		).toBe(false);
	});

	it("rejects a default tax rate with more than 2 decimals", () => {
		expect(
			businessProfileSchema.safeParse({
				...validProfile,
				defaultTaxRate: "11.123",
			}).success,
		).toBe(false);
	});

	it("rejects an unknown payment terms value", () => {
		expect(
			businessProfileSchema.safeParse({
				...validProfile,
				paymentTerms: "net_forever",
			}).success,
		).toBe(false);
	});

	it("accepts a valid PNG data-URL logo", () => {
		const result = businessProfileSchema.safeParse(validProfile);
		expect(result.success).toBe(true);
	});

	it("rejects a logo over 500 KB decoded", () => {
		const big = Buffer.alloc(500 * 1024 + 1, 7).toString("base64");
		expect(
			businessProfileSchema.safeParse({
				...validProfile,
				logo: `data:image/png;base64,${big}`,
			}).success,
		).toBe(false);
	});

	it("rejects a logo with a non-image MIME type", () => {
		expect(
			businessProfileSchema.safeParse({
				...validProfile,
				logo: "data:text/html;base64,PGgxPmgxPg==",
			}).success,
		).toBe(false);
	});
});

describe("rateRuleSchema", () => {
	it("accepts a keyword + decimal rate and normalizes to integer minor units", () => {
		expect(rateRuleSchema.parse({ keyword: "standard clean", rate: "45.50" })).toEqual({
			keyword: "standard clean",
			rateMinor: 4550,
		});
		expect(rateRuleSchema.parse({ keyword: "linen change", rate: "0" })).toEqual({
			keyword: "linen change",
			rateMinor: 0,
		});
	});

	it("trims the keyword", () => {
		expect(rateRuleSchema.parse({ keyword: "  hot tub  ", rate: "10" })).toEqual({
			keyword: "hot tub",
			rateMinor: 1000,
		});
	});

	it("rejects an empty or whitespace keyword", () => {
		expect(rateRuleSchema.safeParse({ keyword: "", rate: "10" }).success).toBe(false);
		expect(rateRuleSchema.safeParse({ keyword: "   ", rate: "10" }).success).toBe(false);
	});

	it("rejects a negative rate", () => {
		expect(rateRuleSchema.safeParse({ keyword: "x", rate: "-5" }).success).toBe(false);
	});

	it("rejects a rate with more than 2 decimals", () => {
		expect(rateRuleSchema.safeParse({ keyword: "x", rate: "5.999" }).success).toBe(false);
	});

	it("rejects a non-numeric rate", () => {
		expect(rateRuleSchema.safeParse({ keyword: "x", rate: "abc" }).success).toBe(false);
	});
});

describe("onboardingPayloadSchema", () => {
	it("accepts a profile with rate rules", () => {
		const result = onboardingPayloadSchema.safeParse({
			profile: {
				businessName: "Sparkle Clean Co",
				currency: "IDR",
				defaultTaxRate: "11",
			},
			rateRules: [
				{ keyword: "standard clean", rate: "45.50" },
				{ keyword: "linen change", rate: "7.5" },
			],
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.rateRules[0].rateMinor).toBe(4550);
			expect(result.data.rateRules[1].rateMinor).toBe(750);
		}
	});

	it("accepts a profile with an empty rate-rules list", () => {
		const result = onboardingPayloadSchema.safeParse({
			profile: {
				businessName: "Solo Cleaner",
				currency: "USD",
				defaultTaxRate: "0",
			},
			rateRules: [],
		});
		expect(result.success).toBe(true);
	});

	it("rejects more than 50 rate rules", () => {
		const rules = Array.from({ length: 51 }, (_, i) => ({
			keyword: `task ${i}`,
			rate: "1",
		}));
		const result = onboardingPayloadSchema.safeParse({
			profile: {
				businessName: "Solo Cleaner",
				currency: "USD",
				defaultTaxRate: "0",
			},
			rateRules: rules,
		});
		expect(result.success).toBe(false);
	});

	it("rejects an invalid nested profile", () => {
		const result = onboardingPayloadSchema.safeParse({
			profile: { businessName: "", currency: "USD", defaultTaxRate: "0" },
			rateRules: [],
		});
		expect(result.success).toBe(false);
	});
});
