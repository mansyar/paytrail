import { expect, test } from "@playwright/test";

test("renders the product landing", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "PayTrail" })).toBeVisible();
	await expect(page.getByText("Fast invoicing for freelancers.")).toBeVisible();
});
