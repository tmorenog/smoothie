import { expect, test } from "@playwright/test";
import { coins, openShopAndBuy, press, seed, stateAtLevel, SAVE_KEY } from "./helpers";
import { RECIPES } from "../../lib/game/data";

test("donuts unlock at level 5: fry, sprinkle and serve", async ({ page }, info) => {
  const s = stateAtLevel(5, { coins: 30 });
  s.currentOrder = { ...s.currentOrder!, customerId: "luna", recipeId: "donut" };
  await seed(page, s);
  await page.goto("/");
  await expect(page.getByRole("tab", { name: /Donuts/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("order-text")).toContainText("Sprinkle Donut");
  await openShopAndBuy(page, info, [/Buy donut dough/, /Buy pink sprinkles/]);
  await expect(coins(page)).toHaveText("22");
  await press(page.getByTestId("inv-donutDough"), info);
  await press(page.getByRole("button", { name: /Fry/ }), info);
  await expect(page.getByTestId("donut-status")).toContainText("Golden donut", { timeout: 10_000 });
  await press(page.getByTestId("inv-sprinkles"), info);
  await expect(page.getByTestId("donut-status")).toContainText("ready to serve");
  await press(page.getByRole("button", { name: "Serve" }), info);
  await expect(coins(page)).toHaveText(String(22 + RECIPES.donut.price));
});

test("coffee unlocks at level 10: buy beans, brew and serve", async ({ page }, info) => {
  const s = stateAtLevel(10, { coins: 30 });
  s.currentOrder = { ...s.currentOrder!, customerId: "dan", recipeId: "coffee" };
  await seed(page, s);
  await page.goto("/");
  await expect(page.getByTestId("level")).toHaveText("Lv 10");
  await expect(page.getByRole("tab", { name: /Coffee/ })).toHaveAttribute("aria-selected", "true");
  await openShopAndBuy(page, info, [/Buy coffee beans/]);
  await expect(coins(page)).toHaveText("22");
  await press(page.getByTestId("inv-coffeeBeans"), info);
  await expect(page.getByTestId("coffee-status")).toContainText("Beans loaded");
  await press(page.getByRole("button", { name: /Brew/ }), info);
  const serve = page.getByRole("button", { name: "Serve" });
  await expect(serve).toBeEnabled({ timeout: 10_000 });
  await press(serve, info);
  await expect(coins(page)).toHaveText(String(22 + RECIPES.coffee.price));
});

test("croissants unlock at level 15 and bake for one minute, surviving a reload", async ({ page }, info) => {
  // Fake clock that keeps flowing normally; fastForward() jumps ahead for the oven.
  await page.clock.install();
  const s = stateAtLevel(15, { coins: 40 });
  s.currentOrder = { ...s.currentOrder!, customerId: "biscuit", recipeId: "croissant" };
  await seed(page, s);
  // The 2D counter keeps this long, time-jumping test light on software GL.
  await page.goto("/?nowebgl");
  await page.clock.resume();
  await expect(page.getByRole("tab", { name: /Bakery/ })).toHaveAttribute("aria-selected", "true");
  await openShopAndBuy(page, info, [/Buy egg for 5 coins/, /Buy flour/, /Buy wheat/, /Buy butter/]);
  await expect(coins(page)).toHaveText(String(40 - 18));
  for (const id of ["egg", "flour", "wheat", "butter"]) await press(page.getByTestId(`inv-${id}`), info);
  await expect(page.getByTestId("bowl-status")).toContainText("Ready to whisk");
  await press(page.getByRole("button", { name: "Whisk" }), info);
  const toTray = page.getByRole("button", { name: "To tray" });
  await expect(toTray).toBeEnabled();
  await press(toTray, info);
  await press(page.getByRole("button", { name: /Bake/ }), info);
  await expect(page.getByTestId("oven-status")).toContainText(/(59|60)s left/);

  // Keep using the café while it bakes: shop and blend a smoothie.
  await openShopAndBuy(page, info, [/Buy strawberry/]);
  await press(page.getByRole("tab", { name: /Blender/ }), info);
  await press(page.getByTestId("inv-strawberry"), info);
  await expect(page.getByTestId("blender-status")).toContainText("Strawberry (1/4)");
  await press(page.getByRole("tab", { name: /Bakery/ }), info);
  await expect(page.getByTestId("oven-status")).toContainText("baking");
  await page.clock.fastForward(20_000);
  await expect(page.getByTestId("oven-status")).toContainText(/(3\d|40)s left/);

  // Reload mid-bake: the completion time is saved.
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).bakery.ovenEndsAt, SAVE_KEY);
  expect(typeof saved).toBe("number");
  await page.reload();
  await expect(page.getByTestId("oven-status")).toContainText(/(3\d|40)s left/);
  await page.clock.fastForward(41_000);
  await expect(page.getByTestId("oven-status")).toContainText("done");
  await press(page.getByRole("button", { name: "Take out" }), info);
  await expect(page.getByTestId("oven-status")).toContainText("Croissants: 2");
  const before = Number(await coins(page).textContent());
  await press(page.getByRole("button", { name: "Serve" }), info);
  await expect(coins(page)).toHaveText(String(before + RECIPES.croissant.price));
  await expect(page.getByTestId("oven-status")).toContainText("Croissants: 1");
});
