import { defineConfig, devices } from "@playwright/test";

// Port is overridable so parallel worktrees can run E2E without
// colliding with another checkout's dev server (defaults unchanged).
const port = process.env.PLAYWRIGHT_PORT ?? "3000";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	reporter: "html",
	use: {
		baseURL: `http://localhost:${port}`,
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
		// Pin the port explicitly so next dev binds the port Playwright
		// waits on (next would otherwise auto-fallback to a free port,
		// e.g. grabbing 3000 while PLAYWRIGHT_PORT=3001 was expected).
		command: `pnpm exec next dev -p ${port}`,
		url: `http://localhost:${port}`,
		reuseExistingServer: true,
	},
});
