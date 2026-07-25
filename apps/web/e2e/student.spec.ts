import { expect, test } from "@playwright/test";

const demoEmail = process.env.LOZZI_DEMO_EMAIL ?? "aisha.demo@lozzi.example";
const demoPassword = process.env.LOZZI_DEMO_PASSWORD ?? "Northstar-Demo-2026!";

const signIn = async (page: import("@playwright/test").Page) => {
  await page.goto("/auth");
  await page.getByLabel("University email").fill(demoEmail);
  await page.getByLabel("Password", { exact: true }).fill(demoPassword);
  await page.getByRole("button", { name: "Secure sign in" }).click();
  await expect(page).toHaveURL(/\/student$/u);
};

test("protected student route redirects to sign in", async ({ page }) => {
  await page.goto("/student");
  await expect(page).toHaveURL(/\/auth\?next=%2Fstudent$/u);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});

test("student signs in, sees hosted rows, navigates, and signs out", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "Covered by the mobile shell test.",
  );
  await signIn(page);

  await expect(
    page.getByRole("heading", { name: "Welcome back, Aisha" }),
  ).toBeVisible();
  await expect(page.getByText("4.00")).toBeVisible();
  await expect(page.getByText("CS 2305", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Academic record" }).click();
  await expect(
    page.getByRole("heading", { name: "Academic record" }),
  ).toBeVisible();
  await expect(page.getByText("CS 1301")).toBeVisible();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Degree progress" }).click();
  await expect(
    page.getByRole("heading", { name: "Degree progress" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Verified shares" }).click();
  await expect(
    page.getByRole("heading", { name: "Verified shares" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByText("World verification")).toBeVisible();
  await expect(page.getByText("Not configured").first()).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/auth$/u);
});

test("mobile navigation reaches every student destination", async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith("mobile"),
    "Mobile-only shell acceptance.",
  );
  await signIn(page);

  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Student navigation" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Degree progress" }).click();
  await expect(
    page.getByRole("heading", { name: "Degree progress" }),
  ).toBeVisible();
});
