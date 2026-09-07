import { afterAll, describe, expect, it } from "vitest";
import { isOnboardingComplete } from "./onboarding";
import { prisma } from "./db";

const TEST_USER_ID = "test-onboarding-gate-user";

async function seedUser() {
	await prisma.user.upsert({
		where: { id: TEST_USER_ID },
		update: {},
		create: { id: TEST_USER_ID, name: "Gate Test", email: "gate-test@example.com" },
	});
}

describe("isOnboardingComplete", () => {
	afterAll(async () => {
		await prisma.user.delete({ where: { id: TEST_USER_ID } }).catch(() => {});
	});

	it("returns false when the user has no business profile", async () => {
		await seedUser();
		await prisma.businessProfile.deleteMany({ where: { userId: TEST_USER_ID } });
		expect(await isOnboardingComplete(TEST_USER_ID)).toBe(false);
	});

	it("returns false when the profile exists but onboarding is incomplete", async () => {
		await seedUser();
		await prisma.businessProfile.deleteMany({ where: { userId: TEST_USER_ID } });
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
		await prisma.businessProfile.deleteMany({ where: { userId: TEST_USER_ID } });
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
