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

  await Promise.all([
    page.waitForURL(/\/student\/record$/u),
    page.getByRole("link", { name: "Record", exact: true }).click(),
  ]);
  await expect(
    page.getByRole("heading", { name: "Academic record" }),
  ).toBeVisible();
  await expect(page.getByText("CS 1301")).toBeVisible();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/student\/progress$/u),
    page.getByRole("link", { name: "Progress", exact: true }).click(),
  ]);
  await expect(
    page.getByRole("heading", { name: "Degree progress" }),
  ).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/student\/shares$/u),
    page.getByRole("link", { name: "Shares", exact: true }).click(),
  ]);
  await expect(
    page.getByRole("heading", { name: "Verified shares" }),
  ).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/student\/settings$/u),
    page.getByRole("link", { name: "Settings" }).click(),
  ]);
  await expect(page.getByText("World verification")).toBeVisible();
  await expect(page.getByText("Not configured").first()).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/auth$/u);
});

test("student searches registration rows and reviews the hosted schedule", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "Registration desktop fidelity is covered in this journey.",
  );
  await signIn(page);

  await page.getByRole("link", { name: "Registration", exact: true }).click();
  await expect(page).toHaveURL(/\/student\/register$/u);
  await expect(
    page.getByRole("heading", { name: "Register for Classes" }),
  ).toBeVisible();
  await expect(page.getByText("Data Structures").first()).toBeVisible();
  await expect(
    page.getByText("Registered", { exact: true }).first(),
  ).toBeVisible();

  await page.getByLabel("Course search").fill("Calculus I");
  await expect(
    page.getByText("Calculus I", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "MATH 1314 Calculus I" }).click();
  await page.getByRole("button", { name: "Add MATH 1314" }).click();
  await expect(
    page.getByText("Selected credits").locator("xpath=.."),
  ).toContainText("3");
  await page.getByRole("button", { name: "Remove from plan" }).click();

  await page.getByRole("link", { name: "Schedule", exact: true }).click();
  await expect(page).toHaveURL(/\/student\/schedule$/u);
  await expect(
    page.getByRole("heading", { name: "My Schedule" }),
  ).toBeVisible();
  await expect(page.getByText("CS 2305", { exact: true })).toBeVisible();
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
  await Promise.all([
    page.waitForURL(/\/student\/progress$/u),
    page.getByRole("link", { name: "Progress", exact: true }).click(),
  ]);
  await expect(
    page.getByRole("heading", { name: "Degree progress" }),
  ).toBeVisible();
});
