import { expect, type Page, test } from "@playwright/test";

const uniqueEmail = () =>
	`fx-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
const password = "correct-horse-battery";

async function signUp(page: Page, email: string) {
	await page.goto("/signup");
	await expect(
		page.getByRole("heading", { name: "Create your account" }),
	).toBeVisible();
	await page.getByLabel("Name").fill("FX Test User");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password").fill(password);
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

/** Onboard with USD home currency, then add an EUR client. */
async function onboardAndAddEurClient(page: Page) {
	await expect(page).toHaveURL(/\/onboarding/);
	await page.getByLabel("Business name").fill("FX Services");
	await page.getByRole("button", { name: "Next", exact: true }).click();
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

	await page.getByRole("link", { name: "Clients" }).click();
	await expect(page).toHaveURL(/\/clients$/);
	const dialog = await openAddClientDialog(page);
	await dialog.getByLabel("Name").fill("Villa Epsilon");
	await dialog.getByLabel("Email").fill("owner@epsilon.example");
	// Client billing currency EUR (home is USD) — triggers FX snapshotting.
	await dialog.getByLabel("Currency").click();
	await page.getByRole("option", { name: "EUR", exact: true }).click();
	await dialog.getByRole("button", { name: "Add client" }).click();
	await expect(dialog).toBeHidden();
}

/** Hydration-safe dialog opener (shared pattern from invoices.spec). */
async function openAddClientDialog(page: Page) {
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

test("EUR invoice: rate prefill, manual override, frozen snapshot, home-currency equivalent", async ({
	page,
}) => {
	test.setTimeout(180_000);
	const email = uniqueEmail();
	await signUp(page, email);
	await onboardAndAddEurClient(page);

	// New invoice for the EUR client — the rate field prefills with the
	// effective rate resolved server-side (live provider, cached) and the
	// totals block previews the home-currency equivalent. Exact rate values
	// are provider-dependent, so only the shape is asserted here.
	await page.getByRole("link", { name: "Dashboard", exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
	await page.getByRole("link", { name: "Invoices" }).click();
	await expect(page).toHaveURL(/\/invoices$/);
	await page
		.getByRole("link", { name: "New invoice" })
		.or(page.getByRole("button", { name: "New invoice" }))
		.first()
		.click();
	await expect(page).toHaveURL(/\/invoices\/new$/);
	await page.getByLabel("Client").click();
	await page.getByRole("option", { name: "Villa Epsilon" }).click();
	await page.getByLabel("Description").first().fill("Deep clean");
	await page.getByLabel("Amount").first().fill("120");

	const rateField = page.getByLabel(/Exchange rate/);
	await expect(rateField).toHaveValue(/^\d+(\.\d+)?$/, { timeout: 30_000 });
	await expect(
		page.getByText(/≈ \$\d+\.\d{2} @ \d+(\.\d+)? USD/),
	).toBeVisible();

	// Manual override: 1 EUR = 2 USD → 120.00 EUR becomes exactly $240.00.
	await rateField.fill("2");
	await page.getByRole("button", { name: "Save draft" }).click();
	await expect(page).toHaveURL(/\/invoices\/[a-z0-9]+$/);
	await expect(page.getByText("≈ $240.00 @ 2 USD")).toBeVisible();

	// The list shows the home-currency equivalent from the snapshot. The
	// Back navigation can serve the client-side router cache (which still
	// holds the pre-create empty list), so force a fresh server render.
	await page
		.getByRole("button", { name: "Back" })
		.or(page.getByRole("link", { name: /back/i }))
		.first()
		.click();
	await expect(page).toHaveURL(/\/invoices$/);
	await page.reload();
	// The list shows the home-currency equivalent from the snapshot. Both
	// desktop (table) and mobile (cards) renders exist in the DOM, one
	// display:none per breakpoint — match only the visible copy.
	const listEquivalent = page
		.locator("span:visible", { hasText: "≈ $240.00 @ 2 USD" })
		.first();
	await expect(listEquivalent).toBeVisible({ timeout: 30_000 });

	// Sending freezes the snapshot: rate field becomes read-only.
	await page
		.locator("a:visible", { hasText: /^INV-\d{4}-\d{4,}$/ })
		.first()
		.click();
	await expect(page).toHaveURL(/\/invoices\/[a-z0-9]+$/);
	await page.getByRole("button", { name: "Send", exact: true }).click();
	await expect(page.getByText(/no longer be edited or deleted/i)).toBeVisible();
	await page.getByRole("button", { name: "Send invoice" }).click();
	await expect(page.getByRole("button", { name: "Mark as paid" })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByLabel(/Exchange rate/)).toBeDisabled();
	await expect(page.getByLabel(/Exchange rate/)).toHaveValue("2");
	await expect(page.getByText("≈ $240.00 @ 2 USD")).toBeVisible();
});
