import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { isOnboardingComplete, saveOnboardingData } from "./onboarding";

// Unique per run: a fixed id collides with leftover rows if a previous
// run failed mid-cleanup, and across concurrent runners.
const TEST_USER_ID = crypto.randomUUID();
const TEST_USER_EMAIL = `gate-test-${crypto.randomUUID()}@example.com`;

async function seedUser() {
	await prisma.user.upsert({
		where: { id: TEST_USER_ID },
		update: {},
		create: {
			id: TEST_USER_ID,
			name: "Gate Test",
			email: TEST_USER_EMAIL,
		},
	});
}

describe.skipIf(!process.env.DATABASE_URL)("isOnboardingComplete", () => {
	afterAll(async () => {
		await prisma.user.delete({ where: { id: TEST_USER_ID } }).catch(() => {});
	});

	it("returns false when the user has no business profile", async () => {
		await seedUser();
		await prisma.businessProfile.deleteMany({
			where: { userId: TEST_USER_ID },
		});
		expect(await isOnboardingComplete(TEST_USER_ID)).toBe(false);
	});

	it("returns false when the profile exists but onboarding is incomplete", async () => {
		await seedUser();
		await prisma.businessProfile.deleteMany({
			where: { userId: TEST_USER_ID },
		});
		await prisma.businessProfile.create({
			data: {
				userId: TEST_USER_ID,
				businessName: "WIP Co",
				currency: "USD",
				defaultTaxRate: 0,
			},
		});
		expect(await isOnboardingComplete(TEST_USER_ID)).toBe(false);
	});

	it("returns true when onboardingCompleted is set", async () => {
		await seedUser();
		await prisma.businessProfile.deleteMany({
			where: { userId: TEST_USER_ID },
		});
		await prisma.businessProfile.create({
			data: {
				userId: TEST_USER_ID,
				businessName: "Done Co",
				currency: "USD",
				defaultTaxRate: 11,
				onboardingCompleted: true,
			},
		});
		expect(await isOnboardingComplete(TEST_USER_ID)).toBe(true);
	});
});

describe.skipIf(!process.env.DATABASE_URL)("saveOnboardingData", () => {
	const minimalPayload = {
		profile: {
			businessName: "Sparkle Clean Co",
			currency: "IDR" as const,
			defaultTaxRate: "11",
		},
		rateRules: [
			{ keyword: "standard clean", rateMinor: 4550 },
			{ keyword: "linen change", rateMinor: 750 },
		],
	};

	afterAll(async () => {
		await prisma.user.delete({ where: { id: TEST_USER_ID } }).catch(() => {});
	});

	it("creates the profile and rate rules and marks onboarding complete", async () => {
		await seedUser();
		await prisma.businessProfile.deleteMany({
			where: { userId: TEST_USER_ID },
		});
		await prisma.rateRule.deleteMany({ where: { userId: TEST_USER_ID } });

		await saveOnboardingData(TEST_USER_ID, minimalPayload);

		const profile = await prisma.businessProfile.findUnique({
			where: { userId: TEST_USER_ID },
		});
		expect(profile?.businessName).toBe("Sparkle Clean Co");
		expect(profile?.currency).toBe("IDR");
		expect(profile?.defaultTaxRate.toFixed(2)).toBe("11.00");
		expect(profile?.onboardingCompleted).toBe(true);
		expect(await isOnboardingComplete(TEST_USER_ID)).toBe(true);

		const rules = await prisma.rateRule.findMany({
			where: { userId: TEST_USER_ID },
			orderBy: { sortOrder: "asc" },
		});
		expect(rules.map((r) => [r.keyword, r.rateMinor, r.sortOrder])).toEqual([
			["standard clean", 4550, 0],
			["linen change", 750, 1],
		]);
	});

	it("replaces previous rate rules on re-save", async () => {
		await seedUser();
		await saveOnboardingData(TEST_USER_ID, minimalPayload);
		await saveOnboardingData(TEST_USER_ID, {
			profile: { ...minimalPayload.profile, businessName: "Renamed Co" },
			rateRules: [{ keyword: "hot tub", rateMinor: 2000 }],
		});

		const profile = await prisma.businessProfile.findUnique({
			where: { userId: TEST_USER_ID },
		});
		expect(profile?.businessName).toBe("Renamed Co");
		const rules = await prisma.rateRule.findMany({
			where: { userId: TEST_USER_ID },
		});
		expect(rules).toHaveLength(1);
		expect(rules[0]?.keyword).toBe("hot tub");
	});

	it("persists optional fields including the logo", async () => {
		await seedUser();
		await saveOnboardingData(TEST_USER_ID, {
			profile: {
				...minimalPayload.profile,
				addressLine1: "Jl. Mawar 12",
				city: "Jakarta",
				logo: "data:image/png;base64,iVBORw0KGgo=",
				paymentTerms: "net_14" as const,
			},
			rateRules: [],
		});

		const profile = await prisma.businessProfile.findUnique({
			where: { userId: TEST_USER_ID },
		});
		expect(profile?.addressLine1).toBe("Jl. Mawar 12");
		expect(profile?.city).toBe("Jakarta");
		expect(profile?.logo).toBe("data:image/png;base64,iVBORw0KGgo=");
		expect(profile?.paymentTerms).toBe("net_14");
	});

	it("rejects a save for an unknown user", async () => {
		await expect(
			saveOnboardingData("no-such-user-xyz", minimalPayload),
		).rejects.toThrow();
	});
});
