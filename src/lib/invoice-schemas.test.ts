import { describe, expect, it } from "vitest";
import {
	createInvoiceDataSchema,
	createInvoiceInputSchema,
	invoiceIdSchema,
	updateInvoiceDataSchema,
	updateInvoiceInputSchema,
} from "./invoice-schemas";

const validCreateInput = {
	clientId: "client_123",
	issueDate: "2026-09-08",
	dueDate: "2026-09-22",
	currencyCode: "USD",
	taxRate: "10",
	discount: "5.50",
	items: [
		{ description: "Garden cleanup", amount: "120.00" },
		{ description: "Hedge trimming", amount: "80.25" },
	],
};

describe("invoiceIdSchema", () => {
	it("accepts a non-empty string id", () => {
		expect(invoiceIdSchema.parse("cuid123")).toBe("cuid123");
	});

	it("rejects empty or whitespace-only ids", () => {
		expect(() => invoiceIdSchema.parse("   ")).toThrow();
		expect(() => invoiceIdSchema.parse("")).toThrow();
	});
});

describe("createInvoiceInputSchema — transform-free input", () => {
	it("accepts a valid form payload without transforming values", () => {
		const parsed = createInvoiceInputSchema.parse(validCreateInput);
		// Transform-free: strings stay strings so RHF gets its own types.
		expect(parsed.taxRate).toBe("10");
		expect(parsed.items[0].amount).toBe("120.00");
	});

	it("rejects an empty item list", () => {
		expect(() =>
			createInvoiceInputSchema.parse({ ...validCreateInput, items: [] }),
		).toThrow();
	});

	it("rejects malformed money amounts", () => {
		expect(() =>
			createInvoiceInputSchema.parse({
				...validCreateInput,
				items: [{ description: "x", amount: "12,00" }],
			}),
		).toThrow();
		expect(() =>
			createInvoiceInputSchema.parse({
				...validCreateInput,
				items: [{ description: "x", amount: "-5.00" }],
			}),
		).toThrow();
	});

	it("rejects malformed or unparseable dates", () => {
		expect(() =>
			createInvoiceInputSchema.parse({
				...validCreateInput,
				issueDate: "09/08/2026",
			}),
		).toThrow();
		expect(() =>
			createInvoiceInputSchema.parse({
				...validCreateInput,
				dueDate: "2026-02-30",
			}),
		).toThrow();
	});

	it("rejects dueDate earlier than issueDate", () => {
		expect(() =>
			createInvoiceInputSchema.parse({
				...validCreateInput,
				dueDate: "2026-09-01",
			}),
		).toThrow();
	});

	it("rejects tax rates above 100 or malformed", () => {
		expect(() =>
			createInvoiceInputSchema.parse({ ...validCreateInput, taxRate: "150" }),
		).toThrow();
		expect(() =>
			createInvoiceInputSchema.parse({ ...validCreateInput, taxRate: "abc" }),
		).toThrow();
	});

	it("rejects unknown currency codes", () => {
		expect(() =>
			createInvoiceInputSchema.parse({
				...validCreateInput,
				currencyCode: "XYZ",
			}),
		).toThrow();
	});

	it("accepts an optional manual invoice number in INV-YYYY-NNNN format", () => {
		expect(
			createInvoiceInputSchema.parse({
				...validCreateInput,
				invoiceNumber: "INV-2026-0007",
			}).invoiceNumber,
		).toBe("INV-2026-0007");
		expect(() =>
			createInvoiceInputSchema.parse({
				...validCreateInput,
				invoiceNumber: "nope-1",
			}),
		).toThrow();
	});

	it("accepts an optional projectId", () => {
		const parsed = createInvoiceInputSchema.parse({
			...validCreateInput,
			projectId: "proj_1",
		});
		expect(parsed.projectId).toBe("proj_1");
	});
});

describe("createInvoiceDataSchema — transforming output", () => {
	it("converts money strings to integer minor units", () => {
		const data = createInvoiceDataSchema.parse(validCreateInput);
		expect(data.items[0].amountMinor).toBe(12000);
		expect(data.items[1].amountMinor).toBe(8025);
		expect(data.discountMinor).toBe(550);
		expect(data.taxRate).toBe(10);
		expect(data.currencyCode).toBe("USD");
	});

	it("defaults taxRate to 0 and discount to 0 when omitted", () => {
		const data = createInvoiceDataSchema.parse({
			clientId: "client_123",
			issueDate: "2026-09-08",
			dueDate: "2026-09-22",
			currencyCode: "USD",
			items: [{ description: "x", amount: "10" }],
		});
		expect(data.taxRate).toBe(0);
		expect(data.discountMinor).toBe(0);
	});

	it("treats empty-string manual number as absent", () => {
		const data = createInvoiceDataSchema.parse({
			...validCreateInput,
			invoiceNumber: "",
		});
		expect(data.invoiceNumber).toBeUndefined();
	});
});

describe("updateInvoiceInputSchema / updateInvoiceDataSchema", () => {
	it("accepts the same shape as create without clientId", () => {
		const input = {
			issueDate: "2026-09-08",
			dueDate: "2026-09-22",
			currencyCode: "EUR",
			taxRate: "0",
			discount: "0",
			items: [{ description: "Only task", amount: "42.00" }],
		};
		const data = updateInvoiceDataSchema.parse(
			updateInvoiceInputSchema.parse(input),
		);
		expect(data.items[0].amountMinor).toBe(4200);
		expect(data.currencyCode).toBe("EUR");
	});

	it("rejects dueDate earlier than issueDate", () => {
		expect(() =>
			updateInvoiceInputSchema.parse({
				issueDate: "2026-09-08",
				dueDate: "2026-01-01",
				currencyCode: "USD",
				items: [{ description: "x", amount: "1.00" }],
			}),
		).toThrow();
	});
});
