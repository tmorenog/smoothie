import { expect, test } from "@playwright/test";
import { createInitialState } from "../../lib/game/engine";
import { coins, seed } from "./helpers";

test.describe("desktop input", () => {
  test.skip(({ isMobile }) => isMobile, "desktop-only input tests");

  test("whole first order with the keyboard only", async ({ page }) => {
    await page.goto("/");
    const shop = page.getByRole("button", { name: /Shop/ });
    await shop.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Ingredient Shop" });
    await expect(dialog).toBeVisible();
    // Tab moves focus within the dialog
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await dialog.getByRole("button", { name: /Buy strawberry/ }).focus();
    await page.keyboard.press("Enter");
    await expect(coins(page)).toHaveText("0");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    const station = page.getByRole("button", { name: "Open station controls" });
    await station.focus();
    await page.keyboard.press("Enter");
    await page.getByTestId("inv-strawberry").focus();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("blender-status")).toContainText("Strawberry (1/4)");

    await page.getByRole("button", { name: /ON/ }).focus();
    await page.keyboard.press("Enter");
    const pour = page.getByRole("button", { name: "Pour" });
    await expect(pour).toBeEnabled({ timeout: 10_000 });
    await pour.focus();
    await page.keyboard.press("Enter");
    const serve = page.getByRole("button", { name: "Serve" });
    await expect(serve).toBeEnabled({ timeout: 10_000 });
    await serve.focus();
    await page.keyboard.press("Enter");
    await expect(coins(page)).toHaveText("12");
  });

  test("drag and drop an ingredient onto the blender", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Shop/ }).click();
    await page.getByRole("button", { name: /Buy strawberry/ }).click();
    await page.getByRole("button", { name: "Back to the counter" }).click();
    await page.getByRole("button", { name: "Open station controls" }).click();
    const chip = page.getByTestId("inv-strawberry");
    const zone = page.locator('[data-dropzone="blender"]');
    const a = (await chip.boundingBox())!;
    const b = (await zone.boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + 40, a.y + 40, { steps: 4 });
    await page.mouse.move(b.x + b.width / 2, b.y + 20, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId("blender-status")).toContainText("Strawberry (1/4)");
  });

  test("market lets you pick a quantity and shows a receipt", async ({ page }) => {
    const st = createInitialState();
    await seed(page, { ...st, coins: 30, tutorial: { dismissed: true, completed: true } });
    await page.goto("/");
    await page.getByRole("button", { name: /Shop/ }).click();
    const market = page.getByRole("dialog", { name: /Market/ });
    await expect(market.getByRole("heading", { name: "Whiskers' Market" })).toBeVisible();
    await market.getByRole("button", { name: "One more strawberry" }).click();
    await market.getByRole("button", { name: "One more strawberry" }).click();
    await market.getByRole("button", { name: "Buy 3 strawberries for 15 coins" }).click();
    await expect(page.getByTestId("shop-coins")).toHaveText(/15/);
    await expect(page.getByTestId("receipt")).toContainText("3 × Strawberry");
    await expect(market.getByTestId("shop-item-strawberry")).toContainText("In your pantry: 3");
    await market.getByRole("button", { name: "Close the market" }).click();
    await expect(market).toBeHidden();
    await page.getByRole("button", { name: "Open station controls" }).click();
    await expect(page.getByTestId("inv-strawberry")).toContainText("×3");
  });

  test("reset asks for confirmation", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Shop/ }).click();
    await page.getByRole("button", { name: /Buy strawberry/ }).click();
    await page.keyboard.press("Escape");
    await expect(coins(page)).toHaveText("0");
    await page.getByRole("button", { name: /Manage café/ }).click();
    await page.getByRole("tab", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Reset café…" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(coins(page)).toHaveText("0");
    await page.getByRole("button", { name: "Reset café…" }).click();
    await page.getByRole("button", { name: "Yes, start over" }).click();
    await expect(coins(page)).toHaveText("5");
  });

  test("avatar customization shows in the café and persists", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Your barista/ }).click();
    await page.getByRole("radio", { name: "Boy" }).click();
    const name = page.getByLabel("Name");
    await name.fill("Theo");
    await name.press("Enter");
    await page.getByRole("radio", { name: "Apron color #7f9f7a" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /Your barista Theo/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /Your barista Theo/ })).toBeVisible();
  });

  test("still playable without WebGL and with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?nowebgl");
    await expect(page.getByTestId("scene-2d")).toBeVisible();
    await page.getByRole("button", { name: /Shop/ }).click();
    await page.getByRole("button", { name: /Buy strawberry/ }).click();
    await page.getByRole("button", { name: "Back to the counter" }).click();
    await page.getByRole("button", { name: "Open station controls" }).click();
    await page.getByTestId("inv-strawberry").click();
    await page.getByRole("button", { name: /ON/ }).click();
    await page.getByRole("button", { name: "Pour" }).click({ timeout: 10_000 });
    await page.getByRole("button", { name: "Serve" }).click({ timeout: 10_000 });
    await expect(coins(page)).toHaveText("12");
  });
});

test("3D scene renders a WebGL canvas", async ({ page, isMobile }) => {
  test.skip(isMobile, "checked once on desktop");
  await page.goto("/");
  await expect(page.getByTestId("scene-3d").locator("canvas")).toBeVisible();
});
