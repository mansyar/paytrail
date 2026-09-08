import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "./db";
import {
	createInvoice,
	deleteInvoice,
	getInvoice,
	InvoiceTransitionError,
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

async function createTestClient(
	userId: string,
	currencyCode = "USD",
): Promise<string> {
	const client = await prisma.client.create({
		data: { id: crypto.randomUUID(), userId, name: "Invoice Test Client", currencyCode },
	});
	return client.id;
}

async function createBusinessProfile(
	userId: string,
	currency = "USD",
): Promise<void> {
	await prisma.businessProfile.create({
		data: {
			userId,
			businessName: "FX Test Studio",
			currency,
			defaultTaxRate: 0,
		},
	});
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
		items: overrides.items ?? [{ description: "Work", amountMinor: 10000 }],
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
		expect(invoices.every((i) => i.invoiceNumber !== "Not-mine")).toBe(true);
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

describe("totals are derived on read", () => {
	it("attaches computed totals to every invoice read", async () => {
		const userId = await createTestUser();
		const clientId = await createTestClient(userId);
		const invoice = await createInvoice(userId, {
			clientId,
			issueDate: "2026-01-01",
			dueDate: "2026-01-15",
			currencyCode: "USD",
			taxRate: 10,
			discountMinor: 500,
			items: [
				{ description: "Work", amountMinor: 10000 },
				{ description: "More work", amountMinor: 20000 },
			],
		});

		// Spec example: 1000 + 2000 − 500 discount, 10% tax → 2750.
		expect(invoice.totals).toEqual({
			subtotalMinor: 30000,
			discountAppliedMinor: 500,
			taxableMinor: 29500,
			taxMinor: 2950,
			totalMinor: 32450,
		});
		expect((await getInvoice(userId, invoice.id))?.totals).toEqual(
			invoice.totals,
		);
		expect((await listInvoices(userId))[0]?.totals.totalMinor).toBe(32450);
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

describe("FX snapshot semantics (fx_multi_currency_20260908)", () => {
	beforeEach(async () => {
		await prisma.fxRate.deleteMany({
			where: {
				baseCurrency: "USD",
				quoteCurrency: { in: ["EUR", "IDR"] },
			},
		});
	});

	it("stamps fxRate on a draft created with a non-home-currency client", async () => {
		const userId = await createTestUser();
		await createBusinessProfile(userId, "USD");
		const clientId = await createTestClient(userId, "EUR");
		await prisma.fxRate.create({
			data: {
				baseCurrency: "USD",
				quoteCurrency: "EUR",
				rate: "0.8",
				fetchedAt: new Date(),
			},
		});
		const fetchJson = vi.fn();

		const invoice = await createInvoice(
			userId,
			{
				clientId,
				issueDate: "2026-09-01",
				dueDate: "2026-09-15",
				currencyCode: "EUR",
				taxRate: 0,
				discountMinor: 0,
				items: [{ description: "x", amountMinor: 10000 }],
			},
			{ fetchJson },
		);

		expect(invoice.fxRate?.toNumber()).toBeCloseTo(1.25, 6);
		expect(invoice.fxRateCurrency).toBe("USD");
		expect(fetchJson).not.toHaveBeenCalled();
	});

	it("leaves fxRate null for a home-currency invoice", async () => {
		const userId = await createTestUser();
		await createBusinessProfile(userId, "USD");
		const clientId = await createTestClient(userId, "USD");
		const fetchJson = vi.fn();

		const invoice = await createInvoice(
			userId,
			{
				clientId,
				issueDate: "2026-09-01",
				dueDate: "2026-09-15",
				currencyCode: "USD",
				taxRate: 0,
				discountMinor: 0,
				items: [{ description: "x", amountMinor: 10000 }],
			},
			{ fetchJson },
		);

		expect(invoice.fxRate).toBeNull();
		expect(invoice.fxRateCurrency).toBeNull();
		expect(fetchJson).not.toHaveBeenCalled();
	});

	it("leaves fxRate null when no rate is available (provider fails, no cache)", async () => {
		const userId = await createTestUser();
		await createBusinessProfile(userId, "USD");
		const clientId = await createTestClient(userId, "EUR");
		const fetchJson = vi.fn().mockRejectedValue(new Error("provider down"));

		const invoice = await createInvoice(
			userId,
			{
				clientId,
				issueDate: "2026-09-01",
				dueDate: "2026-09-15",
				currencyCode: "EUR",
				taxRate: 0,
				discountMinor: 0,
				items: [{ description: "x", amountMinor: 10000 }],
			},
			{ fetchJson },
		);

		expect(invoice.fxRate).toBeNull();
		expect(invoice.fxRateCurrency).toBeNull();
	});

	it("re-derives the snapshot when a draft currency changes", async () => {
		const userId = await createTestUser();
		await createBusinessProfile(userId, "USD");
		const clientId = await createTestClient(userId, "EUR");
		await prisma.fxRate.create({
			data: {
				baseCurrency: "USD",
				quoteCurrency: "IDR",
				rate: "16000",
				fetchedAt: new Date(),
			},
		});
		const created = await createInvoice(
			userId,
			{
				clientId,
				issueDate: "2026-09-01",
				dueDate: "2026-09-15",
				currencyCode: "EUR",
				taxRate: 0,
				discountMinor: 0,
				items: [{ description: "x", amountMinor: 10000 }],
			},
			{ fetchJson: vi.fn().mockRejectedValue(new Error("down")) },
		);
		// Simulate a manual override left on the old currency.
		await prisma.invoice.update({
			where: { id: created.id },
			data: { fxRate: "9.99" },
		});
		const fetchJson = vi.fn();

		const updated = await updateInvoice(
			userId,
			created.id,
			{
				issueDate: "2026-09-01",
				dueDate: "2026-09-15",
				currencyCode: "IDR",
				taxRate: 0,
				discountMinor: 0,
				items: [{ description: "x", amountMinor: 10000 }],
			},
			{ fetchJson },
		);

		expect(updated?.fxRate?.toNumber()).toBeCloseTo(1 / 16000, 10);
		expect(updated?.fxRateCurrency).toBe("USD");
		expect(fetchJson).not.toHaveBeenCalled();
	});

	it("keeps a manual override when a draft is saved without a currency change", async () => {
		const userId = await createTestUser();
		await createBusinessProfile(userId, "USD");
		const clientId = await createTestClient(userId, "EUR");
		const created = await createInvoice(
			userId,
			{
				clientId,
				issueDate: "2026-09-01",
				dueDate: "2026-09-15",
				currencyCode: "EUR",
				taxRate: 0,
				discountMinor: 0,
				items: [{ description: "x", amountMinor: 10000 }],
			},
			{ fetchJson: vi.fn().mockRejectedValue(new Error("down")) },
		);
		// Manual override set directly (action covered in its own task).
		await prisma.invoice.update({
			where: { id: created.id },
			data: { fxRate: "1.5", fxRateCurrency: "USD" },
		});
		const fetchJson = vi.fn();

		const updated = await updateInvoice(
			userId,
			created.id,
			{
				issueDate: "2026-09-02",
				dueDate: "2026-09-15",
				currencyCode: "EUR",
				taxRate: 0,
				discountMinor: 0,
				items: [{ description: "y", amountMinor: 20000 }],
			},
			{ fetchJson },
		);

		expect(updated?.fxRate?.toNumber()).toBe(1.5);
		expect(fetchJson).not.toHaveBeenCalled();
	});

	it("freezes the snapshot when the invoice is sent", async () => {
		const userId = await createTestUser();
		await createBusinessProfile(userId, "USD");
		const clientId = await createTestClient(userId, "EUR");
		await prisma.fxRate.create({
			data: {
				baseCurrency: "USD",
				quoteCurrency: "EUR",
				rate: "0.8",
				fetchedAt: new Date(),
			},
		});
		const created = await createInvoice(
			userId,
			{
				clientId,
				issueDate: "2026-09-01",
				dueDate: "2026-09-15",
				currencyCode: "EUR",
				taxRate: 0,
				discountMinor: 0,
				items: [{ description: "x", amountMinor: 10000 }],
			},
			{ fetchJson: vi.fn() },
		);
		// Cache goes stale / wrong after creation; send must not re-derive.
		await prisma.fxRate.update({
			where: {
				baseCurrency_quoteCurrency: {
					baseCurrency: "USD",
					quoteCurrency: "EUR",
				},
			},
			data: { rate: "0.1", fetchedAt: new Date(Date.now() - 48 * 3600_000) },
		});

		const sent = await sendInvoice(userId, created.id);

		expect(sent.status).toBe("SENT");
		expect(sent.fxRate?.toNumber()).toBeCloseTo(1.25, 6);
	});
});
