import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "./db";
import {
	InvoiceTransitionError,
	createInvoice,
	deleteInvoice,
	getInvoice,
	listInvoices,
	markPaidInvoice,
	sendInvoice,
	updateInvoice,
} from "./invoices-repo";

const createdUserIds: string[] = [];

afterEach(async () => {
	for (const id of createdUserIds.splice(0)) {
		await prisma.user.delete({ where: { id } });
	}
});

afterAll(async () => {
	await prisma.$disconnect();
});

async function createTestUser(): Promise<string> {
	const email = `invrepo-${Date.now()}-${Math.random()
		.toString(36)
		.slice(2)}@example.com`;
	const user = await prisma.user.create({
		data: {
			id: crypto.randomUUID(),
			name: "Invoice Repo Test",
			email,
			emailVerified: false,
		},
	});
	createdUserIds.push(user.id);
	return user.id;
}

async function createTestClient(userId: string): Promise<string> {
	const client = await prisma.client.create({
		data: { id: crypto.randomUUID(), userId, name: "Invoice Test Client" },
	});
	return client.id;
}

interface CreateOverrides {
	invoiceNumber?: string;
	items?: { description: string; amountMinor: number }[];
	clientId?: string;
}

async function seedInvoice(
	userId: string,
	overrides: CreateOverrides = {},
): Promise<{ id: string; invoiceNumber: string }> {
	const clientId = overrides.clientId ?? (await createTestClient(userId));
	const invoice = await createInvoice(userId, {
		clientId,
		invoiceNumber: overrides.invoiceNumber,
		issueDate: "2026-09-01",
		dueDate: "2026-09-15",
		currencyCode: "USD",
		taxRate: 10,
		discountMinor: 0,
		items: overrides.items ?? [
			{ description: "Work", amountMinor: 10000 },
		],
	});
	return { id: invoice.id, invoiceNumber: invoice.invoiceNumber };
}

describe("createInvoice — items + numbering", () => {
	it("creates an invoice with its items and an auto-assigned number", async () => {
		const userId = await createTestUser();
		const clientId = await createTestClient(userId);
		const year = new Date().getFullYear();

		const invoice = await createInvoice(userId, {
			clientId,
			issueDate: "2026-09-01",
			dueDate: "2026-09-15",
			currencyCode: "USD",
			taxRate: 10,
			discountMinor: 0,
			items: [
				{ description: "Garden cleanup", amountMinor: 12000 },
				{ description: "Hedge trimming", amountMinor: 8025 },
			],
		});

		expect(invoice.status).toBe("DRAFT");
		expect(invoice.userId).toBe(userId);
		expect(invoice.invoiceNumber).toBe(`INV-${year}-0001`);
		expect(invoice.items).toHaveLength(2);
		expect(invoice.items.map((i) => i.amountMinor)).toEqual([12000, 8025]);
	});

	it("rejects an invoice for a client the user does not own", async () => {
		const userId = await createTestUser();
		const otherUserId = await createTestUser();
		const foreignClientId = await createTestClient(otherUserId);

		await expect(
			createInvoice(userId, {
				clientId: foreignClientId,
				issueDate: "2026-09-01",
				dueDate: "2026-09-15",
				currencyCode: "USD",
				taxRate: 0,
				discountMinor: 0,
				items: [{ description: "x", amountMinor: 100 }],
			}),
		).rejects.toThrow(/client/i);
	});
});

describe("getInvoice / listInvoices — user scoping", () => {
	it("resolves an invoice with items only for its owner", async () => {
		const userId = await createTestUser();
		const otherUserId = await createTestUser();
		const { id } = await seedInvoice(userId);

		const mine = await getInvoice(userId, id);
		expect(mine).not.toBeNull();
		expect(mine?.items).toHaveLength(1);

		expect(await getInvoice(otherUserId, id)).toBeNull();
		expect(await getInvoice(userId, "nonexistent")).toBeNull();
	});

	it("lists only the session user's invoices, newest first, with client info", async () => {
		const userId = await createTestUser();
		const otherUserId = await createTestUser();
		await seedInvoice(userId, { invoiceNumber: "INV-2026-0001" });
		await seedInvoice(userId, { invoiceNumber: "INV-2026-0002" });
		await seedInvoice(otherUserId, { invoiceNumber: "INV-2026-0001" });

		const invoices = await listInvoices(userId);
		expect(invoices).toHaveLength(2);
		expect(invoices[0].invoiceNumber).toBe("INV-2026-0002");
		expect(invoices[0].client).toBeDefined();
		expect(
			invoices.every((i) => i.invoiceNumber !== "Not-mine"),
		).toBe(true);
	});
});

describe("updateInvoice — DRAFT only", () => {
	it("updates fields and replaces items on a draft", async () => {
		const userId = await createTestUser();
		const { id } = await seedInvoice(userId);

		const updated = await updateInvoice(userId, id, {
			issueDate: "2026-09-02",
			dueDate: "2026-09-30",
			currencyCode: "EUR",
			taxRate: 0,
			discountMinor: 500,
			items: [{ description: "Revised work", amountMinor: 20000 }],
		});
		if (!updated) throw new Error("expected update to succeed");

		expect(updated.currencyCode).toBe("EUR");
		expect(updated.discountMinor).toBe(500);
		expect(updated.items).toHaveLength(1);
		expect(updated.items[0].description).toBe("Revised work");
	});

	it("rejects updating a sent invoice with a typed error", async () => {
		const userId = await createTestUser();
		const { id } = await seedInvoice(userId);
		await sendInvoice(userId, id);

		await expect(
			updateInvoice(userId, id, {
				issueDate: "2026-09-02",
				dueDate: "2026-09-30",
				currencyCode: "USD",
				taxRate: 0,
				discountMinor: 0,
				items: [{ description: "x", amountMinor: 100 }],
			}),
		).rejects.toBeInstanceOf(InvoiceTransitionError);
	});

	it("returns null for an invoice the user does not own", async () => {
		const userId = await createTestUser();
		const otherUserId = await createTestUser();
		const { id } = await seedInvoice(userId);

		await expect(
			updateInvoice(otherUserId, id, {
				issueDate: "2026-09-02",
				dueDate: "2026-09-30",
				currencyCode: "USD",
				taxRate: 0,
				discountMinor: 0,
				items: [{ description: "x", amountMinor: 100 }],
			}),
		).resolves.toBeNull();
	});
});

describe("deleteInvoice — DRAFT only", () => {
	it("deletes a draft invoice and its items", async () => {
		const userId = await createTestUser();
		const { id } = await seedInvoice(userId);

		expect(await deleteInvoice(userId, id)).toBe(true);
		expect(await getInvoice(userId, id)).toBeNull();
	});

	it("rejects deleting a sent invoice with a typed error", async () => {
		const userId = await createTestUser();
		const { id } = await seedInvoice(userId);
		await sendInvoice(userId, id);

		await expect(deleteInvoice(userId, id)).rejects.toBeInstanceOf(
			InvoiceTransitionError,
		);
	});

	it("returns false for an invoice the user does not own", async () => {
		const userId = await createTestUser();
		const otherUserId = await createTestUser();
		const { id } = await seedInvoice(userId);

		expect(await deleteInvoice(otherUserId, id)).toBe(false);
	});
});

describe("sendInvoice — DRAFT → SENT", () => {
	it("stamps sentAt and locks the invoice", async () => {
		const userId = await createTestUser();
		const { id } = await seedInvoice(userId);

		const sent = await sendInvoice(userId, id);
		expect(sent.status).toBe("SENT");
		expect(sent.sentAt).toBeInstanceOf(Date);
	});

	it("rejects sending an already sent invoice", async () => {
		const userId = await createTestUser();
		const { id } = await seedInvoice(userId);
		await sendInvoice(userId, id);

		await expect(sendInvoice(userId, id)).rejects.toBeInstanceOf(
			InvoiceTransitionError,
		);
	});

	it("rejects sending from a paid state", async () => {
		const userId = await createTestUser();
		const { id } = await seedInvoice(userId);
		await sendInvoice(userId, id);
		await markPaidInvoice(userId, id);

		await expect(sendInvoice(userId, id)).rejects.toBeInstanceOf(
			InvoiceTransitionError,
		);
	});
});

describe("markPaidInvoice — SENT → PAID", () => {
	it("stamps paidAt and sets status PAID", async () => {
		const userId = await createTestUser();
		const { id } = await seedInvoice(userId);
		await sendInvoice(userId, id);

		const paid = await markPaidInvoice(userId, id);
		expect(paid.status).toBe("PAID");
		expect(paid.paidAt).toBeInstanceOf(Date);
	});

	it("rejects marking a draft as paid (must be sent first)", async () => {
		const userId = await createTestUser();
		const { id } = await seedInvoice(userId);

		await expect(markPaidInvoice(userId, id)).rejects.toBeInstanceOf(
			InvoiceTransitionError,
		);
	});
});

describe("status derivation — OVERDUE is computed, never stored", () => {
	it("derives OVERDUE on read for a sent invoice past its due date", async () => {
		const userId = await createTestUser();
		const clientId = await createTestClient(userId);
		const invoice = await createInvoice(userId, {
			clientId,
			issueDate: "2026-01-01",
			dueDate: "2026-01-15",
			currencyCode: "USD",
			taxRate: 0,
			discountMinor: 0,
			items: [{ description: "Work", amountMinor: 5000 }],
		});
		await sendInvoice(userId, invoice.id);

		const read = await getInvoice(userId, invoice.id);
		expect(read?.status).toBe("SENT"); // stored status unchanged
		expect(read?.derivedStatus).toBe("OVERDUE");
	});

	it("does not derive OVERDUE for drafts or paid invoices", async () => {
		const userId = await createTestUser();
		const clientId = await createTestClient(userId);
		const draft = await createInvoice(userId, {
			clientId,
			issueDate: "2026-01-01",
			dueDate: "2026-01-15",
			currencyCode: "USD",
			taxRate: 0,
			discountMinor: 0,
			items: [{ description: "Work", amountMinor: 5000 }],
		});
		expect((await getInvoice(userId, draft.id))?.derivedStatus).toBe("DRAFT");

		await sendInvoice(userId, draft.id);
		const paid = await markPaidInvoice(userId, draft.id);
		expect(paid.derivedStatus).toBe("PAID");
	});
});

describe("number uniqueness per user", () => {
	it("rejects creating two invoices with the same manual number", async () => {
		const userId = await createTestUser();
		const clientId = await createTestClient(userId);
		await seedInvoice(userId, {
			clientId,
			invoiceNumber: "INV-2026-0100",
		});

		await expect(
			createInvoice(userId, {
				clientId,
				invoiceNumber: "INV-2026-0100",
				issueDate: "2026-09-01",
				dueDate: "2026-09-15",
				currencyCode: "USD",
				taxRate: 0,
				discountMinor: 0,
				items: [{ description: "x", amountMinor: 100 }],
			}),
		).rejects.toThrow(/already in use/i);
	});
});
