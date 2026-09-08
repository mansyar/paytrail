import { describe, expect, it } from "vitest";
import { prisma } from "./db";

describe.skipIf(!process.env.DATABASE_URL)("prisma client", () => {
	it("exposes the better auth model delegates", () => {
		expect(prisma).toHaveProperty("user");
		expect(prisma).toHaveProperty("session");
		expect(prisma).toHaveProperty("account");
		expect(prisma).toHaveProperty("verification");
	});
});
