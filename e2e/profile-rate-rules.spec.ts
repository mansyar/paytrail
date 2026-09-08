import { expect, test } from "@playwright/test";
import { signUpToProfile, uniqueEmail } from "./utils";

const CURRENCY = "USD"; // onboarding step 2 default

test("rate rules lifecycle: add, duplicate rejected, edit, reorder, delete", async ({
	page,
}) => {
	const email = uniqueEmail("rate");
	await signUpToProfile(page, email);

	const keywords = () => page.getByLabel("Keyword");
	const rates = () => page.getByLabel("Rate", { exact: true });
	await expect(keywords()).toHaveCount(0);

	// Add rule 1 and save on blur.
	await page.getByRole("button", { name: "Add rate rule" }).click();
	await expect(keywords()).toHaveCount(1);
	await expect(rates()).toHaveCount(1);
	// The rate field shows the home currency as an adornment.
	await expect(
		page.locator(".MuiInputAdornment-root").filter({ hasText: CURRENCY }),
	).toBeVisible();
	await keywords().nth(0).fill("standard clean");
	await rates().nth(0).fill("45.50");
	// Blur the LAST-filled field: blurring an earlier field fires its save
	// before the later field's state has flushed. Pacing lets the async
	// server action settle before the next interaction.
	await rates().nth(0).blur();

	// Add rule 2; a case-insensitive duplicate keyword is rejected inline.
	await page.getByRole("button", { name: "Add rate rule" }).click();
	await expect(keywords()).toHaveCount(2);
	await keywords().nth(1).fill("STANDARD CLEAN");
	await rates().nth(1).fill("20");
	await rates().nth(1).blur();
	await expect(
		page.getByText("A rate rule with this keyword already exists."),
	).toBeVisible();

	// Fixing the keyword clears the error on the next save.
	await keywords().nth(1).fill("linen change");
	await rates().nth(1).fill("7.50");
	await rates().nth(1).blur();
	await expect(
		page.getByText("A rate rule with this keyword already exists."),
	).toBeHidden();

	// Reorder: "linen change" moves to the top.
	await page.getByRole("button", { name: "Move rule 2 up" }).click();
	await expect(keywords().nth(0)).toHaveValue("linen change");
	await expect(keywords().nth(1)).toHaveValue("standard clean");

	// Delete with Cancel aborts.
	await page.getByRole("button", { name: "Delete rule 1" }).click();
	await page.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(keywords()).toHaveCount(2);

	// Delete with confirm removes the row.
	await page.getByRole("button", { name: "Delete rule 1" }).click();
	await page.getByRole("button", { name: "Delete", exact: true }).click();
	await expect(keywords()).toHaveCount(1);
	await expect(keywords().nth(0)).toHaveValue("standard clean");

	// The surviving rule persisted server-side with its rate.
	await page.reload();
	await expect(keywords().nth(0)).toHaveValue("standard clean");
	await expect(rates().nth(0)).toHaveValue("45.50");
});

test("delete confirmation auto-cancels after the timeout", async ({ page }) => {
	const email = uniqueEmail("rate");
	await signUpToProfile(page, email);

	await page.getByRole("button", { name: "Add rate rule" }).click();
	await expect(page.getByLabel("Keyword")).toHaveCount(1);

	// First click arms the confirm state…
	await page.getByRole("button", { name: "Delete rule 1" }).click();
	await expect(
		page.getByRole("button", { name: "Cancel", exact: true }),
	).toBeVisible();

	// …and it reverts to the trash icon after ~4s without a decision.
	await expect(
		page.getByRole("button", { name: "Cancel", exact: true }),
	).toBeHidden({ timeout: 6000 });
	await expect(
		page.getByRole("button", { name: "Delete rule 1" }),
	).toBeVisible();
	await expect(page.getByLabel("Keyword")).toHaveCount(1);
});
