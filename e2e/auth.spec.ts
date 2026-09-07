import { expect, type Page, test } from "@playwright/test";

const uniqueEmail = () =>
	`user-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
const password = "correct-horse-battery";

/** Sign up and expect the mandatory onboarding gate (not the dashboard). */
async function signUp(page: Page, email: string) {
	await page.goto("/signup");
	await expect(
		page.getByRole("heading", { name: "Create your account" }),
	).toBeVisible();
	await page.getByLabel("Name").fill("Test User");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password").fill(password);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/onboarding$/);
}

test("signup lands on the mandatory onboarding gate", async ({ page }) => {
	await signUp(page, uniqueEmail());
	await expect(
		page.getByRole("heading", { name: "Set up your business" }),
	).toBeVisible();

	// The dashboard stays gated until onboarding is complete.
	await page.goto("/dashboard");
	await expect(page).toHaveURL(/\/onboarding$/);
});

test("login redirects to onboarding while profile is incomplete", async ({
	page,
}) => {
	const email = uniqueEmail();
	await signUp(page, email);

	await page.context().clearCookies();
	await page.goto("/login");
	await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password").fill(password);
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page).toHaveURL(/\/onboarding$/);
});

test("dashboard redirects unauthenticated visitors to login", async ({
	page,
}) => {
	await page.goto("/dashboard");
	await expect(page).toHaveURL(/\/login$/);
});
