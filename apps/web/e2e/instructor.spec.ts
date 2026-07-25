import { expect, test } from "@playwright/test";

const instructorEmail =
  process.env.LOZZI_INSTRUCTOR_EMAIL ?? "elena.instructor@lozzi.example";
const instructorPassword =
  process.env.LOZZI_INSTRUCTOR_PASSWORD ?? "Synthetic-Only-2026!";

const signIn = async (page: import("@playwright/test").Page) => {
  await page.goto("/auth");
  await page.getByLabel("University email").fill(instructorEmail);
  await page.getByLabel("Password", { exact: true }).fill(instructorPassword);
  await page.getByRole("button", { name: "Secure sign in" }).click();
  await expect(page).toHaveURL(/\/instructor$/u);
};

test("protected instructor route redirects to sign in", async ({ page }) => {
  await page.goto("/instructor");
  await expect(page).toHaveURL(/\/auth\?next=%2Finstructor$/u);
});

test("assigned instructor reviews the hosted gradebook", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "Covered by the mobile instructor shell test.",
  );
  await signIn(page);

  await expect(
    page.getByRole("heading", { name: "Assigned sections" }),
  ).toBeVisible();
  await page.getByText("CS 2305 · Data Structures").click();
  await expect(page).toHaveURL(
    /\/instructor\/sections\/60000000-0000-4000-8000-000000000001\/grades$/u,
  );
  await expect(
    page.getByRole("heading", { name: "CS 2305 · Data Structures" }),
  ).toBeVisible();
  await expect(page.getByText("Aisha Rahman")).toBeVisible();
  await expect(
    page.getByRole("spinbutton", {
      name: "Aisha Rahman participation score out of 10",
    }),
  ).toHaveValue("9");
  await expect(
    page.getByRole("row", { name: /Aisha Rahman/u }).getByText("B+"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft" })).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Submit grades" }),
  ).toBeEnabled();
});

test("mobile instructor navigation reaches settings", async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith("mobile"),
    "Mobile-only instructor shell acceptance.",
  );
  await signIn(page);

  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Instructor navigation" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});
