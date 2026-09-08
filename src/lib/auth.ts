import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db";

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	emailAndPassword: {
		enabled: true,
	},
	// The E2E suite fires rapid signups from one IP (localhost). Playwright's
	// webServer sets E2E=1 so the prod-build server skips rate limiting;
	// real deployments keep it on.
	rateLimit: {
		enabled: process.env.E2E !== "1",
	},
	plugins: [nextCookies()],
});
