import { describe, expect, it } from "vitest";
import { auth } from "./auth";
import { prisma } from "./db";

describe("better auth signup", () => {
	it("creates a user and credential account through the prisma adapter", async () => {
		const email = `smoke-${Date.now()}@example.com`;
		const { user } = await auth.api.signUpEmail({
			body: { name: "Smoke", email, password: "correct-horse-battery" },
		});
		expect(user.email).toBe(email);

		const account = await prisma.account.findFirst({
			where: { userId: user.id, providerId: "credential" },
		});
		expect(account).not.toBeNull();
		expect(account?.issuer).toBe("local:credential");

		await prisma.user.delete({ where: { id: user.id } });
	});
});
