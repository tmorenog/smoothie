import { expect, test } from "@playwright/test";

async function noHorizontalScroll(page: import("@playwright/test").Page) {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
}

test("portrait layout keeps primary buttons on screen", async ({ page }) => {
  await page.goto("/");
  await noHorizontalScroll(page);
  const vp = page.viewportSize()!;
  for (const name of [/Shop/, "Serve", "Welcome next customer"]) {
    const box = (await page.getByRole("button", { name }).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
    expect(box.height).toBeGreaterThanOrEqual(44); // comfortable touch target
  }
  await expect(page.getByTestId("order-card")).toBeVisible();
});

test("landscape layout puts the station drawer beside the café", async ({ page }) => {
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: Math.max(vp.width, vp.height), height: Math.min(vp.width, vp.height) });
  await page.goto("/");
  await noHorizontalScroll(page);
  await expect(page.getByRole("region", { name: "Café controls" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open station controls" }).click();
  const aside = (await page.getByRole("region", { name: "Café controls" }).boundingBox())!;
  const card = (await page.getByTestId("order-card").boundingBox())!;
  expect(aside.x).toBeGreaterThan(card.x);
  const shop = (await page.getByRole("button", { name: /Shop/ }).boundingBox())!;
  expect(shop.y + shop.height).toBeLessThanOrEqual(Math.min(vp.width, vp.height) + 1);
});
