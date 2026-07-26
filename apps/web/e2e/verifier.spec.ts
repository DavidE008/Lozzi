import { expect, test } from "@playwright/test";

test("public verifier reveals only the token's authorized local disclosure", async ({
  page,
}) => {
  await page.goto("/verify");
  await expect(
    page.getByRole("heading", { name: "Verify only what was shared" }),
  ).toBeVisible();

  await page.getByLabel("Share token").fill("lozzi-valid-demo-token");
  await page.getByRole("button", { name: "Verify private share" }).click();

  await expect(
    page.getByRole("heading", { name: "Northstar University" }),
  ).toBeVisible();
  await expect(page.getByText("Locally verified disclosure")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Programme" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Degree progress" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Full record" }),
  ).not.toBeVisible();
  await expect(page.getByLabel("Share token")).toHaveValue("");
  await expect(page).toHaveURL(/\/verify$/u);
});

test("fragment token is removed before an invalid result is rendered", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "Fragment handling is viewport-independent.",
  );
  await page.goto("/verify#token=lozzi-invalid-demo-token");

  await expect(
    page.getByRole("heading", { name: "Share not found" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/verify$/u);
  await expect(page.locator("body")).not.toContainText(
    "lozzi-invalid-demo-token",
  );
});
