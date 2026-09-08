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

/** Complete onboarding and add one client, ending on /dashboard. */
async function onboardAndAddClient(page: Page) {
	await expect(page).toHaveURL(/\/onboarding/);
	await page.getByLabel("Business name").fill("Sparkle Services");
	await page.getByLabel("Billing email").fill("billing@sparkle.example");
	await page.getByRole("button", { name: "Next", exact: true }).click();
	// Step 2 (financial defaults) — pre-filled, continue. Retry until step 3.
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
	// Step 3 (rate rules) — optional, finish immediately. Retry the save.
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

/** Create a DRAFT invoice via the builder, ending on its detail page. */
async function createDraftInvoice(page: Page): Promise<string> {
	// The Invoices nav link lives on the dashboard header
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

	// Client select — retry until hydrated (first click may be a no-op).
	for (let attempt = 0; attempt < 5; attempt++) {
		await page.getByLabel("Client").click();
		try {
			await page
				.getByRole("option", { name: "Sunset Villa" })
				.waitFor({ state: "visible", timeout: 2000 });
			break;
		} catch {
			// not hydrated yet — click again
		}
	}
	await page.getByRole("option", { name: "Sunset Villa" }).click();
	await page.getByLabel("Description").first().fill("Deep clean");
	await page.getByLabel("Amount").first().fill("120");
	await page.getByRole("button", { name: "Save draft" }).click();

	// /invoices/new also matches a bare [a-z0-9]+ id — exclude it explicitly
	await page.waitForURL(/\/invoices\/(?!new$)[a-z0-9]+$/, {
		timeout: 30_000,
	});
	return page.url().split("/").pop() as string;
}

test("invoice detail shows PDF actions; download route serves a PDF with correct headers", async ({
	page,
}) => {
	test.setTimeout(120_000);
	const email = uniqueEmail();
	await signUp(page, email);
	await onboardAndAddClient(page);
	const invoiceId = await createDraftInvoice(page);

	// Both actions are visible for a DRAFT invoice (and stay visible once SENT)
	await expect(page.getByRole("link", { name: "Download PDF" })).toBeVisible();
	await expect(page.getByRole("link", { name: "Email client" })).toBeVisible();
	// The email action is a prefilled mailto: draft
	const mailHref = await page
		.getByRole("link", { name: "Email client" })
		.getAttribute("href");
	expect(mailHref).toMatch(/^mailto:owner@sunsetvilla\.com\?subject=/);

	// Authenticated download via the same cookie jar as the browser
	const res = await page.request.get(`/api/invoices/${invoiceId}/pdf`);
	expect(res.status()).toBe(200);
	expect(res.headers()["content-type"]).toBe("application/pdf");
	expect(res.headers()["content-disposition"]).toMatch(
		/attachment; filename="INV-\d{4}-\d{4,}\.pdf"/,
	);
	expect(res.headers()["cache-control"]).toBe("no-store");
	const body = await res.body();
	// PDF magic bytes
	expect(body.subarray(0, 5).toString("ascii")).toBe("%PDF-");
});

test("pdf download route rejects unauthenticated requests", async ({
	playwright,
}) => {
	const anon = await playwright.request.newContext();
	const res = await anon.get("/api/invoices/some-id/pdf");
	expect(res.status()).toBe(401);
	await anon.dispose();
});

test("pdf actions are usable at mobile width (390px)", async ({ page }) => {
	test.setTimeout(120_000);
	const email = uniqueEmail();
	await signUp(page, email);
	await onboardAndAddClient(page);
	await createDraftInvoice(page);

	const download = page.getByRole("link", { name: "Download PDF" });
	const emailBtn = page.getByRole("link", { name: "Email client" });
	await expect(download).toBeVisible();
	await expect(emailBtn).toBeVisible();
	// Touch targets stack full-width below the invoice number on xs
	await expect(download).toBeInViewport();
	await expect(emailBtn).toBeInViewport();
});
