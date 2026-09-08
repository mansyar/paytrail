import { defineConfig, devices } from "@playwright/test";

// Port is overridable so parallel worktrees can run E2E without
// colliding with another checkout's server (defaults unchanged).
const port = process.env.PLAYWRIGHT_PORT ?? "3000";

// Production build by default: `next dev` compiles routes on demand, which
// (a) introduces hydration races and (b) blows through test timeouts on
// first navigation. Opt back into dev with PLAYWRIGHT_DEV=1 for debugging.
const useDevServer = process.env.PLAYWRIGHT_DEV === "1";
const command = useDevServer
	? `pnpm exec next dev -p ${port}`
	: `pnpm exec next build && pnpm exec next start -p ${port}`;

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	reporter: "html",
	use: {
		baseURL: `http://localhost:${port}`,
		// Post-mortem context for failures, at near-zero cost for passes.
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "chromium-mobile",
			use: { ...devices["Pixel 7"] },
		},
	],
	webServer: {
		command,
		url: `http://localhost:${port}`,
		// First prod build can take a while.
		timeout: 300_000,
		// Flag the server as E2E-driven (skips better-auth rate limiting).
		env: { ...process.env, E2E: "1" },
		reuseExistingServer: true,
	},
});
