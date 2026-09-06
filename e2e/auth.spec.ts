import { expect, type Page, test } from "@playwright/test";

const uniqueEmail = () =>
	`user-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
const password = "correct-horse-battery";

async function signUp(page: Page, email: string) {
	await page.goto("/signup");
	await expect(
		page.getByRole("heading", { name: "Create your account" }),
	).toBeVisible();
	await page.getByLabel("Name").fill("Test User");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password").fill(password);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
	await expect(page.getByText(email)).toBeVisible();
}

test("signup → dashboard → logout", async ({ page }) => {
	const email = uniqueEmail();
	await signUp(page, email);

	await page.getByRole("button", { name: "Sign out" }).click();
	await expect(page).toHaveURL(/\/login$/);
});

test("login → dashboard after logout", async ({ page }) => {
	const email = uniqueEmail();
	await signUp(page, email);
	await page.getByRole("button", { name: "Sign out" }).click();
	await expect(page).toHaveURL(/\/login$/);

	await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password").fill(password);
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
	await expect(page.getByText(email)).toBeVisible();
});

test("dashboard redirects unauthenticated visitors to login", async ({
	page,
}) => {
	await page.goto("/dashboard");
	await expect(page).toHaveURL(/\/login$/);
});
