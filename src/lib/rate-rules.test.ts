import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "./db";
import {
	addRateRule,
	assertUniqueKeyword,
	deleteRateRule,
	reorderRateRules,
	updateProfileSettings,
	updateRateRule,
} from "./rate-rules";

const OWNER_ID = "test-rate-rules-owner";
const OTHER_ID = "test-rate-rules-other";

async function seedUser(id: string, email: string) {
	await prisma.user.upsert({
		where: { id },
		update: {},
		create: { id, name: "Rate Test", email },
	});
}

async function seedRules(
	userId: string,
	rules: { keyword: string; rateMinor: number }[],
) {
	await prisma.rateRule.deleteMany({ where: { userId } });
	let i = 0;
	for (const rule of rules) {
		await prisma.rateRule.create({
			data: { ...rule, userId, sortOrder: i++ },
		});
	}
}

describe("rate-rules mutations", () => {
	afterAll(async () => {
		await prisma.user.delete({ where: { id: OWNER_ID } }).catch(() => {});
		await prisma.user.delete({ where: { id: OTHER_ID } }).catch(() => {});
	});

	beforeEach(async () => {
		await seedUser(OWNER_ID, "rate-owner@example.com");
		await seedUser(OTHER_ID, "rate-other@example.com");
	});

	describe("updateProfileSettings", () => {
		it("updates profile fields for the owning user", async () => {
			await prisma.businessProfile.upsert({
				where: { userId: OWNER_ID },
				update: {},
				create: {
					userId: OWNER_ID,
					businessName: "Old Name",
					currency: "USD",
					defaultTaxRate: 0,
				},
			});
			await updateProfileSettings(OWNER_ID, {
				businessName: "New Name",
				city: "Jakarta",
				currency: "IDR",
				defaultTaxRate: "11",
				paymentTerms: "net_14",
			});
			const profile = await prisma.businessProfile.findUniqueOrThrow({
				where: { userId: OWNER_ID },
			});
			expect(profile.businessName).toBe("New Name");
			expect(profile.city).toBe("Jakarta");
			expect(profile.currency).toBe("IDR");
			expect(profile.defaultTaxRate.toFixed(2)).toBe("11.00");
			expect(profile.paymentTerms).toBe("net_14");
			expect(profile.onboardingCompleted).toBe(true);
		});

		it("throws for an unknown user", async () => {
			await expect(
				updateProfileSettings("no-such-user", {
					businessName: "X",
					currency: "USD",
					defaultTaxRate: "0",
				}),
			).rejects.toThrow();
		});
	});

	describe("addRateRule", () => {
		it("appends a rule with the next sortOrder", async () => {
			await seedRules(OWNER_ID, [
				{ keyword: "standard clean", rateMinor: 4550 },
				{ keyword: "linen change", rateMinor: 750 },
			]);
			const created = await addRateRule(OWNER_ID, {
				keyword: "hot tub",
				rateMinor: 2000,
			});
			const rules = await prisma.rateRule.findMany({
				where: { userId: OWNER_ID },
				orderBy: { sortOrder: "asc" },
			});
			expect(rules).toHaveLength(3);
			expect(rules[2].id).toBe(created.id);
			expect(rules[2].keyword).toBe("hot tub");
			expect(rules[2].rateMinor).toBe(2000);
			expect(rules[2].sortOrder).toBe(2);
		});

		it("throws for an unknown user", async () => {
			await expect(
				addRateRule("no-such-user", { keyword: "x", rateMinor: 100 }),
			).rejects.toThrow();
		});
	});

	describe("updateRateRule", () => {
		it("updates an owned rule", async () => {
			await seedRules(OWNER_ID, [{ keyword: "old", rateMinor: 100 }]);
			const rule = await prisma.rateRule.findFirstOrThrow({
				where: { userId: OWNER_ID },
			});
			await updateRateRule(OWNER_ID, rule.id, {
				keyword: "new",
				rateMinor: 250,
			});
			const updated = await prisma.rateRule.findUniqueOrThrow({
				where: { id: rule.id },
			});
			expect(updated.keyword).toBe("new");
			expect(updated.rateMinor).toBe(250);
		});

		it("throws when the rule belongs to another user", async () => {
			await seedRules(OTHER_ID, [{ keyword: "theirs", rateMinor: 100 }]);
			const rule = await prisma.rateRule.findFirstOrThrow({
				where: { userId: OTHER_ID },
			});
			await expect(
				updateRateRule(OWNER_ID, rule.id, { keyword: "hacked" }),
			).rejects.toThrow();
		});

		it("throws for an unknown rule id", async () => {
			await expect(
				updateRateRule(OWNER_ID, "no-such-rule", { keyword: "x" }),
			).rejects.toThrow();
		});
	});

	describe("deleteRateRule", () => {
		it("deletes an owned rule", async () => {
			await seedRules(OWNER_ID, [
				{ keyword: "a", rateMinor: 100 },
				{ keyword: "b", rateMinor: 200 },
			]);
			const rule = await prisma.rateRule.findFirstOrThrow({
				where: { userId: OWNER_ID, keyword: "a" },
			});
			await deleteRateRule(OWNER_ID, rule.id);
			const rules = await prisma.rateRule.findMany({
				where: { userId: OWNER_ID },
			});
			expect(rules).toHaveLength(1);
			expect(rules[0].keyword).toBe("b");
		});

		it("throws when the rule belongs to another user", async () => {
			await seedRules(OTHER_ID, [{ keyword: "theirs", rateMinor: 100 }]);
			const rule = await prisma.rateRule.findFirstOrThrow({
				where: { userId: OTHER_ID },
			});
			await expect(deleteRateRule(OWNER_ID, rule.id)).rejects.toThrow();
		});
	});

	describe("assertUniqueKeyword", () => {
		it("resolves when the keyword is unique for the user", async () => {
			await seedRules(OWNER_ID, [
				{ keyword: "standard clean", rateMinor: 4550 },
			]);
			await expect(
				assertUniqueKeyword(OWNER_ID, "hot tub"),
			).resolves.toBeUndefined();
		});

		it("rejects on a case-insensitive duplicate", async () => {
			await seedRules(OWNER_ID, [
				{ keyword: "Standard Clean", rateMinor: 4550 },
			]);
			await expect(
				assertUniqueKeyword(OWNER_ID, "standard clean"),
			).rejects.toThrow();
		});

		it("allows the rule's own keyword when excluded", async () => {
			await seedRules(OWNER_ID, [{ keyword: "linen change", rateMinor: 750 }]);
			const rule = await prisma.rateRule.findFirstOrThrow({
				where: { userId: OWNER_ID },
			});
			await expect(
				assertUniqueKeyword(OWNER_ID, "LINEN CHANGE", rule.id),
			).resolves.toBeUndefined();
		});

		it("ignores rules owned by other users", async () => {
			await seedRules(OTHER_ID, [{ keyword: "shared name", rateMinor: 100 }]);
			await expect(
				assertUniqueKeyword(OWNER_ID, "shared name"),
			).resolves.toBeUndefined();
		});
	});

	describe("reorderRateRules", () => {
		it("assigns sortOrder following the given id order", async () => {
			await seedRules(OWNER_ID, [
				{ keyword: "a", rateMinor: 100 },
				{ keyword: "b", rateMinor: 200 },
				{ keyword: "c", rateMinor: 300 },
			]);
			const rules = await prisma.rateRule.findMany({
				where: { userId: OWNER_ID },
				orderBy: { sortOrder: "asc" },
			});
			const reversed = rules.map((r) => r.id).reverse();
			await reorderRateRules(OWNER_ID, reversed);
			const after = await prisma.rateRule.findMany({
				where: { userId: OWNER_ID },
				orderBy: { sortOrder: "asc" },
			});
			expect(after.map((r) => r.keyword)).toEqual(["c", "b", "a"]);
			expect(after.map((r) => r.sortOrder)).toEqual([0, 1, 2]);
		});

		it("throws when any id is not owned by the user", async () => {
			await seedRules(OWNER_ID, [{ keyword: "mine", rateMinor: 100 }]);
			await seedRules(OTHER_ID, [{ keyword: "theirs", rateMinor: 100 }]);
			const mine = await prisma.rateRule.findFirstOrThrow({
				where: { userId: OWNER_ID },
			});
			const theirs = await prisma.rateRule.findFirstOrThrow({
				where: { userId: OTHER_ID },
			});
			await expect(
				reorderRateRules(OWNER_ID, [mine.id, theirs.id]),
			).rejects.toThrow();
		});
	});
});
