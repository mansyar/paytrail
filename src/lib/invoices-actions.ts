"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import {
	type CreateInvoiceInput,
	createInvoiceDataSchema,
	invoiceIdSchema,
	type UpdateInvoiceInput,
	updateInvoiceDataSchema,
} from "./invoice-schemas";
import {
	InvoiceTransitionError,
	type InvoiceWithItems,
	createInvoice as createInvoiceRepo,
	deleteInvoice as deleteInvoiceRepo,
	getInvoice as getInvoiceRepo,
	listInvoices as listInvoicesRepo,
	markPaidInvoice as markPaidInvoiceRepo,
	sendInvoice as sendInvoiceRepo,
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

export type InvoiceActionResult<T> =
	| { ok: true; invoice: T }
	| {
			ok: false;
			reason:
				| "VALIDATION"
				| "NOT_FOUND"
				| "NUMBER_TAKEN"
				| "INVALID_TRANSITION";
			message?: string;
			issues?: ValidationIssue[];
	  };

export type InvoiceListResult =
	| { ok: true; invoices: InvoiceWithItems[] }
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

/** Maps repo error messages to typed action results. */
function toErrorResult(error: unknown): InvoiceActionResult<never> {
	const message = error instanceof Error ? error.message : String(error);
	if (error instanceof InvoiceTransitionError) {
		return { ok: false, reason: "INVALID_TRANSITION", message };
	}
	if (/already in use/i.test(message)) {
		return { ok: false, reason: "NUMBER_TAKEN", message };
	}
	return { ok: false, reason: "NOT_FOUND", message };
}

export async function createInvoiceAction(
	input: CreateInvoiceInput,
): Promise<InvoiceActionResult<InvoiceWithItems>> {
	const parsed = createInvoiceDataSchema.safeParse(input);
	if (!parsed.success) {
		return {
			ok: false,
			reason: "VALIDATION",
			issues: toValidationIssues(parsed.error),
		};
	}
	try {
		const invoice = await createInvoiceRepo(
			await requireUserId(),
			parsed.data,
		);
		return { ok: true, invoice };
	} catch (error) {
		return toErrorResult(error);
	}
}

export async function getInvoiceAction(
	invoiceId: string,
): Promise<InvoiceActionResult<InvoiceWithItems>> {
	const parsed = invoiceIdSchema.safeParse(invoiceId);
	if (!parsed.success) {
		return { ok: false, reason: "VALIDATION" };
	}
	const invoice = await getInvoiceRepo(await requireUserId(), parsed.data);
	if (!invoice) {
		return { ok: false, reason: "NOT_FOUND" };
	}
	return { ok: true, invoice };
}

export async function listInvoicesAction(): Promise<InvoiceListResult> {
	return { ok: true, invoices: await listInvoicesRepo(await requireUserId()) };
}

export async function updateInvoiceAction(
	invoiceId: string,
	input: UpdateInvoiceInput,
): Promise<InvoiceActionResult<InvoiceWithItems>> {
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
		return { ok: true, invoice };
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
		const deleted = await deleteInvoiceRepo(
			await requireUserId(),
			parsed.data,
		);
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
): Promise<InvoiceActionResult<InvoiceWithItems>> {
	const parsed = invoiceIdSchema.safeParse(invoiceId);
	if (!parsed.success) {
		return { ok: false, reason: "VALIDATION" };
	}
	try {
		const invoice = await sendInvoiceRepo(
			await requireUserId(),
			parsed.data,
		);
		return { ok: true, invoice };
	} catch (error) {
		return toErrorResult(error);
	}
}

export async function markPaidInvoiceAction(
	invoiceId: string,
): Promise<InvoiceActionResult<InvoiceWithItems>> {
	const parsed = invoiceIdSchema.safeParse(invoiceId);
	if (!parsed.success) {
		return { ok: false, reason: "VALIDATION" };
	}
	try {
		const invoice = await markPaidInvoiceRepo(
			await requireUserId(),
			parsed.data,
		);
		return { ok: true, invoice };
	} catch (error) {
		return toErrorResult(error);
	}
}
