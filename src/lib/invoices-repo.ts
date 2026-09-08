import type {
	Invoice,
	InvoiceItem,
	InvoiceStatus,
} from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "./db";
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

const toDate = (yyyyMmDd: string): Date => new Date(`${yyyyMmDd}T00:00:00Z`);

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
): Promise<InvoiceWithItems | null> {
	const existing = await prisma.invoice.findFirst({
		where: { id, userId },
		select: { status: true },
	});
	if (!existing) return null;
	if (existing.status !== "DRAFT") {
		throw new InvoiceTransitionError(
			"Only draft invoices can be edited — the invoice was already sent or paid",
			existing.status,
			"UPDATE",
		);
	}

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
