import { expect, test } from "@playwright/test";
import { coins, openShopAndBuy, openStation, press } from "./helpers";

test("plays the entire first order, then keeps playing after a reload", async ({ page }, info) => {
  await page.goto("/");
  await expect(coins(page)).toHaveText("5");
  // The market stays hidden until the Shop button is pressed.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("shop-item-strawberry")).toHaveCount(0);
  await expect(page.getByTestId("customer-name")).toHaveText("Mochi");
  await expect(page.getByTestId("order-text")).toContainText("Strawberry Smoothie");

  // Tutorial points at the shop first
  const tutorial = page.getByTestId("tutorial");
  await expect(tutorial).toContainText("Open the Shop");
  await expect(page.locator('[data-tutorial="shop"]')).toHaveClass(/tutorial-glow/);

  // The station menu stays hidden until asked for.
  await expect(page.getByRole("region", { name: "Café controls" })).toHaveCount(0);
  await openShopAndBuy(page, info, [/Buy strawberry for 5 coins/]);
  await expect(coins(page)).toHaveText("0");
  const stationBtn = page.getByRole("button", { name: "Open station controls" });
  await expect(stationBtn).toHaveClass(/tutorial-glow/);
  await openStation(page, info);
  const chip = page.getByTestId("inv-strawberry");
  await expect(chip).toContainText("×1");
  await expect(chip).toHaveClass(/tutorial-glow/);

  await press(chip, info);
  await expect(page.getByTestId("blender-status")).toContainText("Strawberry (1/4)");
  await expect(page.getByTestId("inv-strawberry")).toHaveCount(0);

  const on = page.getByRole("button", { name: /ON/ });
  await expect(on).toHaveClass(/tutorial-glow/);
  await press(on, info);
  await expect(page.getByTestId("blender-status")).toContainText("Blending");
  await expect(on).toBeDisabled(); // no double-starts during the animation

  const pour = page.getByRole("button", { name: "Pour" });
  await expect(pour).toBeEnabled({ timeout: 10_000 });
  await expect(page.getByTestId("blender-status")).toContainText("Strawberry Smoothie ready");
  await press(pour, info);

  const serve = page.getByRole("button", { name: "Serve" });
  await expect(serve).toBeEnabled({ timeout: 10_000 });
  await expect(page.getByTestId("cup-status")).toContainText("Strawberry Smoothie");
  await press(serve, info);

  await expect(coins(page)).toHaveText("12");
  await expect(page.getByTestId("order-text")).toContainText("Paid 12");
  await expect(serve).toBeDisabled();
  await expect(tutorial).toBeHidden();

  // Reload: progress persists and play continues.
  await page.reload();
  await expect(coins(page)).toHaveText("12");
  await expect(page.getByTestId("order-text")).toContainText("Paid 12");
  const next = page.getByRole("button", { name: "Welcome next customer" });
  await expect(next).toBeEnabled();
  await press(next, info);
  await expect(page.getByTestId("customer-name")).not.toHaveText("Mochi");
  await expect(page.getByTestId("order-text")).toContainText("Orders");
  await expect(next).toBeDisabled();

  // The next order is affordable: buy strawberries and serve again.
  await openShopAndBuy(page, info, [/Buy strawberry/]);
  await expect(coins(page)).toHaveText("7");
});

test("tutorial can be skipped and reopened from help", async ({ page }, info) => {
  await page.goto("/");
  await press(page.getByRole("button", { name: "Skip tutorial" }), info);
  await expect(page.getByTestId("tutorial")).toBeHidden();
  await page.reload();
  await expect(page.getByTestId("tutorial")).toBeHidden();
  await press(page.getByRole("button", { name: "How to play" }), info);
  await press(page.getByRole("button", { name: "Show tutorial tips again" }), info);
  await expect(page.getByTestId("tutorial")).toContainText("Open the Shop");
});

test("wrong ingredient can be taken back out", async ({ page }, info) => {
  await page.goto("/");
  await openShopAndBuy(page, info, [/Buy strawberry/]);
  await openStation(page, info);
  await press(page.getByTestId("inv-strawberry"), info);
  await press(page.getByRole("button", { name: "Take fruit out" }), info);
  await expect(page.getByTestId("inv-strawberry")).toContainText("×1");
  await expect(page.getByTestId("blender-status")).toContainText("empty");
});
