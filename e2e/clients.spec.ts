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
}

async function openClientsPage(page: Page) {
	await page.getByRole("link", { name: "Clients" }).click();
	await expect(page).toHaveURL(/\/clients$/);
}

/**
 * Clicks the trigger and waits for the dialog. The page may not be
 * hydrated yet in dev mode — a click before hydration is a no-op, so
 * retry until the dialog actually appears.
 */
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

/** Clicks the client link and waits for navigation, retrying on hydration races. */
async function openClientDetail(page: Page, name: string) {
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

test("clients full CRUD: create → project rename/delete → edit → delete", async ({
	page,
}) => {
	const email = uniqueEmail();
	await signUp(page, email);
	await openClientsPage(page);

	// Empty state
	await expect(page.getByText("No clients yet")).toBeVisible();

	// Create client
	const createDialog = await openAddClientDialog(page);
	await createDialog.getByLabel("Name").fill("Sunset Villa");
	await createDialog.getByLabel("Email").fill("owner@sunsetvilla.com");
	await createDialog.getByLabel("Currency").click();
	await page.getByRole("option", { name: "EUR" }).click();
	await createDialog.getByRole("button", { name: "Add client" }).click();
	await expect(createDialog).toBeHidden();
	await expect(
		page.getByRole("link", { name: "Sunset Villa" }),
	).toBeVisible();
	await expect(page.getByText("EUR")).toBeVisible();

	// Client detail
	await openClientDetail(page, "Sunset Villa");
	await expect(
		page.getByRole("heading", { name: "Sunset Villa" }),
	).toBeVisible();
	await expect(page.getByText("owner@sunsetvilla.com")).toBeVisible();

	// Add project
	await page.getByRole("button", { name: "Add project" }).click();
	const projectDialog = page.getByRole("dialog");
	await projectDialog.getByLabel("Name").fill("Weekly Clean");
	await projectDialog.getByRole("button", { name: "Add project" }).click();
	await expect(projectDialog).toBeHidden();
	const projectRow = page.getByRole("listitem").filter({
		hasText: "Weekly Clean",
	});
	await expect(projectRow).toBeVisible();

	// Duplicate project name is rejected inline
	await page.getByRole("button", { name: "Add project" }).click();
	const duplicateDialog = page.getByRole("dialog");
	await duplicateDialog.getByLabel("Name").fill("Weekly Clean");
	await duplicateDialog.getByRole("button", { name: "Add project" }).click();
	await expect(
		duplicateDialog.getByText(/already exists/i),
	).toBeVisible();
	await duplicateDialog.getByRole("button", { name: "Cancel" }).click();

	// Rename project
	await projectRow.getByRole("button", { name: "Rename" }).click();
	const renameDialog = page.getByRole("dialog");
	await renameDialog.getByLabel("Name").fill("Deep Clean");
	await renameDialog.getByRole("button", { name: "Save" }).click();
	await expect(renameDialog).toBeHidden();
	await expect(
		page.getByRole("listitem").filter({ hasText: "Deep Clean" }),
	).toBeVisible();

	// Delete project (with confirm step)
	await page
		.getByRole("listitem")
		.filter({ hasText: "Deep Clean" })
		.getByRole("button", { name: "Delete" })
		.click();
	await expect(page.getByText(/This cannot be undone/)).toBeVisible();
	await page.getByRole("button", { name: "Delete" }).last().click();
	await expect(
		page.getByRole("listitem").filter({ hasText: "Deep Clean" }),
	).toBeHidden();

	// Edit client (full fields on detail page)
	await page.getByRole("button", { name: "Edit" }).click();
	const editDialog = page.getByRole("dialog");
	await editDialog.getByLabel("Name").fill("Sunset Villa LTD");
	await editDialog.getByRole("button", { name: "Save changes" }).click();
	await expect(editDialog).toBeHidden();
	await expect(
		page.getByRole("heading", { name: "Sunset Villa LTD" }),
	).toBeVisible();

	// Delete client redirects back to the list
	await page.getByRole("button", { name: "Delete" }).click();
	await expect(page).toHaveURL(/\/clients$/);
	await expect(
		page.getByRole("link", { name: "Sunset Villa LTD" }),
	).toBeHidden();
	await expect(page.getByText("No clients yet")).toBeVisible();
});

test("clients search filters by name", async ({ page }) => {
	const email = uniqueEmail();
	await signUp(page, email);
	await openClientsPage(page);

	for (const name of ["Sunset Villa", "Zephyr Estates"]) {
		const dialog = await openAddClientDialog(page);
		await dialog.getByLabel("Name").fill(name);
		await dialog.getByRole("button", { name: "Add client" }).click();
		await expect(dialog).toBeHidden();
	}

	const search = page.getByLabel("Search clients");
	await search.fill("sunset");
	await expect(page).toHaveURL(/\/clients\?q=sunset$/, { timeout: 10_000 });
	await expect(
		page.getByRole("link", { name: "Sunset Villa" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Zephyr Estates" }),
	).toBeHidden();

	await search.fill("");
	await expect(page).toHaveURL(/\/clients$/, { timeout: 10_000 });
	await expect(
		page.getByRole("link", { name: "Zephyr Estates" }),
	).toBeVisible();
});
