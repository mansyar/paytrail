"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { InvoiceNumberTakenError } from "./invoice-numbering";
import {
	type CreateInvoiceInput,
	createInvoiceDataSchema,
	fxRateDataSchema,
	invoiceIdSchema,
	type UpdateInvoiceInput,
	updateInvoiceDataSchema,
} from "./invoice-schemas";
import {
	createInvoice as createInvoiceRepo,
	deleteInvoice as deleteInvoiceRepo,
	getInvoice as getInvoiceRepo,
	InvoiceTransitionError,
	InvoiceValidationError,
	type InvoiceWithItems,
	listInvoices as listInvoicesRepo,
	markPaidInvoice as markPaidInvoiceRepo,
	sendInvoice as sendInvoiceRepo,
	setInvoiceFxRate as setInvoiceFxRateRepo,
	updateInvoice as updateInvoiceRepo,
} from "./invoices-repo";

/**
 * "use server" wrappers around the invoice data layer. The session user
 * is resolved here and passed down explicitly, and every action
 * re-validates its input with Zod before delegating. All business logic
 * (numbering, totals, transitions) lives in the repo layer.
 */

async function requireUserId(): Promise<string> {
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	if (!session) {
		redirect("/login");
	}
	return session.user.id;
}

type ValidationIssue = { path: string; message: string };

/**
 * Plain, Flight-serializable invoice snapshot. Server-action results
 * cross the RSC boundary to client components, so Prisma-only types
 * (Decimal taxRate, Date fields) must not leak into the return value.
 */
export type SerializableInvoice = {
	id: string;
	invoiceNumber: string;
	status: InvoiceWithItems["status"];
	derivedStatus: InvoiceWithItems["derivedStatus"];
	clientId: string;
	projectId: string | null;
	currencyCode: string;
	issueDate: string;
	dueDate: string;
	totalMinor: number;
};

function toSerializableInvoice(invoice: InvoiceWithItems): SerializableInvoice {
	return {
		id: invoice.id,
		invoiceNumber: invoice.invoiceNumber,
		status: invoice.status,
		derivedStatus: invoice.derivedStatus,
		clientId: invoice.clientId,
		projectId: invoice.projectId,
		currencyCode: invoice.currencyCode,
		issueDate: invoice.issueDate.toISOString().slice(0, 10),
		dueDate: invoice.dueDate.toISOString().slice(0, 10),
		totalMinor: invoice.totals.totalMinor,
	};
}

export type InvoiceActionResult<T> =
	| { ok: true; invoice: T }
	| {
			ok: false;
			reason:
				| "VALIDATION"
				| "NOT_FOUND"
				| "NUMBER_TAKEN"
				| "INVALID_TRANSITION"
				| "INVALID_STATE";
			message?: string;
			issues?: ValidationIssue[];
	  };

export type InvoiceListResult =
	| { ok: true; invoices: SerializableInvoice[] }
	| { ok: false; reason: "VALIDATION"; message?: string };

export type InvoiceDeleteResult =
	| { ok: true }
	| {
			ok: false;
			reason: "VALIDATION" | "NOT_FOUND" | "INVALID_TRANSITION";
			message?: string;
	  };

function toValidationIssues(error: {
	issues: { path: (string | symbol | number)[]; message: string }[];
}): ValidationIssue[] {
	return error.issues.map((issue) => ({
		path: issue.path.map(String).join("."),
		message: issue.message,
	}));
}

/** Maps known repo errors to typed action results; unknown errors rethrow. */
function toErrorResult(error: unknown): InvoiceActionResult<never> {
	if (error instanceof InvoiceTransitionError) {
		return {
			ok: false,
			reason: "INVALID_TRANSITION",
			message: error.message,
		};
	}
	if (error instanceof InvoiceNumberTakenError) {
		return { ok: false, reason: "NUMBER_TAKEN", message: error.message };
	}
	if (error instanceof InvoiceValidationError) {
		return { ok: false, reason: "INVALID_STATE", message: error.message };
	}
	throw error;
}

export async function createInvoiceAction(
	input: CreateInvoiceInput,
): Promise<InvoiceActionResult<SerializableInvoice>> {
	const parsed = createInvoiceDataSchema.safeParse(input);
	if (!parsed.success) {
		return {
			ok: false,
			reason: "VALIDATION",
			issues: toValidationIssues(parsed.error),
		};
	}
	try {
		const invoice = await createInvoiceRepo(await requireUserId(), parsed.data);
		return { ok: true, invoice: toSerializableInvoice(invoice) };
	} catch (error) {
		return toErrorResult(error);
	}
}

export async function getInvoiceAction(
	invoiceId: string,
): Promise<InvoiceActionResult<SerializableInvoice>> {
	const parsed = invoiceIdSchema.safeParse(invoiceId);
	if (!parsed.success) {
		return { ok: false, reason: "VALIDATION" };
	}
	const invoice = await getInvoiceRepo(await requireUserId(), parsed.data);
	if (!invoice) {
		return { ok: false, reason: "NOT_FOUND" };
	}
	return { ok: true, invoice: toSerializableInvoice(invoice) };
}

export async function listInvoicesAction(): Promise<InvoiceListResult> {
	return {
		ok: true,
		invoices: (await listInvoicesRepo(await requireUserId())).map(
			toSerializableInvoice,
		),
	};
}

export async function updateInvoiceAction(
	invoiceId: string,
	input: UpdateInvoiceInput,
): Promise<InvoiceActionResult<SerializableInvoice>> {
	const id = invoiceIdSchema.safeParse(invoiceId);
	if (!id.success) {
		return { ok: false, reason: "VALIDATION" };
	}
	const parsed = updateInvoiceDataSchema.safeParse(input);
	if (!parsed.success) {
		return {
			ok: false,
			reason: "VALIDATION",
			issues: toValidationIssues(parsed.error),
		};
	}
	try {
		const invoice = await updateInvoiceRepo(
			await requireUserId(),
			id.data,
			parsed.data,
		);
		if (!invoice) {
			return { ok: false, reason: "NOT_FOUND" };
		}
		return { ok: true, invoice: toSerializableInvoice(invoice) };
	} catch (error) {
		return toErrorResult(error);
	}
}

export async function deleteInvoiceAction(
	invoiceId: string,
): Promise<InvoiceDeleteResult> {
	const parsed = invoiceIdSchema.safeParse(invoiceId);
	if (!parsed.success) {
		return { ok: false, reason: "VALIDATION" };
	}
	try {
		const deleted = await deleteInvoiceRepo(await requireUserId(), parsed.data);
		if (!deleted) {
			return { ok: false, reason: "NOT_FOUND" };
		}
		return { ok: true };
	} catch (error) {
		if (error instanceof InvoiceTransitionError) {
			return {
				ok: false,
				reason: "INVALID_TRANSITION",
				message: error.message,
			};
		}
		throw error;
	}
}

export async function sendInvoiceAction(
	invoiceId: string,
): Promise<InvoiceActionResult<SerializableInvoice>> {
	const parsed = invoiceIdSchema.safeParse(invoiceId);
	if (!parsed.success) {
		return { ok: false, reason: "VALIDATION" };
	}
	try {
		const invoice = await sendInvoiceRepo(await requireUserId(), parsed.data);
		return { ok: true, invoice: toSerializableInvoice(invoice) };
	} catch (error) {
		return toErrorResult(error);
	}
}

export async function markPaidInvoiceAction(
	invoiceId: string,
): Promise<InvoiceActionResult<SerializableInvoice>> {
	const parsed = invoiceIdSchema.safeParse(invoiceId);
	if (!parsed.success) {
		return { ok: false, reason: "VALIDATION" };
	}
	try {
		const invoice = await markPaidInvoiceRepo(
			await requireUserId(),
			parsed.data,
		);
		return { ok: true, invoice: toSerializableInvoice(invoice) };
	} catch (error) {
		return toErrorResult(error);
	}
}

export async function setInvoiceFxRateAction(
	invoiceId: string,
	input: string,
): Promise<InvoiceActionResult<SerializableInvoice>> {
	const id = invoiceIdSchema.safeParse(invoiceId);
	const rate = fxRateDataSchema.safeParse(input);
	if (!id.success || !rate.success) {
		return {
			ok: false,
			reason: "VALIDATION",
			issues: rate.success ? undefined : toValidationIssues(rate.error),
		};
	}
	try {
		const invoice = await setInvoiceFxRateRepo(
			await requireUserId(),
			id.data,
			rate.data,
		);
		if (!invoice) {
			return { ok: false, reason: "NOT_FOUND" };
		}
		return { ok: true, invoice: toSerializableInvoice(invoice) };
	} catch (error) {
		return toErrorResult(error);
	}
}
