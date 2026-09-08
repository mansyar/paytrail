import { describe, expect, it } from "vitest";
import { buildInvoiceMailto } from "./invoice-email-draft";

function makeInput(overrides = {}) {
	return {
		invoiceNumber: "INV-2026-0001",
		clientName: "Breezeway Properties",
		clientEmail: "ap@breezeway.example",
		currencyCode: "USD",
		totalMinor: 22050,
		dueDate: new Date("2026-10-01T00:00:00Z"),
		businessName: "Acme Cleaning Co",
		paymentTerms: "net_14",
		...overrides,
	};
}

describe("buildInvoiceMailto", () => {
	it("builds a mailto link with the recipient and encoded subject", () => {
		const href = buildInvoiceMailto(makeInput());
		expect(href.startsWith("mailto:ap@breezeway.example?")).toBe(true);
		expect(href).toContain(
			`subject=${encodeURIComponent("Invoice INV-2026-0001 from Acme Cleaning Co")}`,
		);
	});

	it("keeps the body concise: greeting, amount, due date, terms — no line items", () => {
		const href = buildInvoiceMailto(makeInput());
		const body = decodeURIComponent(
			new URL(
				href.replace("mailto:", "mailto:x?").replace("mailto:x?", "http://x/?"),
			).searchParams.get("body") ?? "",
		);
		expect(body).toContain("Hi Breezeway Properties,");
		expect(body).toContain("INV-2026-0001");
		expect(body).toContain("USD 220.50");
		expect(body).toContain("October 1, 2026");
		expect(body).toContain("Payment terms: Net 14");
		expect(body).not.toContain("Clean -");
	});

	it("maps payment terms values to plain language labels", () => {
		const href = buildInvoiceMailto(makeInput({ paymentTerms: "net_30" }));
		expect(decodeURIComponent(href)).toContain("Payment terms: Net 30");
	});

	it("omits the payment terms line when the profile has none", () => {
		const href = buildInvoiceMailto(makeInput({ paymentTerms: null }));
		const decoded = decodeURIComponent(href);
		expect(decoded).not.toContain("Payment terms");
	});

	it("falls back to an empty recipient when the client has no email", () => {
		const href = buildInvoiceMailto(makeInput({ clientEmail: null }));
		expect(href.startsWith("mailto:?subject=")).toBe(true);
	});

	it("signs off with the business name", () => {
		const href = buildInvoiceMailto(makeInput());
		expect(decodeURIComponent(href)).toContain("Thank you,\nAcme Cleaning Co");
	});
});
