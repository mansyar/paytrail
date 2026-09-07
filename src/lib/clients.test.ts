import { describe, expect, it } from "vitest";
import { CURRENCIES } from "./currencies";
import { clientSchema, projectSchema } from "./clients";

const validClient = {
	name: "Sunset Villa Cleaning",
	email: "owner@sunsetvilla.com",
	address: "12 Ocean Drive, Miami, FL",
	currencyCode: "USD",
	notes: "Access code at gate.",
};

describe("CURRENCIES", () => {
	it("contains only 3-letter uppercase ISO 4217 codes", () => {
		expect(CURRENCIES.length).toBeGreaterThan(100);
		for (const code of CURRENCIES) {
			expect(code).toMatch(/^[A-Z]{3}$/);
		}
	});

	it("includes common currencies and excludes reserved codes", () => {
		for (const code of ["USD", "EUR", "GBP", "AUD", "CAD", "SGD"]) {
			expect(CURRENCIES).toContain(code);
		}
		expect(CURRENCIES).not.toContain("XXX");
	});
});

describe("clientSchema", () => {
	it("accepts a valid client", () => {
		const result = clientSchema.safeParse(validClient);
		expect(result.success).toBe(true);
	});

	it("requires a name", () => {
		const { name: _name, ...withoutName } = validClient;
		expect(clientSchema.safeParse(withoutName).success).toBe(false);
	});

	it("rejects an empty name", () => {
		expect(clientSchema.safeParse({ ...validClient, name: "" }).success).toBe(
			false,
		);
	});

	it("rejects a name over 200 characters", () => {
		expect(
			clientSchema.safeParse({ ...validClient, name: "a".repeat(201) })
				.success,
		).toBe(false);
	});

	it("allows a name of exactly 200 characters", () => {
		expect(
			clientSchema.safeParse({ ...validClient, name: "a".repeat(200) })
				.success,
		).toBe(true);
	});

	it("allows omitting optional fields", () => {
		const result = clientSchema.safeParse({
			name: "Minimal Client",
			currencyCode: "EUR",
		});
		expect(result.success).toBe(true);
	});

	it("rejects an invalid email", () => {
		expect(
			clientSchema.safeParse({ ...validClient, email: "not-an-email" })
				.success,
		).toBe(false);
	});

	it("rejects an unknown currency code", () => {
		expect(
			clientSchema.safeParse({ ...validClient, currencyCode: "XXA" })
				.success,
		).toBe(false);
	});

	it("rejects a lowercase currency code", () => {
		expect(
			clientSchema.safeParse({ ...validClient, currencyCode: "usd" })
				.success,
		).toBe(false);
	});

	it("rejects an over-long address", () => {
		expect(
			clientSchema.safeParse({ ...validClient, address: "a".repeat(501) })
				.success,
		).toBe(false);
	});

	it("rejects over-long notes", () => {
		expect(
			clientSchema.safeParse({ ...validClient, notes: "a".repeat(2001) })
				.success,
		).toBe(false);
	});
});

describe("projectSchema", () => {
	const validProject = { name: "Weekly turnover", description: "Standard clean" };

	it("accepts a valid project", () => {
		expect(projectSchema.safeParse(validProject).success).toBe(true);
	});

	it("accepts a project without a description", () => {
		expect(
			projectSchema.safeParse({ name: "Deep clean" }).success,
		).toBe(true);
	});

	it("rejects an empty name", () => {
		expect(projectSchema.safeParse({ ...validProject, name: "" }).success).toBe(
			false,
		);
	});

	it("rejects a name over 200 characters", () => {
		expect(
			projectSchema.safeParse({ ...validProject, name: "a".repeat(201) })
				.success,
		).toBe(false);
	});

	it("rejects over-long descriptions", () => {
		expect(
			projectSchema.safeParse({
				...validProject,
				description: "a".repeat(2001),
			}).success,
		).toBe(false);
	});
});
