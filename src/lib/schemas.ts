import { z } from "zod";

// ISO 4217 codes the app supports for home/client currency selection.
export const CURRENCIES = [
	"USD",
	"EUR",
	"GBP",
	"AUD",
	"NZD",
	"CAD",
	"CHF",
	"JPY",
	"CNY",
	"HKD",
	"SGD",
	"IDR",
	"MYR",
	"THB",
	"PHP",
	"VND",
	"KRW",
	"INR",
	"AED",
	"SAR",
	"MXN",
	"BRL",
	"ZAR",
	"SEK",
	"NOK",
	"DKK",
	"PLN",
	"TRY",
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export const PAYMENT_TERMS = [
	"due_on_receipt",
	"net_7",
	"net_14",
	"net_30",
	"net_60",
] as const;

export type PaymentTerms = (typeof PAYMENT_TERMS)[number];

const LOGO_MAX_BYTES = 500 * 1024;

const optionalText = <T extends z.ZodType>(schema: T) =>
	z.preprocess(
		(v) => (v === "" || v == null ? undefined : v),
		schema.optional(),
	);

const emailOrEmpty = z.preprocess(
	(v) => (v === "" || v == null ? undefined : v),
	z.email().optional(),
);

const logoDataUrl = z
	.string()
	.regex(
		/^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/,
		"Logo must be a base64-encoded PNG or JPEG data URL",
	)
	.refine((v) => {
		const base64 = v.slice(v.indexOf(",") + 1);
		return Math.floor((base64.length * 3) / 4) <= LOGO_MAX_BYTES;
	}, "Logo must be 500 KB or smaller");

const percentString = z
	.string()
	.regex(
		/^\d{1,3}(\.\d{1,2})?$/,
		"Must be a non-negative number with at most 2 decimals",
	)
	.refine((v) => Number(v) <= 100, "Must be at most 100");

export const businessProfileSchema = z.object({
	businessName: z.string().trim().min(1).max(200),
	addressLine1: optionalText(z.string().max(200)),
	addressLine2: optionalText(z.string().max(200)),
	city: optionalText(z.string().max(100)),
	postalCode: optionalText(z.string().max(20)),
	contactEmail: emailOrEmpty,
	taxId: optionalText(z.string().max(50)),
	logo: z.preprocess(
		(v) => (v === "" || v == null ? undefined : v),
		logoDataUrl.optional(),
	),
	currency: z.enum(CURRENCIES),
	defaultTaxRate: percentString,
	paymentTerms: optionalText(z.enum(PAYMENT_TERMS)),
});

export type BusinessProfileInput = z.input<typeof businessProfileSchema>;
export type BusinessProfileData = z.output<typeof businessProfileSchema>;

export const rateRuleInputSchema = z.object({
	keyword: z.string().trim().min(1).max(80),
	rate: z
		.string()
		.regex(
			/^\d{1,10}(\.\d{1,2})?$/,
			"Must be a non-negative number with at most 2 decimals",
		),
});

export const rateRuleSchema = rateRuleInputSchema.transform(
	({ keyword, rate }) => ({
		keyword,
		rateMinor: Math.round(Number(rate) * 100),
	}),
);

export type RateRuleData = z.output<typeof rateRuleSchema>;

export const onboardingPayloadSchema = z.object({
	profile: businessProfileSchema,
	rateRules: z.array(rateRuleSchema).max(50).default([]),
});

export const onboardingInputSchema = z.object({
	profile: businessProfileSchema,
	rateRules: z.array(rateRuleInputSchema).max(50).default([]),
});

export type OnboardingInput = z.input<typeof onboardingInputSchema>;
export type OnboardingPayload = z.output<typeof onboardingPayloadSchema>;
