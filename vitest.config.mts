import { defineConfig } from "vitest/config";

// Suites that hit the shared Postgres instance (see the db:setup script).
const DB_SUITES = [
	"src/lib/auth-smoke.test.ts",
	"src/lib/clients-repo.test.ts",
	"src/lib/db-smoke.test.ts",
	"src/lib/onboarding.test.ts",
	"src/lib/projects-repo.test.ts",
	"src/lib/rate-rules.test.ts",
];

export default defineConfig({
	test: {
		coverage: {
			provider: "v8",
			include: ["src/lib/**"],
			// "use server" wrappers hold no business logic — the session
			// resolution is exercised by the Playwright E2E suite instead.
			exclude: ["src/lib/**/*-actions.ts"],
		},
		projects: [
			{
				test: {
					name: "unit",
					environment: "node",
					include: ["src/**/*.{test,spec}.{ts,tsx}"],
					exclude: DB_SUITES,
				},
			},
			{
				test: {
					name: "integration",
					environment: "node",
					include: DB_SUITES,
					// The suites share one Postgres instance and fixed seed
					// fixtures; running them in parallel invites collisions.
					fileParallelism: false,
				},
			},
		],
	},
});
