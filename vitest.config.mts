import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		environment: "jsdom",
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		coverage: {
			provider: "v8",
			include: ["src/lib/**"],
			// "use server" wrappers hold no business logic — the session
			// resolution is exercised by the Playwright E2E suite instead.
			exclude: ["src/lib/**/*-actions.ts"],
		},
	},
});
