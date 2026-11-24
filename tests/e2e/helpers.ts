import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { createInitialState, xpForLevel, type GameState } from "../../lib/game/engine";
import { SAVE_KEY } from "../../lib/game/persistence";

export { SAVE_KEY };

/** Tap on touch projects, click elsewhere. */
export async function press(locator: Locator, info: TestInfo) {
  if (info.project.use.hasTouch) await locator.tap();
  else await locator.click();
}

/** Start the page with a prepared save in localStorage (only on the first load). */
export async function seed(page: Page, state: GameState) {
  await page.addInitScript(
    ([key, json]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(key, json);
        sessionStorage.setItem("seeded", "1");
      }
    },
    [SAVE_KEY, JSON.stringify(state)] as const,
  );
}

export function stateAtLevel(level: number, patch: Partial<GameState> = {}): GameState {
  const s = createInitialState();
  return { ...s, xp: xpForLevel(level), tutorial: { dismissed: false, completed: true }, settings: { sound: false }, ...patch };
}

export async function openShopAndBuy(page: Page, info: TestInfo, names: RegExp[]) {
  await press(page.getByRole("button", { name: /Shop/ }), info);
  const dialog = page.getByRole("dialog", { name: "Ingredient Shop" });
  await expect(dialog).toBeVisible();
  for (const n of names) await press(dialog.getByRole("button", { name: n }), info);
  await press(dialog.getByRole("button", { name: "Back to the counter" }), info);
  await expect(dialog).toBeHidden();
}

export const coins = (page: Page) => page.getByTestId("coins");

/** The station controls are hidden by default; open the drawer if it's closed. */
export async function openStation(page: Page, info: TestInfo) {
  await expect(page.getByTestId("coins")).toBeVisible(); // game loaded
  const open = page.getByRole("button", { name: "Open station controls" });
  if (await open.count()) await press(open, info);
  await expect(page.getByRole("region", { name: "Café controls" })).toBeVisible();
}
