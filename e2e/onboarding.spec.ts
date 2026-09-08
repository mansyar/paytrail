import { expect, test } from "@playwright/test";
import { signUp, TEST_PASSWORD, uniqueEmail } from "./utils";

test("signup, complete onboarding, edit profile, sign out", async ({
	page,
}) => {
	const email = uniqueEmail("onb");
	await signUp(page, email);
	await expect(
		page.getByRole("heading", { name: "Set up your business" }),
	).toBeVisible();

	// Step 1: business identity
	await page.getByLabel("Business name").fill("E2E Clean Co");
	await page.getByRole("button", { name: "Next", exact: true }).click();
	await expect(page.getByLabel("Home currency")).toBeVisible();

	// Step 2: financial defaults (defaults are fine)
	await page.getByRole("button", { name: "Next", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "Add rate rule" }),
	).toBeVisible();

	// Step 3: rate rules
	await page.getByRole("button", { name: "Add rate rule" }).click();
	await page.getByLabel("Keyword").fill("standard clean");
	await page.getByLabel("Flat rate").fill("45.50");
	await page.getByRole("button", { name: "Finish setup" }).click();

	// Dashboard, finally.
	await expect(page).toHaveURL(/\/dashboard$/);
	await expect(page.getByText(email)).toBeVisible();

	// Profile editing: the wizard's data should be there and editable.
	await page.getByRole("link", { name: "Profile" }).click();
	await expect(page).toHaveURL(/\/profile$/);
	const nameField = page.getByLabel("Business name");
	await expect(nameField).toHaveValue("E2E Clean Co");
	await nameField.fill("E2E Clean Co v2");
	await page.getByRole("button", { name: "Save profile" }).click();
	await expect(page.getByText("Profile saved.")).toBeVisible();

	// Round trip: back to the dashboard, sign out, sign back in.
	await page.goto("/dashboard");
	await page.getByRole("button", { name: "Sign out" }).click();
	await expect(page).toHaveURL(/\/login$/);
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password").fill(TEST_PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
	await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("rate rule validation: empty keyword blocks finishing", async ({
	page,
}) => {
	const email = uniqueEmail("onb");
	await signUp(page, email);

	await page.getByLabel("Business name").fill("Validation Co");
	await page.getByRole("button", { name: "Next", exact: true }).click();
	await expect(page.getByLabel("Home currency")).toBeVisible();
	await page.getByRole("button", { name: "Next", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "Add rate rule" }),
	).toBeVisible();

	// A blank row (added server-side) must not pass validation.
	await page.getByRole("button", { name: "Add rate rule" }).click();
	await page.getByRole("button", { name: "Finish setup" }).click();
	await expect(page).toHaveURL(/\/onboarding$/);
	await expect(
		page.getByRole("button", { name: "Finish setup" }),
	).toBeVisible();

	// Filling the row recovers the submission.
	await page.getByLabel("Keyword").fill("deep clean");
	await page.getByLabel("Flat rate").fill("60");
	await page.getByRole("button", { name: "Finish setup" }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
});
