import { expect, test } from "@playwright/test";

const uniqueEmail = () =>
  `user-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;

test("signup → login → dashboard → logout", async ({ page }) => {
  const email = uniqueEmail();
  const password = "correct-horse-battery";

  // Signup
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // Login
  await expect(
    page.getByRole("heading", { name: "Sign in" }),
  ).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Dashboard shows the signed-in user
  await expect(page.getByText(email)).toBeVisible();

  // Logout returns to login
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("dashboard redirects unauthenticated visitors to login", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
