import { expect, test } from "@playwright/test";

const registrarEmail =
  process.env.LOZZI_REGISTRAR_EMAIL ?? "jordan.registrar@lozzi.example";
const registrarPassword =
  process.env.LOZZI_REGISTRAR_PASSWORD ?? "Synthetic-Only-2026!";

const signIn = async (page: import("@playwright/test").Page) => {
  await page.goto("/auth");
  await page.getByLabel("University email").fill(registrarEmail);
  await page.getByLabel("Password", { exact: true }).fill(registrarPassword);
  await page.getByRole("button", { name: "Secure sign in" }).click();
  await expect(page).toHaveURL(/\/registrar$/u);
};

test("protected registrar route redirects to sign in", async ({ page }) => {
  await page.goto("/registrar");
  await expect(page).toHaveURL(/\/auth\?next=%2Fregistrar$/u);
});

test("registrar sees hosted rows and every navigation destination", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "Covered by the registrar mobile navigation test.",
  );
  await signIn(page);

  await expect(
    page.getByRole("heading", { name: "Registrar workspace" }),
  ).toBeVisible();
  await expect(page.getByText("Northstar University").first()).toBeVisible();
  await expect(page.getByText("Mateo Silva")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish record" }),
  ).toBeDisabled();

  for (const [link, heading] of [
    ["Students", "Students"],
    ["Catalog", "Catalog"],
    ["Terms", "Terms"],
    ["Sections", "Sections"],
    ["Records", "Publication queue"],
    ["Audit", "Institution audit"],
    ["Settings", "Settings"],
  ] as const) {
    await page.getByRole("link", { name: link, exact: true }).first().click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  await expect(page.getByText("Not configured").first()).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/auth$/u);
});

test("mobile registrar navigation reaches the catalog", async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith("mobile"),
    "Mobile-only registrar shell acceptance.",
  );
  await signIn(page);

  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Registrar navigation" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Catalog", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catalog" })).toBeVisible();
});
