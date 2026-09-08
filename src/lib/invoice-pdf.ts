/**
 * Client-facing invoice PDF renderer (pdfkit). Produces a single fixed
 * professional template: business header with optional logo, bill-to block,
 * itemized table that flows across pages, tax/discount/total block, and
 * payment terms. DRAFT invoices get a light-gray diagonal watermark.
 *
 * Pure function of its input — no DB access. All money is integer minor
 * units; totals math is delegated to computeInvoiceTotals (discount applied
 * before tax, clamped at the subtotal, half-up rounding).
 */
import PDFDocument from "pdfkit";
import { computeInvoiceTotals } from "./invoice-totals";

export interface InvoicePdfItem {
	description: string;
	amountMinor: number;
}

export type InvoicePdfStatus = "DRAFT" | "SENT" | "PAID";

export interface InvoicePdfInput {
	invoiceNumber: string;
	status: InvoicePdfStatus;
	issueDate: Date;
	dueDate: Date;
	currencyCode: string;
	taxRate: number;
	discountMinor: number;
	items: InvoicePdfItem[];
	businessName: string;
	businessAddressLines: string[];
	businessTaxId: string | null;
	businessContactEmail: string | null;
	/** Raw PNG/JPEG bytes base64-encoded, optionally wrapped in a data URL; null when absent. */
	logoBase64: string | null;
	clientName: string;
	projectName: string | null;
	paymentTerms: string | null;
}

const PAGE_MARGIN = 50;
const DARK = "#111827";
const GRAY = "#6b7280";
const LIGHT = "#9ca3af";

/** PDFs label currency with the ISO code prefix, e.g. "USD 1,234.50". */
export function formatMoneyIso(minor: number, currencyCode: string): string {
	const amount = new Intl.NumberFormat("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(minor / 100);
	return `${currencyCode} ${amount}`;
}

/** Dates are stored as UTC midnights; format them in UTC so the day never shifts. */
function formatDateUtc(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeZone: "UTC",
	}).format(date);
}

function decodeLogo(logoBase64: string): Buffer | null {
	try {
		const raw = logoBase64.includes(",")
			? logoBase64.slice(logoBase64.indexOf(",") + 1)
			: logoBase64;
		const buffer = Buffer.from(raw, "base64");
		return buffer.length > 0 ? buffer : null;
	} catch {
		return null;
	}
}

export async function renderInvoicePdf(
	input: InvoicePdfInput,
): Promise<Uint8Array> {
	const doc = new PDFDocument({
		size: "A4",
		margin: PAGE_MARGIN,
		bufferPages: true,
		info: { Title: input.invoiceNumber },
	});
	const chunks: Buffer[] = [];
	const done = new Promise<Uint8Array>((resolve, reject) => {
		doc.on("data", (chunk: Buffer) => chunks.push(chunk));
		doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
		doc.on("error", reject);
	});

	const pageWidth = doc.page.width;
	const pageHeight = doc.page.height;
	const contentRight = pageWidth - PAGE_MARGIN;

	// --- Header: business identity (left) vs invoice meta (right) ---
	let headerBottom = PAGE_MARGIN;
	const logo = input.logoBase64 ? decodeLogo(input.logoBase64) : null;
	if (logo) {
		try {
			doc.image(logo, PAGE_MARGIN, PAGE_MARGIN, { fit: [100, 60] });
		} catch {
			// Unsupported or corrupt logo data — skip the block gracefully.
		}
		headerBottom = PAGE_MARGIN + 65;
	}

	doc.fillColor(DARK).font("Helvetica-Bold").fontSize(14);
	doc.text(input.businessName, PAGE_MARGIN, headerBottom);
	doc.font("Helvetica").fontSize(9).fillColor(GRAY);
	for (const line of input.businessAddressLines) {
		if (line) doc.text(line);
	}
	if (input.businessTaxId) doc.text(`Tax ID: ${input.businessTaxId}`);
	if (input.businessContactEmail) doc.text(input.businessContactEmail);
	headerBottom = doc.y;

	doc.fontSize(20).fillColor(DARK).font("Helvetica-Bold");
	doc.text("INVOICE", 340, PAGE_MARGIN, { width: contentRight - 340, align: "right" });
	doc.fontSize(11);
	doc.text(input.invoiceNumber, 340, doc.y + 4, {
		width: contentRight - 340,
		align: "right",
	});
	doc.font("Helvetica").fontSize(9).fillColor(GRAY);
	doc.text(`Issued: ${formatDateUtc(input.issueDate)}`, 340, doc.y + 6, {
		width: contentRight - 340,
		align: "right",
	});
	doc.text(`Due: ${formatDateUtc(input.dueDate)}`, 340, doc.y, {
		width: contentRight - 340,
		align: "right",
	});
	headerBottom = Math.max(headerBottom, doc.y) + 24;

	// --- Bill-to block ---
	doc.font("Helvetica-Bold").fontSize(8).fillColor(LIGHT);
	doc.text("BILLED TO", PAGE_MARGIN, headerBottom);
	doc.font("Helvetica-Bold").fontSize(12).fillColor(DARK);
	doc.text(input.clientName, PAGE_MARGIN, doc.y + 4);
	if (input.projectName) {
		doc.font("Helvetica").fontSize(9).fillColor(GRAY);
		doc.text(input.projectName);
	}

	// --- Items table (flows across pages, header row repeated) ---
	const amountColumnLeft = 400;
	let y = doc.y + 24;
	const drawTableHeader = () => {
		doc.font("Helvetica-Bold").fontSize(8).fillColor(LIGHT);
		doc.text("DESCRIPTION", PAGE_MARGIN, y);
		doc.text("AMOUNT", amountColumnLeft, y, {
			width: contentRight - amountColumnLeft,
			align: "right",
		});
		doc
			.moveTo(PAGE_MARGIN, y + 14)
			.lineTo(contentRight, y + 14)
			.strokeColor(GRAY)
			.lineWidth(0.5)
			.stroke();
		y += 20;
	};
	drawTableHeader();

	const rowHeight = 22;
	for (const item of input.items) {
		if (y + rowHeight > pageHeight - PAGE_MARGIN) {
			doc.addPage();
			y = PAGE_MARGIN;
			drawTableHeader();
		}
		doc.font("Helvetica").fontSize(10).fillColor(DARK);
		doc.text(item.description, PAGE_MARGIN, y, { width: 330, lineBreak: false });
		doc.text(
			formatMoneyIso(item.amountMinor, input.currencyCode),
			amountColumnLeft,
			y,
			{ width: contentRight - amountColumnLeft, align: "right", lineBreak: false },
		);
		y += rowHeight;
	}

	// --- Totals block (once, on the final page) ---
	const totals = computeInvoiceTotals({
		items: input.items,
		taxRate: input.taxRate,
		discountMinor: input.discountMinor,
	});
	const totalsLabelX = 380;
	if (y + 90 > pageHeight - PAGE_MARGIN) {
		doc.addPage();
		y = PAGE_MARGIN;
	}
	y += 12;
	doc.moveTo(totalsLabelX, y).lineTo(contentRight, y).strokeColor(GRAY).lineWidth(0.5).stroke();
	y += 8;
	const totalsRow = (label: string, value: string, bold = false) => {
		doc.font(bold ? "Helvetica-Bold" : "Helvetica")
			.fontSize(bold ? 12 : 10)
			.fillColor(bold ? DARK : GRAY);
		doc.text(label, totalsLabelX, y);
		doc.text(value, amountColumnLeft, y, {
			width: contentRight - amountColumnLeft,
			align: "right",
		});
		y += bold ? 20 : 16;
	};
	totalsRow("Subtotal", formatMoneyIso(totals.subtotalMinor, input.currencyCode));
	totalsRow(
		`Tax (${input.taxRate}%)`,
		formatMoneyIso(totals.taxMinor, input.currencyCode),
	);
	if (totals.discountAppliedMinor > 0) {
		totalsRow(
			"Discount",
			`- ${formatMoneyIso(totals.discountAppliedMinor, input.currencyCode)}`,
		);
	}
	totalsRow(
		"Total Due",
		formatMoneyIso(totals.totalMinor, input.currencyCode),
		true,
	);

	if (input.paymentTerms) {
		doc.font("Helvetica").fontSize(9).fillColor(GRAY);
		doc.text(`Payment terms: ${input.paymentTerms}`, totalsLabelX, y + 4);
	}

	// --- DRAFT watermark on every page ---
	if (input.status === "DRAFT") {
		const range = doc.bufferedPageRange();
		for (let i = 0; i < range.count; i++) {
			doc.switchToPage(i);
			doc.save();
			doc.fillColor("#9ca3af").opacity(0.2).font("Helvetica-Bold").fontSize(96);
			const cx = doc.page.width / 2;
			const cy = doc.page.height / 2;
			doc.rotate(Math.PI / 4, { origin: [cx, cy] });
			doc.text("DRAFT", cx - 200, cy - 50, {
				width: 400,
				align: "center",
				lineBreak: false,
			});
			doc.restore();
		}
	}

	doc.end();
	return done;
}
