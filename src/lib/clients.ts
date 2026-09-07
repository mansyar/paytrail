import { z } from "zod";
import { CURRENCIES, DEFAULT_CURRENCY } from "./currencies";

const currencyCodeSchema = z
	.string()
	.length(3)
	.refine(
		(code) => (CURRENCIES as readonly string[]).includes(code),
		"Unknown ISO 4217 currency code",
	);

export const clientSchema = z.object({
	name: z.string().trim().min(1).max(200),
	email: z
		.union([z.email(), z.literal("")])
		.optional()
		.transform((v) => (v === "" ? undefined : v)),
	address: z.string().max(500).optional(),
	currencyCode: currencyCodeSchema.optional().default(DEFAULT_CURRENCY),
	notes: z.string().max(2000).optional(),
});

export const projectSchema = z.object({
	name: z.string().trim().min(1).max(200),
	description: z.string().max(2000).optional(),
});

export const clientSearchSchema = z
	.string()
	.trim()
	.max(100)
	.optional()
	.transform((q) => (q === "" ? undefined : q));

export type ClientInput = z.input<typeof clientSchema>;
export type ProjectInput = z.input<typeof projectSchema>;
