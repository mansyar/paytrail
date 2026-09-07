import { afterAll, afterEach, describe, expect, it } from "vitest";
import { auth } from "./auth";
import { clientSearchSchema } from "./clients";
import {
	createClient,
	deleteClient,
	getClient,
	listClients,
	updateClient,
} from "./clients-repo";
import { prisma } from "./db";

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
	const email = `repo-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
	const { user } = await auth.api.signUpEmail({
		body: { name: "Repo Test", email, password: "correct-horse-battery" },
	});
	createdUserIds.push(user.id);
	return user.id;
}

describe("client repo — session-scoped CRUD", () => {
	it("createClient persists a client owned by the user with USD default currency", async () => {
		const userId = await createTestUser();
		const client = await createClient(userId, {
			name: "Sunset Villa Cleaning",
			email: "owner@sunsetvilla.com",
			address: "12 Ocean Drive, Miami, FL",
			currencyCode: "EUR",
			notes: "Access code at gate.",
		});
		expect(client.name).toBe("Sunset Villa Cleaning");
		expect(client.userId).toBe(userId);
		expect(client.currencyCode).toBe("EUR");

		const defaulted = await createClient(userId, { name: "No Currency Co" });
		expect(defaulted.currencyCode).toBe("USD");
		expect(defaulted.email).toBeNull();
	});

	it("listClients returns only the session user's clients in alphabetical order", async () => {
		const userId = await createTestUser();
		const otherUserId = await createTestUser();
		await createClient(userId, { name: "Zephyr Estates" });
		await createClient(userId, { name: "Alpha Homes" });
		await createClient(otherUserId, { name: "Not Mine Ltd" });

		const clients = await listClients(userId);
		expect(clients.map((c) => c.name)).toEqual(["Alpha Homes", "Zephyr Estates"]);
	});

	it("getClient only resolves clients owned by the session user", async () => {
		const userId = await createTestUser();
		const otherUserId = await createTestUser();
		const client = await createClient(userId, { name: "Mine" });

		expect(await getClient(userId, client.id)).not.toBeNull();
		expect(await getClient(otherUserId, client.id)).toBeNull();
		expect(await getClient(userId, "nonexistent-id")).toBeNull();
	});

	it("updateClient updates fields for the owner and refuses other users", async () => {
		const userId = await createTestUser();
		const otherUserId = await createTestUser();
		const client = await createClient(userId, { name: "Before" });

		const updated = await updateClient(userId, client.id, {
			name: "After",
			email: "after@example.com",
			currencyCode: "GBP",
		});
		expect(updated?.name).toBe("After");
		expect(updated?.currencyCode).toBe("GBP");

		expect(await updateClient(otherUserId, client.id, { name: "Hacked" })).toBeNull();
	});

	it("deleteClient removes the client for the owner and not for other users", async () => {
		const userId = await createTestUser();
		const otherUserId = await createTestUser();
		const client = await createClient(userId, { name: "Doomed" });

		expect(await deleteClient(otherUserId, client.id).then((r) => r.ok)).toBe(false);
		expect(await getClient(userId, client.id)).not.toBeNull();

		const result = await deleteClient(userId, client.id);
		expect(result).toEqual({ ok: true });
		expect(await getClient(userId, client.id)).toBeNull();
	});
});

describe("client repo — search", () => {
	it("listClients filters by ?q= contains on name and email, case-insensitive", async () => {
		const userId = await createTestUser();
		await createClient(userId, { name: "Sunset Villa Cleaning" });
		await createClient(userId, { name: "Alpha Homes", email: "ops@alphahomes.com" });
		await createClient(userId, { name: "Beachside Co" });

		const byName = await listClients(userId, "villa");
		expect(byName.map((c) => c.name)).toEqual(["Sunset Villa Cleaning"]);

		const byEmail = await listClients(userId, "ALPHAHOMES");
		expect(byEmail.map((c) => c.name)).toEqual(["Alpha Homes"]);

		const noMatch = await listClients(userId, "zebra");
		expect(noMatch).toEqual([]);
	});

	it("clientSearchSchema trims and bounds the ?q= param", () => {
		expect(clientSearchSchema.parse("  villa  ")).toBe("villa");
		expect(clientSearchSchema.parse(undefined)).toBeUndefined();
		expect(() => clientSearchSchema.parse("x".repeat(101))).toThrow();
	});
});

describe("client repo — deletion guard", () => {
	it("deleteClient reports INVOICES_ATTACHED with a count instead of deleting", async () => {
		const userId = await createTestUser();
		const client = await createClient(userId, { name: "Has Invoices" });

		const result = await deleteClient(userId, client.id, async () => 3);
		expect(result).toEqual({ ok: false, reason: "INVOICES_ATTACHED", invoiceCount: 3 });
		expect(await getClient(userId, client.id)).not.toBeNull();
	});
});
