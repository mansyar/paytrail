/**
 * Maps a persisted invoice aggregate + business profile to the renderer
 * input (see invoice-pdf.ts). Pure mapping — no DB access; the caller
 * (route handler / server action) fetches the data user-scoped.
 */
import type { Invoice, InvoiceItem } from "../generated/prisma/client";
import type { InvoicePdfInput, InvoicePdfStatus } from "./invoice-pdf";

/** Structural subset of the BusinessProfile the PDF needs. */
export interface InvoicePdfProfile {
	businessName: string;
	addressLine1: string | null;
	addressLine2: string | null;
	contactEmail: string | null;
	taxId: string | null;
	logo: string | null;
	paymentTerms: string | null;
}

export interface InvoicePdfAggregate {
	invoice: Invoice;
	items: InvoiceItem[];
	projectName: string | null;
}

export function buildInvoicePdfInput(
	aggregate: InvoicePdfAggregate,
	profile: InvoicePdfProfile | null,
): InvoicePdfInput {
	const { invoice, items, projectName } = aggregate;
	return {
		invoiceNumber: invoice.invoiceNumber,
		// Stored status, not the derived one: OVERDUE invoices render clean;
		// only DRAFT gets the watermark.
		status: invoice.status as InvoicePdfStatus,
		issueDate: invoice.issueDate,
		dueDate: invoice.dueDate,
		currencyCode: invoice.currencyCode,
		taxRate: Number(invoice.taxRate),
		discountMinor: invoice.discountMinor,
		items: items.map((item) => ({
			description: item.description,
			amountMinor: item.amountMinor,
		})),
		businessName: profile?.businessName ?? "",
		businessAddressLines: [profile?.addressLine1, profile?.addressLine2]
			.map((line) => line?.trim() ?? "")
			.filter((line) => line.length > 0),
		businessTaxId: profile?.taxId ?? null,
		businessContactEmail: profile?.contactEmail ?? null,
		logoBase64: profile?.logo ?? null,
		clientName: "",
		projectName,
		paymentTerms: profile?.paymentTerms ?? null,
	};
}
