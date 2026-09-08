import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db";

// Guard against accidentally shipping with the limiter disabled: E2E=1
// must only ever be set by the Playwright webServer.
if (process.env.E2E === "1" && process.env.NODE_ENV === "production") {
	console.warn(
		"[paytrail] E2E=1 is set on a production build - better-auth rate limiting is DISABLED. Unset E2E outside the test suite.",
	);
}

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
