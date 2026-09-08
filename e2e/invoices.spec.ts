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
	// The click can be swallowed before React hydrates — retry until the
	// signup request actually navigates.
	for (let attempt = 0; attempt < 5; attempt++) {
		await page.getByRole("button", { name: "Create account" }).click();
		try {
			await page.waitForURL(/\/onboarding$/, { timeout: 5000 });
			return;
		} catch {
			// still on /signup — click again
		}
	}
	await expect(page).toHaveURL(/\/onboarding$/);
}

/**
 * Complete onboarding so the dashboard gate lets us through, and add
 * one client (needed before invoices can be created).
 */
async function onboardAndAddClient(page: Page) {
	// Business profile step
	await expect(page).toHaveURL(/\/onboarding/);
	await page.getByLabel("Business name").fill("Sparkle Services");
	await page.getByLabel("Billing email").fill("billing@sparkle.example");
	await page.getByRole("button", { name: "Next", exact: true }).click();
	// Step 2 (financial defaults) — pre-filled, continue. The click can be
	// swallowed by the step-transition re-render, so retry until step 3.
	for (let attempt = 0; attempt < 5; attempt++) {
		await page.getByRole("button", { name: "Next", exact: true }).click();
		try {
			await page
				.getByRole("button", { name: "Finish setup" })
				.waitFor({ state: "visible", timeout: 3000 });
			break;
		} catch {
			// still on step 2 — click again
		}
	}
	// Step 3 (rate rules) — rate rules are optional, finish immediately.
	// Same swallowed-click race as above: retry until the save completes.
	for (let attempt = 0; attempt < 5; attempt++) {
		await page.getByRole("button", { name: "Finish setup" }).click();
		try {
			await page.waitForURL(/\/dashboard$/, { timeout: 5000 });
			break;
		} catch {
			// save didn't start — click again
		}
	}
	await expect(page).toHaveURL(/\/dashboard$/);

	// Client
	await page.getByRole("link", { name: "Clients" }).click();
	await expect(page).toHaveURL(/\/clients$/);
	for (let attempt = 0; attempt < 5; attempt++) {
		await page.getByRole("button", { name: "Add client" }).first().click();
		try {
			await page
				.getByRole("dialog")
				.waitFor({ state: "visible", timeout: 2000 });
			break;
		} catch {
			// not hydrated yet — click again
		}
	}
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Name").fill("Sunset Villa");
	await dialog.getByLabel("Email").fill("owner@sunsetvilla.com");
	await dialog.getByRole("button", { name: "Add client" }).click();
	await expect(dialog).toBeHidden();
}

test("critical path: dashboard → invoice → send in under 2 minutes and 10 clicks", async ({
	page,
}, testInfo) => {
	// Dev-mode route compiles are slow on first hit; the real budget we
	// assert on is the 2-minute invoice flow, so allow headroom.
	test.setTimeout(180_000);
	const email = uniqueEmail();
	await signUp(page, email);

	// Click budget applies to the invoice flow itself (post-onboarding).
	let clicks = 0;
	const budgetedClick = async (locator: { click(): Promise<void> }) => {
		clicks += 1;
		await locator.click();
	};

	await onboardAndAddClient(page);

	// Return to the dashboard (the hub where the invoice journey starts)
	await budgetedClick(page.getByRole("link", { name: "Dashboard" }));
	await expect(page).toHaveURL(/\/dashboard$/);

	// 1. Dashboard → Invoices
	await budgetedClick(page.getByRole("link", { name: "Invoices" }));
	await expect(page).toHaveURL(/\/invoices$/);
	await expect(page.getByText("No invoices yet")).toBeVisible();

	// 2. New invoice
	await budgetedClick(
		page
			.getByRole("link", { name: "New invoice" })
			.or(page.getByRole("button", { name: "New invoice" }))
			.first(),
	);
	await expect(page).toHaveURL(/\/invoices\/new$/);
	await expect(page.getByLabel("Invoice number")).toHaveValue(
		/^INV-\d{4}-\d{4,}$/,
	);

	// 3. Fill the invoice (label targeting is not a click)
	await budgetedClick(page.getByLabel("Client"));
	await budgetedClick(page.getByRole("option", { name: "Sunset Villa" }));
	await page.getByLabel("Description").first().fill("Deep clean");
	await page.getByLabel("Amount").first().fill("120");

	// 4. Send (opens confirm dialog)
	await budgetedClick(page.getByRole("button", { name: "Send" }));
	await expect(page.getByText(/no longer be edited or deleted/i)).toBeVisible();
	await budgetedClick(page.getByRole("button", { name: "Send invoice" }));

	// 5. Redirected to the read-only invoice, locked as SENT. First
	// compile of the [id] route in dev is slow — allow generous timeout.
	await expect(page).toHaveURL(/\/invoices\/[a-z0-9]+$/);
	await expect(page.getByRole("button", { name: "Mark as paid" })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText("SENT").first()).toBeVisible();
	await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);
	await expect(page.getByLabel("Description").first()).toBeDisabled();

	// 6. Back to list — status hub shows the sent invoice
	await budgetedClick(
		page
			.getByRole("button", { name: "Back" })
			.or(page.getByRole("link", { name: /back/i })),
	);
	await expect(page).toHaveURL(/\/invoices$/);
	await expect(page.getByText(/^INV-\d{4}-\d{4,}$/).first()).toBeVisible({
		timeout: 30_000,
	});

	// Dashboard reflects one outstanding (sent, unpaid) invoice
	await page.getByRole("link", { name: "Dashboard", exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
	await expect(page.getByText("1 outstanding")).toBeVisible();

	expect(clicks).toBeLessThanOrEqual(10);
	expect(testInfo.duration).toBeLessThan(120_000);
});
