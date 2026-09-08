import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";
import { type InvoicePdfInput, renderInvoicePdf } from "./invoice-pdf";

// 1x1 transparent PNG, valid base64 — enough for pdfkit to embed.
const TINY_PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function makeInput(overrides: Partial<InvoicePdfInput> = {}): InvoicePdfInput {
	return {
		invoiceNumber: "INV-2026-0001",
		status: "SENT",
		issueDate: new Date("2026-09-01"),
		dueDate: new Date("2026-10-01"),
		currencyCode: "USD",
		taxRate: 5,
		discountMinor: 500,
		items: [
			{ description: "Clean - Beach House", amountMinor: 12000 },
			{ description: "Clean - Loft", amountMinor: 9500 },
		],
		businessName: "Acme Cleaning Co",
		businessAddressLines: ["123 Main St", "Springfield, IL 62701"],
		businessTaxId: "TAX-123456",
		businessContactEmail: "billing@acme.example",
		logoBase64: TINY_PNG_BASE64,
		clientName: "Breezeway Properties",
		projectName: "September turnover",
		paymentTerms: "Net 14",
		...overrides,
	};
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
	const pdf = await getDocumentProxy(bytes);
	const { text } = await extractText(pdf, { mergePages: true });
	return text;
}

describe("renderInvoicePdf", () => {
	it("returns a valid PDF document", async () => {
		const bytes = await renderInvoicePdf(makeInput());
		const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
		expect(header).toBe("%PDF-");
	});

	it("includes invoice number, client, and ISO-code-prefixed total", async () => {
		const bytes = await renderInvoicePdf(makeInput());
		const text = await extractPdfText(bytes);
		// subtotal 21500 minor → $215.00; discount $5 applied before tax → taxable $210.00;
		// tax 5% = $10.50 → total $220.50
		expect(text).toContain("INV-2026-0001");
		expect(text).toContain("Breezeway Properties");
		expect(text).toContain("USD 215.00"); // subtotal
		expect(text).toContain("USD 220.50"); // total due
	});

	it("marks DRAFT invoices with a DRAFT watermark", async () => {
		const draft = await extractPdfText(
			await renderInvoicePdf(makeInput({ status: "DRAFT" })),
		);
		// Rotated glyph extraction can insert whitespace; normalize before matching.
		expect(draft.replace(/\s+/g, "")).toContain("DRAFT");
	});

	it("renders SENT invoices without a DRAFT watermark", async () => {
		const sent = await extractPdfText(await renderInvoicePdf(makeInput()));
		expect(sent.replace(/\s+/g, "")).not.toContain("DRAFT");
	});

	it("renders a valid PDF when the business profile has no logo", async () => {
		const bytes = await renderInvoicePdf(makeInput({ logoBase64: null }));
		const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
		expect(header).toBe("%PDF-");
	});

	it("renders with only the required fields set (optional fields null/empty)", async () => {
		const bytes = await renderInvoicePdf(
			makeInput({
				businessAddressLines: [],
				businessTaxId: null,
				businessContactEmail: null,
				logoBase64: null,
				projectName: null,
				paymentTerms: null,
			}),
		);
		const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
		expect(header).toBe("%PDF-");
		const text = await extractPdfText(bytes);
		expect(text).toContain("Acme Cleaning Co");
	});

	it("flows many line items across pages without error", async () => {
		const items = Array.from({ length: 30 }, (_, i) => ({
			description: `Clean - Property ${i + 1}`,
			amountMinor: 10000,
		}));
		const bytes = await renderInvoicePdf(makeInput({ items }));
		const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
		expect(header).toBe("%PDF-");
		const text = await extractPdfText(bytes);
		expect(text).toContain("Property 30");
	});
});
