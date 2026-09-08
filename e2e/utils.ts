import { expect, type Page } from "@playwright/test";

export const TEST_PASSWORD = "correct-horse-battery";

let emailCounter = 0;

/** Unique per-call email; the counter guards against same-ms collisions. */
export function uniqueEmail(prefix = "user"): string {
	emailCounter += 1;
	return `${prefix}-${Date.now()}-${emailCounter}@example.com`;
}

/**
 * Sign up a fresh user. Every signup lands on the mandatory onboarding
 * gate — the dashboard stays gated until onboarding is complete.
 */
export async function signUp(page: Page, email: string, name = "Test User") {
	await page.goto("/signup");
	await expect(
		page.getByRole("heading", { name: "Create your account" }),
	).toBeVisible();
	await page.getByLabel("Name").fill(name);
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password").fill(TEST_PASSWORD);
	await page.getByRole("button", { name: "Create account" }).click();
	// Signup pushes /dashboard, whose server gate redirects to /onboarding.
	// In dev the first compile of both routes can exceed the 5s default.
	await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });
}

/**
 * Sign up and complete onboarding with defaults (USD, zero rate rules),
 * ending on the profile page.
 */
export async function signUpToProfile(page: Page, email: string) {
	await signUp(page, email, "Rate E2E");

	// Step 1: business identity
	await page.getByLabel("Business name").fill("Rate E2E Co");
	await page.getByRole("button", { name: "Next", exact: true }).click();
	// Step 2: financial defaults (currency USD, zero rules is valid)
	await page.getByRole("button", { name: "Next", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "Add rate rule" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Finish setup" }).click();
	await expect(page).toHaveURL(/\/dashboard$/);

	await page.getByRole("link", { name: "Profile" }).click();
	await expect(page).toHaveURL(/\/profile$/);
}

/**
 * Clicks the trigger and waits for the dialog. A click before hydration
 * is a no-op, so retry until the dialog actually appears (defensive:
 * the prod-build server still has a first-paint gap under CI cold starts).
 */
export async function openAddClientDialog(page: Page) {
	const dialog = page.getByRole("dialog");
	for (let attempt = 0; attempt < 5; attempt++) {
		await page.getByRole("button", { name: "Add client" }).first().click();
		try {
			await dialog.waitFor({ state: "visible", timeout: 2000 });
			return dialog;
		} catch {
			// not hydrated yet — click again
		}
	}
	throw new Error("Add client dialog did not open");
}

/** Clicks the client link and waits for navigation, retrying on hydration races. */
export async function openClientDetail(page: Page, name: string) {
	const link = page.getByRole("link", { name });
	for (let attempt = 0; attempt < 3; attempt++) {
		await link.click();
		try {
			await page.waitForURL(/\/clients\/[a-z0-9]+$/, { timeout: 3000 });
			return;
		} catch {
			// navigation didn't happen — click again
		}
	}
	throw new Error(`Client detail page for "${name}" did not open`);
}
