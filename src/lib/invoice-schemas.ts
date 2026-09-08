import { CURRENCIES } from "./schemas";
import { z } from "zod";

/**
 * Invoice CRUD schemas, split per tech-stack convention:
 * - Input schemas are transform-free (RHF zodResolver-friendly; form fields
 *   stay strings). They are re-validated server-side before the transform.
 * - Data schemas perform the transform (string money → integer minor units).
 */

const moneyString = z
	.string()
	.regex(
		/^\d{1,10}(\.\d{1,2})?$/,
		"Must be a non-negative number with at most 2 decimals",
	);

const taxRateString = z
	.string()
	.regex(/^\d{1,3}(\.\d{1,2})?$/, "Must be a non-negative number with at most 2 decimals")
	.refine((v) => Number(v) <= 100, "Must be at most 100");

const dateString = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a YYYY-MM-DD date")
	.refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), {
		message: "Must be a real calendar date",
	});

const optionalInvoiceNumber = z.preprocess(
	(v) => (v === "" || v == null ? undefined : v),
	z
		.string()
		.regex(/^INV-\d{4}-\d{4,}$/, "Must match INV-<year>-<sequence>, e.g. INV-2026-0001")
		.optional(),
);

export const invoiceIdSchema = z.string().trim().min(1);

const invoiceItemInputSchema = z.object({
	description: z.string().trim().min(1).max(500),
	amount: moneyString,
});

const invoiceItemDataSchema = invoiceItemInputSchema.transform(
	({ description, amount }) => ({
		description,
		amountMinor: Math.round(Number(amount) * 100),
	}),
);

const createBaseFields = {
	issueDate: dateString,
	dueDate: dateString,
	currencyCode: z.enum(CURRENCIES),
	taxRate: taxRateString.default("0"),
	discount: moneyString.default("0"),
	items: z.array(invoiceItemInputSchema).min(1, "At least one line item is required").max(100),
};

const dateOrderRefine = <T extends { issueDate: string; dueDate: string }>(
	data: T,
) => new Date(`${data.dueDate}T00:00:00Z`) >= new Date(`${data.issueDate}T00:00:00Z`);

export const createInvoiceInputSchema = z
	.object({
		clientId: z.string().trim().min(1),
		projectId: z.preprocess(
			(v) => (v === "" || v == null ? undefined : v),
			z.string().trim().min(1).optional(),
		),
		invoiceNumber: optionalInvoiceNumber,
		...createBaseFields,
	})
	.refine(dateOrderRefine, {
		message: "Due date must be on or after the issue date",
		path: ["dueDate"],
	});

export const createInvoiceDataSchema = z
	.object({
		clientId: z.string().trim().min(1),
		projectId: z.string().trim().min(1).optional(),
		invoiceNumber: optionalInvoiceNumber,
		...createBaseFields,
	})
	.refine(dateOrderRefine, {
		message: "Due date must be on or after the issue date",
		path: ["dueDate"],
	})
	.transform(({ items, taxRate, discount, ...rest }) => ({
		...rest,
		taxRate: Number(taxRate),
		discountMinor: Math.round(Number(discount) * 100),
		items: items.map((item) =>
			invoiceItemDataSchema.parse(item),
		),
	}));

export const updateInvoiceInputSchema = z
	.object({
		issueDate: dateString,
		dueDate: dateString,
		currencyCode: z.enum(CURRENCIES),
		taxRate: taxRateString.default("0"),
		discount: moneyString.default("0"),
		items: z.array(invoiceItemInputSchema).min(1, "At least one line item is required").max(100),
	})
	.refine(dateOrderRefine, {
		message: "Due date must be on or after the issue date",
		path: ["dueDate"],
	});

export const updateInvoiceDataSchema = z
	.object({
		issueDate: dateString,
		dueDate: dateString,
		currencyCode: z.enum(CURRENCIES),
		taxRate: taxRateString.default("0"),
		discount: moneyString.default("0"),
		items: z.array(invoiceItemInputSchema).min(1, "At least one line item is required").max(100),
	})
	.refine(dateOrderRefine, {
		message: "Due date must be on or after the issue date",
		path: ["dueDate"],
	})
	.transform(({ items, taxRate, discount, ...rest }) => ({
		...rest,
		taxRate: Number(taxRate),
		discountMinor: Math.round(Number(discount) * 100),
		items: items.map((item) => invoiceItemDataSchema.parse(item)),
	}));

export type CreateInvoiceInput = z.input<typeof createInvoiceInputSchema>;
export type CreateInvoiceData = z.output<typeof createInvoiceDataSchema>;
export type UpdateInvoiceInput = z.input<typeof updateInvoiceInputSchema>;
export type UpdateInvoiceData = z.output<typeof updateInvoiceDataSchema>;
