import type { ClientInput } from "./clients";
import { prisma } from "./db";

/**
 * Data layer for clients. Every function takes the session user's id
 * explicitly and scopes queries by it — ownership is enforced here,
 * not in the UI.
 */

export type DeleteClientResult =
	| { ok: true }
	| {
			ok: false;
			reason: "INVOICES_ATTACHED" | "NOT_FOUND";
			invoiceCount?: number;
	  };

/**
 * Counts invoices attached to a client. The Invoices track will replace
 * this stub with a real `prisma.invoice.count` query once the model exists.
 */
async function countInvoicesByClient(_clientId: string): Promise<number> {
	return 0;
}

export async function createClient(userId: string, input: ClientInput) {
	return prisma.client.create({
		data: { ...input, userId },
	});
}

export async function listClients(userId: string, q?: string) {
	return prisma.client.findMany({
		where: {
			userId,
			...(q
				? {
						OR: [
							{ name: { contains: q, mode: "insensitive" } },
							{ email: { contains: q, mode: "insensitive" } },
						],
					}
				: {}),
		},
		orderBy: { name: "asc" },
	});
}

export async function getClient(userId: string, id: string) {
	return prisma.client.findFirst({
		where: { id, userId },
	});
}

export async function updateClient(
	userId: string,
	id: string,
	input: ClientInput,
) {
	const existing = await prisma.client.findFirst({
		where: { id, userId },
		select: { id: true },
	});
	if (!existing) return null;
	return prisma.client.update({
		where: { id },
		data: input,
	});
}

export async function deleteClient(
	userId: string,
	id: string,
	countInvoices: (clientId: string) => Promise<number> = countInvoicesByClient,
): Promise<DeleteClientResult> {
	const existing = await prisma.client.findFirst({
		where: { id, userId },
		select: { id: true },
	});
	if (!existing) return { ok: false, reason: "NOT_FOUND" };

	const invoiceCount = await countInvoices(id);
	if (invoiceCount > 0) {
		return { ok: false, reason: "INVOICES_ATTACHED", invoiceCount };
	}

	await prisma.client.delete({ where: { id } });
	return { ok: true };
}
