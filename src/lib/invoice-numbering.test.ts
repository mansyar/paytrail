import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "./db";
import {
	formatInvoiceNumber,
	nextInvoiceNumber,
	resolveInvoiceNumber,
} from "./invoice-numbering";

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
	const email = `numbering-${Date.now()}-${Math.random()
		.toString(36)
		.slice(2)}@example.com`;
	const user = await prisma.user.create({
		data: {
			id: crypto.randomUUID(),
			name: "Numbering Test",
			email,
			emailVerified: false,
		},
	});
	createdUserIds.push(user.id);
	return user.id;
}

async function createTestClient(userId: string): Promise<string> {
	const client = await prisma.client.create({
		data: {
			id: crypto.randomUUID(),
			userId,
			name: "Numbering Test Client",
		},
	});
	return client.id;
}

async function createInvoice(
	userId: string,
	clientId: string,
	invoiceNumber: string,
): Promise<void> {
	await prisma.invoice.create({
		data: {
			userId,
			clientId,
			invoiceNumber,
			status: "DRAFT",
			issueDate: new Date("2026-01-15"),
			dueDate: new Date("2026-01-29"),
			currencyCode: "USD",
		},
	});
}

describe("formatInvoiceNumber", () => {
	it("formats as INV-<year>-<4-digit zero-padded sequence>", () => {
		expect(formatInvoiceNumber(2026, 1)).toBe("INV-2026-0001");
		expect(formatInvoiceNumber(2026, 42)).toBe("INV-2026-0042");
		expect(formatInvoiceNumber(1999, 1234)).toBe("INV-1999-1234");
	});
});

describe("nextInvoiceNumber — per-user yearly auto sequence", () => {
	it("assigns INV-<year>-0001 for the first invoice of a year", async () => {
		const userId = await createTestUser();
		const year = new Date().getFullYear();

		const number = await nextInvoiceNumber(userId, year);

		expect(number).toBe(`INV-${year}-0001`);
	});

	it("increments within the same user and year", async () => {
		const userId = await createTestUser();
		const year = new Date().getFullYear();

		expect(await nextInvoiceNumber(userId, year)).toBe(
			`INV-${year}-0001`,
		);
		expect(await nextInvoiceNumber(userId, year)).toBe(
			`INV-${year}-0002`,
		);
		expect(await nextInvoiceNumber(userId, year)).toBe(
			`INV-${year}-0003`,
		);
	});

	it("starts at 0001 again for a new year for the same user", async () => {
		const userId = await createTestUser();
		const thisYear = new Date().getFullYear();

		await nextInvoiceNumber(userId, thisYear - 1);
		const number = await nextInvoiceNumber(userId, thisYear);

		expect(number).toBe(`INV-${thisYear}-0001`);
	});

	it("isolates counters between users", async () => {
		const userIdA = await createTestUser();
		const userIdB = await createTestUser();
		const year = new Date().getFullYear();

		await nextInvoiceNumber(userIdA, year);
		await nextInvoiceNumber(userIdA, year);

		expect(await nextInvoiceNumber(userIdB, year)).toBe(
			`INV-${year}-0001`,
		);
	});
});

describe("nextInvoiceNumber — collision-safe skip", () => {
	it("skips manually taken numbers so the auto counter never collides", async () => {
		const userId = await createTestUser();
		const clientId = await createTestClient(userId);
		const year = new Date().getFullYear();

		// User manually claims INV-<year>-0001 and -0002 (e.g. via overrides).
		await nextInvoiceNumber(userId, year); // 0001
		await nextInvoiceNumber(userId, year); // 0002
		// Simulate a manual override taking 0003 out-of-band.
		await prisma.invoiceNumberCounter.update({
			where: { userId_year: { userId, year } },
			data: { lastNumber: 2 },
		});
		await createInvoice(userId, clientId, `INV-${year}-0003`);

		const number = await nextInvoiceNumber(userId, year);
		expect(number).toBe(`INV-${year}-0004`);
	});
});

describe("resolveInvoiceNumber — manual override", () => {
	it("accepts a manual number when free and advances the counter past it", async () => {
		const userId = await createTestUser();
		const year = new Date().getFullYear();

		const result = await resolveInvoiceNumber({
			userId,
			year,
			manualNumber: `INV-${year}-0005`,
		});
		expect(result.number).toBe(`INV-${year}-0005`);

		// The next auto number must skip past the manual one.
		expect(await nextInvoiceNumber(userId, year)).toBe(
			`INV-${year}-0006`,
		);
	});

	it("rejects a manual number that collides with an existing invoice", async () => {
		const userId = await createTestUser();
		const clientId = await createTestClient(userId);
		const year = new Date().getFullYear();

		const first = await resolveInvoiceNumber({ userId, year });
		await createInvoice(userId, clientId, first.number);

		await expect(
			resolveInvoiceNumber({
				userId,
				year,
				manualNumber: first.number,
			}),
		).rejects.toThrow(/already in use/i);
	});

	it("rejects a manual number in the wrong format", async () => {
		const userId = await createTestUser();

		await expect(
			resolveInvoiceNumber({
				userId,
				year: new Date().getFullYear(),
				manualNumber: "invoice-7",
			}),
		).rejects.toThrow(/format/i);
	});
});
