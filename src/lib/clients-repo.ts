import type { Client, Prisma } from "../generated/prisma/client";
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

export type ClientWithProjectCount = Prisma.ClientGetPayload<{
	include: { _count: { select: { projects: true } } };
}>;

/**
 * Counts invoices attached to a client.
 */
async function countInvoicesByClient(clientId: string): Promise<number> {
	return prisma.invoice.count({ where: { clientId } });
}

export async function createClient(
	userId: string,
	input: ClientInput,
): Promise<Client> {
	return prisma.client.create({
		data: { ...input, userId },
	});
}

export async function listClients(
	userId: string,
	q?: string,
): Promise<ClientWithProjectCount[]> {
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
		include: { _count: { select: { projects: true } } },
	});
}

export async function getClient(
	userId: string,
	id: string,
): Promise<Client | null> {
	return prisma.client.findFirst({
		where: { id, userId },
	});
}

export async function updateClient(
	userId: string,
	id: string,
	input: ClientInput,
): Promise<Client | null> {
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
