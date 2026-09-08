import { describe, expect, it } from "vitest";
import {
	type Invoice,
	type InvoiceItem,
	Prisma,
} from "../generated/prisma/client";
import { buildInvoicePdfInput } from "./invoice-pdf-mapper";

type TestProfile = {
	businessName: string;
	addressLine1: string | null;
	addressLine2: string | null;
	contactEmail: string | null;
	taxId: string | null;
	logo: string | null;
	paymentTerms: string | null;
};

function makeItem(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
	return {
		id: "item-1",
		invoiceId: "inv-1",
		description: "Clean - Beach House",
		amountMinor: 12000,
		sortOrder: 0,
		...overrides,
	};
}

function makeInvoice(
	overrides: Partial<Invoice & { client: { name: string } }> = {},
): Invoice & { client: { name: string } } {
	return {
		id: "inv-1",
		userId: "user-1",
		clientId: "client-1",
		client: { name: "Breezeway Properties" },
		projectId: null,
		invoiceNumber: "INV-2026-0001",
		status: "DRAFT",
		issueDate: new Date("2026-09-01T00:00:00Z"),
		dueDate: new Date("2026-10-01T00:00:00Z"),
		currencyCode: "USD",
		taxRate: new Prisma.Decimal(5),
		discountMinor: 500,
		fxRate: null,
		fxRateCurrency: null,
		sentAt: null,
		paidAt: null,
		createdAt: new Date("2026-09-01T00:00:00Z"),
		updatedAt: new Date("2026-09-01T00:00:00Z"),
		...overrides,
	};
}

const profile: TestProfile = {
	businessName: "Acme Cleaning Co",
	addressLine1: "123 Main St",
	addressLine2: "Springfield, IL 62701",
	contactEmail: "billing@acme.example",
	taxId: "TAX-123456",
	logo: "data:image/png;base64,aGVsbG8=",
	paymentTerms: "net_14",
};

describe("buildInvoicePdfInput", () => {
	it("maps invoice, profile, and project name to the renderer input", () => {
		const input = buildInvoicePdfInput(
			{
				invoice: makeInvoice(),
				items: [makeItem()],
				projectName: "September turnover",
			},
			profile,
		);
		expect(input).toMatchObject({
			invoiceNumber: "INV-2026-0001",
			status: "DRAFT",
			currencyCode: "USD",
			taxRate: 5,
			discountMinor: 500,
			businessName: "Acme Cleaning Co",
			businessAddressLines: ["123 Main St", "Springfield, IL 62701"],
			businessTaxId: "TAX-123456",
			businessContactEmail: "billing@acme.example",
			logoBase64: "data:image/png;base64,aGVsbG8=",
			clientName: "Breezeway Properties",
			projectName: "September turnover",
			paymentTerms: "net_14",
			items: [{ description: "Clean - Beach House", amountMinor: 12000 }],
		});
	});

	it("maps a nullable profile to an empty business block", () => {
		const input = buildInvoicePdfInput(
			{ invoice: makeInvoice(), items: [], projectName: null },
			null,
		);
		expect(input.businessName).toBe("");
		expect(input.businessAddressLines).toEqual([]);
		expect(input.businessTaxId).toBeNull();
		expect(input.logoBase64).toBeNull();
		expect(input.paymentTerms).toBeNull();
	});

	it("omits null or blank profile address lines", () => {
		const input = buildInvoicePdfInput(
			{ invoice: makeInvoice(), items: [], projectName: null },
			{ ...profile, addressLine1: null, addressLine2: "  " },
		);
		expect(input.businessAddressLines).toEqual([]);
	});

	it("uses the stored invoice status (not the derived status) for the watermark", () => {
		// A SENT invoice past its due date derives to OVERDUE, but the PDF
		// watermark only applies to DRAFT.
		const input = buildInvoicePdfInput(
			{
				invoice: makeInvoice({ status: "SENT" }),
				items: [],
				projectName: null,
			},
			profile,
		);
		expect(input.status).toBe("SENT");
	});

	it("maps items in the provided order", () => {
		const items = [
			makeItem({ id: "a", description: "First", sortOrder: 0 }),
			makeItem({ id: "b", description: "Second", sortOrder: 1 }),
		];
		const input = buildInvoicePdfInput(
			{ invoice: makeInvoice(), items, projectName: null },
			profile,
		);
		expect(input.items.map((item) => item.description)).toEqual([
			"First",
			"Second",
		]);
	});
});
