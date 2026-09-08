import type {
	Invoice,
	InvoiceItem,
	InvoiceStatus,
} from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "./db";
import type { FetchJson } from "./fx/provider";
import { getRate } from "./fx/rate-service";
import {
	InvoiceNumberTakenError,
	resolveInvoiceNumber,
} from "./invoice-numbering";
import { computeInvoiceTotals, type InvoiceTotals } from "./invoice-totals";

/**
 * Data layer for invoices. Every function takes the session user's id
 * explicitly and scopes queries by it — ownership is enforced here,
 * not in the UI. OVERDUE is derived on read (SENT + past due date) and
 * never stored.
 */

export class InvoiceTransitionError extends Error {
	constructor(
		message: string,
		readonly from: InvoiceStatus,
		readonly attempted: "UPDATE" | "DELETE" | "SEND" | "MARK_PAID",
	) {
		super(message);
		this.name = "InvoiceTransitionError";
	}
}

/** Thrown when an invoice references a client/project the user doesn't own. */
export class InvoiceValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InvoiceValidationError";
	}
}

export type DerivedInvoiceStatus = InvoiceStatus | "OVERDUE";

export interface InvoiceWithItems extends Invoice {
	items: InvoiceItem[];
	client: { id: string; name: string };
	derivedStatus: DerivedInvoiceStatus;
	totals: InvoiceTotals;
}

export interface CreateInvoiceData {
	clientId: string;
	projectId?: string;
	invoiceNumber?: string;
	issueDate: string;
	dueDate: string;
	currencyCode: string;
	taxRate: number;
	discountMinor: number;
	items: { description: string; amountMinor: number }[];
}

export interface UpdateInvoiceData {
	issueDate: string;
	dueDate: string;
	currencyCode: string;
	taxRate: number;
	discountMinor: number;
	items: { description: string; amountMinor: number }[];
}

/** Injectable dependencies (tests pass a mock fetchJson to stay hermetic). */
export interface InvoiceRepoDeps {
	fetchJson?: FetchJson;
}

const toDate = (yyyyMmDd: string): Date => new Date(`${yyyyMmDd}T00:00:00Z`);

async function getHomeCurrency(userId: string): Promise<string | null> {
	const profile = await prisma.businessProfile.findUnique({
		where: { userId },
		select: { currency: true },
	});
	return profile?.currency.toUpperCase() ?? null;
}

/**
 * Resolve the FX snapshot for an invoice currency against the account home
 * currency (fx_multi_currency_20260908). Returns null when there is nothing
 * to snapshot: no home currency, same currency, or no rate available
 * (manual override is the caller's fallback). Snapshot value is the
 * invoice-to-home multiplier; fxRateCurrency stores the home code.
 */
async function resolveFxSnapshot(
	userId: string,
	currencyCode: string,
	deps?: InvoiceRepoDeps,
): Promise<{ home: string; rate: Prisma.Decimal } | null> {
	const home = await getHomeCurrency(userId);
	if (!home) return null;
	const currency = currencyCode.toUpperCase();
	if (currency === home) return null;
	const rate = await getRate(home, currency, { fetchJson: deps?.fetchJson });
	return rate === null ? null : { home, rate };
}

function deriveStatus(invoice: {
	status: InvoiceStatus;
	dueDate: Date;
}): DerivedInvoiceStatus {
	if (
		invoice.status === "SENT" &&
		invoice.dueDate.getTime() < new Date().setUTCHours(0, 0, 0, 0)
	) {
		return "OVERDUE";
	}
	return invoice.status;
}

interface DerivedFields {
	status: InvoiceStatus;
	dueDate: Date;
	taxRate: Prisma.Decimal | number;
	discountMinor: number;
	items: { amountMinor: number }[];
}

const withDerived = <T extends DerivedFields>(
	invoice: T,
): T & { derivedStatus: DerivedInvoiceStatus; totals: InvoiceTotals } => ({
	...invoice,
	derivedStatus: deriveStatus(invoice),
	totals: computeInvoiceTotals({
		items: invoice.items,
		taxRate: Number(invoice.taxRate),
		discountMinor: invoice.discountMinor,
	}),
});

export async function createInvoice(
	userId: string,
	data: CreateInvoiceData,
	deps?: InvoiceRepoDeps,
): Promise<InvoiceWithItems> {
	const client = await prisma.client.findFirst({
		where: { id: data.clientId, userId },
		select: { id: true },
	});
	if (!client) {
		throw new InvoiceValidationError(
			"Client not found for this user — invoice must reference an owned client",
		);
	}

	if (data.projectId !== undefined) {
		const project = await prisma.project.findFirst({
			where: { id: data.projectId, clientId: data.clientId },
			select: { id: true },
		});
		if (!project) {
			throw new InvoiceValidationError(
				"Project not found for this client — invoice must reference a project of the same client",
			);
		}
	}

	const year = Number(data.issueDate.slice(0, 4));
	const { number } = await resolveInvoiceNumber({
		userId,
		year,
		manualNumber: data.invoiceNumber,
	});

	// Stamp the FX snapshot the moment the draft gets a non-home currency
	// (spec FR4). Same currency or missing rate -> null; the builder then
	// offers the manual override.
	const snapshot = await resolveFxSnapshot(userId, data.currencyCode, deps);

	try {
		const invoice = await prisma.invoice.create({
			data: {
				userId,
				clientId: data.clientId,
				...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
				invoiceNumber: number,
				status: "DRAFT",
				issueDate: toDate(data.issueDate),
				dueDate: toDate(data.dueDate),
				currencyCode: data.currencyCode,
				taxRate: data.taxRate,
				discountMinor: data.discountMinor,
				...(snapshot
					? { fxRate: snapshot.rate, fxRateCurrency: snapshot.home }
					: {}),
				items: {
					create: data.items.map((item, index) => ({
						...item,
						sortOrder: index,
					})),
				},
			},
			include: {
				items: { orderBy: { sortOrder: "asc" } },
				client: { select: { id: true, name: true } },
			},
		});
		return withDerived(invoice);
	} catch (error) {
		// UNIQUE(userId, invoiceNumber) — race with a concurrent create.
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			throw new InvoiceNumberTakenError(number);
		}
		throw error;
	}
}

async function findOwnedInvoiceWithItems(userId: string, id: string) {
	return prisma.invoice.findFirst({
		where: { id, userId },
		include: {
			items: { orderBy: { sortOrder: "asc" } },
			client: { select: { id: true, name: true } },
		},
	});
}

export async function getInvoice(
	userId: string,
	id: string,
): Promise<InvoiceWithItems | null> {
	const invoice = await findOwnedInvoiceWithItems(userId, id);
	return invoice ? withDerived(invoice) : null;
}

export async function listInvoices(
	userId: string,
): Promise<InvoiceWithItems[]> {
	const invoices = await prisma.invoice.findMany({
		where: { userId },
		orderBy: [{ createdAt: "desc" }, { invoiceNumber: "desc" }],
		include: {
			items: { orderBy: { sortOrder: "asc" } },
			client: { select: { id: true, name: true } },
		},
	});
	return invoices.map(withDerived);
}

export async function updateInvoice(
	userId: string,
	id: string,
	data: UpdateInvoiceData,
	deps?: InvoiceRepoDeps,
): Promise<InvoiceWithItems | null> {
	const existing = await prisma.invoice.findFirst({
		where: { id, userId },
		select: { status: true, currencyCode: true },
	});
	if (!existing) return null;
	if (existing.status !== "DRAFT") {
		throw new InvoiceTransitionError(
			"Only draft invoices can be edited — the invoice was already sent or paid",
			existing.status,
			"UPDATE",
		);
	}

	// Currency changed -> re-derive the snapshot from the rate service,
	// replacing any manual override (spec FR4/FR5). A missing rate clears
	// the stale snapshot instead of keeping values for the old currency.
	// Currency unchanged -> leave fx fields untouched (manual override kept).
	const currencyChanged =
		data.currencyCode.toUpperCase() !== existing.currencyCode.toUpperCase();
	const snapshot = currencyChanged
		? await resolveFxSnapshot(userId, data.currencyCode, deps)
		: null;

	const updated = await prisma.$transaction(async (tx) => {
		await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
		return tx.invoice.update({
			where: { id },
			data: {
				issueDate: toDate(data.issueDate),
				dueDate: toDate(data.dueDate),
				currencyCode: data.currencyCode,
				taxRate: data.taxRate,
				discountMinor: data.discountMinor,
				...(currencyChanged
					? {
							fxRate: snapshot?.rate ?? null,
							fxRateCurrency: snapshot?.home ?? null,
						}
					: {}),
				items: {
					create: data.items.map((item, index) => ({
						...item,
						sortOrder: index,
					})),
				},
			},
			include: {
				items: { orderBy: { sortOrder: "asc" } },
				client: { select: { id: true, name: true } },
			},
		});
	});
	return withDerived(updated);
}

export async function deleteInvoice(
	userId: string,
	id: string,
): Promise<boolean> {
	const existing = await prisma.invoice.findFirst({
		where: { id, userId },
		select: { status: true },
	});
	if (!existing) return false;
	if (existing.status !== "DRAFT") {
		throw new InvoiceTransitionError(
			"Only draft invoices can be deleted — the invoice was already sent or paid",
			existing.status,
			"DELETE",
		);
	}
	await prisma.invoice.delete({ where: { id } });
	return true;
}

export async function sendInvoice(
	userId: string,
	id: string,
): Promise<InvoiceWithItems> {
	const existing = await prisma.invoice.findFirst({
		where: { id, userId },
		select: { status: true },
	});
	if (!existing) {
		throw new InvoiceTransitionError("Invoice not found", "DRAFT", "SEND");
	}
	if (existing.status !== "DRAFT") {
		throw new InvoiceTransitionError(
			"Only draft invoices can be sent",
			existing.status,
			"SEND",
		);
	}
	const sent = await prisma.invoice.update({
		where: { id },
		data: { status: "SENT", sentAt: new Date() },
		include: {
			items: { orderBy: { sortOrder: "asc" } },
			client: { select: { id: true, name: true } },
		},
	});
	return withDerived(sent);
}

export async function markPaidInvoice(
	userId: string,
	id: string,
): Promise<InvoiceWithItems> {
	const existing = await prisma.invoice.findFirst({
		where: { id, userId },
		select: { status: true },
	});
	if (!existing) {
		throw new InvoiceTransitionError("Invoice not found", "DRAFT", "MARK_PAID");
	}
	if (existing.status !== "SENT") {
		throw new InvoiceTransitionError(
			"Only sent invoices can be marked as paid",
			existing.status,
			"MARK_PAID",
		);
	}
	const paid = await prisma.invoice.update({
		where: { id },
		data: { status: "PAID", paidAt: new Date() },
		include: {
			items: { orderBy: { sortOrder: "asc" } },
			client: { select: { id: true, name: true } },
		},
	});
	return withDerived(paid);
}
