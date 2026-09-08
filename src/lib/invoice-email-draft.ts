/**
 * Builds the prefilled mailto: draft for sending an invoice manually.
 * The email is a concise summary — greeting, amount due, due date, payment
 * terms — never the line items. The user attaches the downloaded PDF.
 */
import { formatMoneyIso } from "./invoice-pdf";

export interface InvoiceEmailDraftInput {
	invoiceNumber: string;
	clientName: string;
	clientEmail: string | null;
	currencyCode: string;
	totalMinor: number;
	dueDate: Date;
	businessName: string;
	/** Stored enum value, e.g. "net_14"; null when the profile has none. */
	paymentTerms: string | null;
}

function formatDateLong(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "long",
		timeZone: "UTC",
	}).format(date);
}

function formatPaymentTerms(terms: string): string | null {
	const match = /^net_(\d+)$/.exec(terms);
	return match ? `Net ${match[1]}` : null;
}

export function buildInvoiceMailto(input: InvoiceEmailDraftInput): string {
	const lines = [
		`Hi ${input.clientName},`,
		"",
		`Please find your invoice ${input.invoiceNumber} attached.`,
		"",
		`Amount due: ${formatMoneyIso(input.totalMinor, input.currencyCode)}`,
		`Due date: ${formatDateLong(input.dueDate)}`,
	];
	const terms = input.paymentTerms
		? formatPaymentTerms(input.paymentTerms)
		: null;
	if (terms) {
		lines.push(`Payment terms: ${terms}`);
	}
	lines.push("", "Thank you,", input.businessName);

	const subject = `Invoice ${input.invoiceNumber} from ${input.businessName}`;
	const recipient = input.clientEmail?.trim() || "";
	return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}
