import { describe, expect, it } from "vitest";
import { DURATIONS, INGREDIENTS, RECIPES, RECIPE_IDS } from "@/lib/game/data";
import {
  applyAction,
  canRescue,
  createInitialState,
  generateOrder,
  getLevel,
  isIngredientUnlocked,
  isRecipeUnlocked,
  isStationUnlocked,
  isVip,
  missingCost,
  mixColor,
  mixFlavor,
  ovenRemainingMs,
  smoothieFor,
  tutorialStep,
  xpForLevel,
  type Action,
  type GameState,
} from "@/lib/game/engine";
import { deserialize, loadGame, saveGame, serialize, SAVE_KEY } from "@/lib/game/persistence";

const T0 = 1_700_000_000_000;

/** Apply actions, asserting each one succeeds. */
function run(state: GameState, ...actions: Action[]): GameState {
  for (const a of actions) {
    const r = applyAction(state, a);
    expect(r.ok, `${a.type} failed: ${r.message}`).toBe(true);
    state = r.state;
  }
  return state;
}

/** Make and serve a strawberry smoothie for the current order. */
function serveStrawberry(state: GameState, now = T0): GameState {
  return run(
    state,
    { type: "buy", ingredient: "strawberry" },
    { type: "add", ingredient: "strawberry" },
    { type: "blenderOn", now },
    { type: "tick", now: now + DURATIONS.blend },
    { type: "pour", now: now + DURATIONS.blend },
    { type: "tick", now: now + DURATIONS.blend + DURATIONS.pour },
    { type: "serve", now: now + 10_000 },
  );
}

function withLevel(level: number, extra: Partial<GameState> = {}): GameState {
  return { ...createInitialState(), xp: xpForLevel(level), ...extra };
}

describe("new café", () => {
  it("starts with exactly 5 coins, an empty inventory and Mochi ordering strawberry", () => {
    const s = createInitialState();
    expect(s.coins).toBe(5);
    expect(Object.values(s.inventory).every((n) => n === 0)).toBe(true);
    expect(s.currentOrder).toMatchObject({ customerId: "mochi", recipeId: "strawberrySmoothie", status: "waiting" });
    expect(getLevel(s)).toBe(1);
    expect(tutorialStep(s)).toBe("shop");
  });

  it("prices strawberries at 5, bananas at 15 and eggs at 5", () => {
    expect(INGREDIENTS.strawberry.price).toBe(5);
    expect(INGREDIENTS.banana.price).toBe(15);
    expect(INGREDIENTS.egg.price).toBe(5);
  });
});

describe("shop and inventory", () => {
  it("buying strawberries spends 5 coins and adds to inventory", () => {
    const s = run(createInitialState(), { type: "buy", ingredient: "strawberry" });
    expect(s.coins).toBe(0);
    expect(s.inventory.strawberry).toBe(1);
    expect(tutorialStep(s)).toBe("inventory");
  });

  it("rejects purchases the player cannot afford without changing state", () => {
    const s = run(createInitialState(), { type: "buy", ingredient: "strawberry" });
    const r = applyAction(s, { type: "buy", ingredient: "strawberry" });
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s);
    expect(r.state.coins).toBe(0);
  });

  it("rejects locked ingredients", () => {
    const s = { ...createInitialState(), coins: 999 };
    expect(applyAction(s, { type: "buy", ingredient: "banana" }).ok).toBe(false);
    expect(applyAction(s, { type: "buy", ingredient: "coffeeBeans" }).ok).toBe(false);
    expect(applyAction(s, { type: "buy", ingredient: "egg" }).ok).toBe(false);
  });

  it("adding moves an item from inventory into the blender and never goes negative", () => {
    let s = run(createInitialState(), { type: "buy", ingredient: "strawberry" }, { type: "add", ingredient: "strawberry" });
    expect(s.inventory.strawberry).toBe(0);
    expect(s.blender.contents).toEqual(["strawberry"]);
    const r = applyAction(s, { type: "add", ingredient: "strawberry" });
    expect(r.ok).toBe(false);
    expect(r.state.inventory.strawberry).toBe(0);
    // Taking fruit back out returns it to inventory.
    s = run(s, { type: "emptyBlender" });
    expect(s.inventory.strawberry).toBe(1);
    expect(s.blender.contents).toEqual([]);
  });

  it("keeps baking and coffee ingredients out of the blender", () => {
    let s = withLevel(15, { coins: 100 });
    s = run(s, { type: "buy", ingredient: "egg" }, { type: "buy", ingredient: "coffeeBeans" });
    s = run(s, { type: "add", ingredient: "egg" }, { type: "add", ingredient: "coffeeBeans" });
    expect(s.blender.contents).toEqual([]);
    expect(s.bakery.bowl).toEqual(["egg"]);
    expect(s.coffee.beans).toBe(1);
  });
});

describe("colour and flavour mixing", () => {
  it("strawberry is light pink, banana creamy yellow, both peachy orange", () => {
    expect(mixColor(["strawberry"])).toBe("#f7b6c8");
    expect(mixColor(["banana"])).toBe("#f6e4a6");
    expect(mixColor(["strawberry", "banana"])).toBe("#f7a66e");
    expect(mixColor(["banana", "strawberry", "strawberry"])).toBe("#f7a66e");
  });

  it("maps contents to smoothies and flavours", () => {
    expect(smoothieFor(["strawberry"])).toBe("strawberrySmoothie");
    expect(smoothieFor(["banana", "banana"])).toBe("bananaSmoothie");
    expect(smoothieFor(["strawberry", "banana"])).toBe("sunriseSmoothie");
    expect(smoothieFor([])).toBeNull();
    expect(mixFlavor(["strawberry", "banana"])).toContain("peachy");
  });

  it("peachy orange is redder than banana and yellower than strawberry", () => {
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [, gPeach, bPeach] = rgb(mixColor(["strawberry", "banana"]));
    const [, gBanana] = rgb(mixColor(["banana"]));
    const [, , bPink] = rgb(mixColor(["strawberry"]));
    expect(gPeach).toBeLessThan(gBanana);
    expect(bPeach).toBeLessThan(bPink);
  });
});

describe("blender, pour and serve", () => {
  it("completes the full first order and pays exactly once", () => {
    let s = createInitialState();
    s = run(s, { type: "buy", ingredient: "strawberry" }, { type: "add", ingredient: "strawberry" });
    expect(tutorialStep(s)).toBe("on");
    s = run(s, { type: "blenderOn", now: T0 });
    expect(s.blender.phase).toBe("blending");
    expect(tutorialStep(s)).toBe("blending");

    // Repeated presses during the animation are rejected.
    expect(applyAction(s, { type: "blenderOn", now: T0 + 100 }).ok).toBe(false);
    expect(applyAction(s, { type: "pour", now: T0 + 100 }).ok).toBe(false);

    s = run(s, { type: "tick", now: T0 + DURATIONS.blend });
    expect(s.blender.phase).toBe("blended");
    expect(s.blender.result).toBe("strawberrySmoothie");
    expect(tutorialStep(s)).toBe("pour");

    s = run(s, { type: "pour", now: T0 + 3000 });
    expect(applyAction(s, { type: "pour", now: T0 + 3100 }).ok).toBe(false);
    expect(applyAction(s, { type: "serve", now: T0 + 3100 }).ok).toBe(false);
    s = run(s, { type: "tick", now: T0 + 3000 + DURATIONS.pour });
    expect(s.cup).toBe("strawberrySmoothie");
    expect(tutorialStep(s)).toBe("serve");

    const served = applyAction(s, { type: "serve", now: T0 + 6000 });
    expect(served.ok).toBe(true);
    s = served.state;
    expect(s.coins).toBe(RECIPES.strawberrySmoothie.price);
    expect(s.currentOrder?.status).toBe("served");
    expect(s.visits.mochi).toBe(1);
    expect(s.tutorial.completed).toBe(true);
    expect(served.events.filter((e) => e.kind === "served")).toHaveLength(1);

    // Serving again does nothing.
    const again = applyAction(s, { type: "serve", now: T0 + 7000 });
    expect(again.ok).toBe(false);
    expect(again.state.coins).toBe(s.coins);
    expect(again.state.visits.mochi).toBe(1);
  });

  it("refuses the wrong drink and lets the player recover", () => {
    let s = { ...withLevel(2), coins: 20 };
    s = run(s, { type: "buy", ingredient: "banana" }, { type: "add", ingredient: "banana" }, { type: "blenderOn", now: T0 }, { type: "tick", now: T0 + 5000 }, { type: "pour", now: T0 + 5000 }, { type: "tick", now: T0 + 9000 });
    expect(s.cup).toBe("bananaSmoothie");
    const r = applyAction(s, { type: "serve", now: T0 + 9000 });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Toss/);
    expect(r.state.cup).toBe("bananaSmoothie");
    s = run(s, { type: "tossCup" });
    expect(s.cup).toBeNull();
    // Still has 5 coins for a strawberry.
    s = serveStrawberry(s);
    expect(s.currentOrder?.status).toBe("served");
  });

  it("offers the tip jar when the player is stuck, covering only the shortfall", () => {
    let s = createInitialState();
    expect(canRescue(s)).toBe(false);
    s = run(s, { type: "buy", ingredient: "strawberry" }, { type: "add", ingredient: "strawberry" }, { type: "blenderOn", now: T0 }, { type: "tick", now: T0 + 5000 }, { type: "emptyBlender" });
    expect(s.coins).toBe(0);
    expect(canRescue(s)).toBe(true);
    const r = applyAction(s, { type: "rescue" });
    expect(r.ok).toBe(true);
    expect(r.state.coins).toBe(5);
    expect(canRescue(r.state)).toBe(false);
    expect(applyAction(r.state, { type: "rescue" }).ok).toBe(false);
  });

  it("does not allow a second order while one is waiting", () => {
    const s = createInitialState();
    expect(applyAction(s, { type: "nextCustomer", rand: [0.1] }).ok).toBe(false);
  });

  it("welcomes a new, different customer with a unique id after serving", () => {
    const s = serveStrawberry(createInitialState());
    const n = run(s, { type: "nextCustomer", rand: [0.5, 0.9, 0.1, 0.2, 0.9] });
    expect(n.currentOrder?.id).toBe(2);
    expect(n.currentOrder?.status).toBe("waiting");
    expect(n.currentOrder?.customerId).not.toBe("mochi");
    expect(applyAction(n, { type: "nextCustomer", rand: [0.1] }).ok).toBe(false);
  });
});

describe("orders and prices work together", () => {
  it("every recipe is profitable", () => {
    for (const id of RECIPE_IDS) {
      const r = RECIPES[id];
      const cost = Object.entries(r.ingredients).reduce((sum, [ing, n]) => sum + INGREDIENTS[ing as keyof typeof INGREDIENTS].price * (n as number), 0);
      expect(r.price * r.batch, id).toBeGreaterThan(cost);
    }
  });

  it("only orders things the player can afford", () => {
    for (let i = 0; i < 200; i++) {
      const coins = i % 40;
      const s = { ...withLevel(1 + (i % 16)), coins, currentOrder: null };
      const order = generateOrder(s, [Math.random(), Math.random(), Math.random(), Math.random()]);
      expect(isRecipeUnlocked(s, order.recipeId)).toBe(true);
      if (coins >= 5) expect(missingCost(s, order.recipeId)).toBeLessThanOrEqual(coins);
    }
  });

  it("uses a named special and shows its name on the order", () => {
    let s = serveStrawberry(createInitialState());
    s = run(s, { type: "addSpecial", name: "Pink Purrfection", recipeId: "strawberrySmoothie" });
    expect(applyAction(s, { type: "addSpecial", name: "Coffee", recipeId: "coffee" }).ok).toBe(false);
    s = run(s, { type: "nextCustomer", rand: [0.3, 0.1, 0.0, 0.5, 0.9] });
    expect(s.currentOrder?.specialName).toBe("Pink Purrfection");
    expect(s.currentOrder?.recipeId).toBe("strawberrySmoothie");
  });
});

describe("VIP visits and staff", () => {
  it("customers become VIP after 5 visits and tip extra", () => {
    let s = createInitialState();
    let lastPaid = 0;
    for (let i = 0; i < 5; i++) {
      s = { ...s, currentOrder: { id: s.nextOrderId, customerId: "mochi", recipeId: "strawberrySmoothie", specialId: null, specialName: null, status: "waiting", paid: null, tip: null }, nextOrderId: s.nextOrderId + 1 };
      s = serveStrawberry(s, T0 + i * 100_000);
      lastPaid = s.currentOrder!.paid!;
    }
    expect(s.visits.mochi).toBe(5);
    expect(isVip(s, "mochi")).toBe(true);
    expect(lastPaid).toBe(RECIPES.strawberrySmoothie.price + 1); // regular tip on visit 5
    s = { ...s, currentOrder: { id: s.nextOrderId, customerId: "mochi", recipeId: "strawberrySmoothie", specialId: null, specialName: null, status: "waiting", paid: null, tip: null } };
    s = serveStrawberry(s, T0 + 900_000);
    expect(s.currentOrder!.tip).toBeGreaterThanOrEqual(3);
  });

  it("hiring staff costs coins and adds a service bonus", () => {
    let s = withLevel(3, { coins: 45 });
    expect(applyAction(s, { type: "hire", staffId: "bean" }).ok).toBe(false); // level 5
    s = run(s, { type: "hire", staffId: "hazel" });
    expect(s.coins).toBe(5);
    expect(applyAction(s, { type: "hire", staffId: "hazel" }).ok).toBe(false);
    s = serveStrawberry(s);
    expect(s.currentOrder!.paid).toBe(RECIPES.strawberrySmoothie.price + 1);
  });
});

describe("robber event", () => {
  it("blocks serving until the till is secured and takes nothing", () => {
    let s: GameState = { ...serveStrawberry(createInitialState()), servedCount: 6, coins: 50 };
    s = run(s, { type: "nextCustomer", rand: [0.5, 0.9, 0.5, 0.5, 0.05] });
    expect(s.robber.active).toBe(true);
    expect(s.coins).toBe(50);
    expect(applyAction(s, { type: "serve", now: T0 }).message).toMatch(/till/);
    s = run(s, { type: "secureTill" });
    expect(s.robber.active).toBe(false);
    expect(s.coins).toBe(50);
    expect(applyAction(s, { type: "secureTill" }).ok).toBe(false);
  });
});

describe("level unlocks", () => {
  it("unlocks coffee at level 10 and the bakery at level 15", () => {
    expect(isStationUnlocked(withLevel(9), "coffee")).toBe(false);
    expect(isStationUnlocked(withLevel(10), "coffee")).toBe(true);
    expect(isIngredientUnlocked(withLevel(10), "coffeeBeans")).toBe(true);
    expect(isStationUnlocked(withLevel(14), "bakery")).toBe(false);
    expect(isStationUnlocked(withLevel(15), "bakery")).toBe(true);
    for (const id of ["egg", "flour", "wheat", "butter"] as const) expect(isIngredientUnlocked(withLevel(15), id)).toBe(true);
  });

  it("emits a level-up event when serving crosses a threshold", () => {
    const s = { ...createInitialState(), xp: xpForLevel(2) - 1 };
    const r = applyAction(run(s, { type: "buy", ingredient: "strawberry" }, { type: "add", ingredient: "strawberry" }, { type: "blenderOn", now: T0 }, { type: "tick", now: T0 + 3000 }, { type: "pour", now: T0 + 3000 }, { type: "tick", now: T0 + 6000 }), { type: "serve", now: T0 + 6000 });
    expect(r.events).toContainEqual({ kind: "levelUp", level: 2 });
  });

  it("brews and serves coffee at level 10", () => {
    let s = withLevel(10, { coins: 20 });
    s = { ...s, currentOrder: { ...s.currentOrder!, customerId: "dan", recipeId: "coffee" } };
    expect(applyAction(s, { type: "brew", now: T0 }).ok).toBe(false);
    s = run(s, { type: "buy", ingredient: "coffeeBeans" }, { type: "add", ingredient: "coffeeBeans" }, { type: "brew", now: T0 });
    expect(applyAction(s, { type: "serve", now: T0 + 100 }).ok).toBe(false);
    s = run(s, { type: "tick", now: T0 + DURATIONS.brew }, { type: "serve", now: T0 + DURATIONS.brew });
    expect(s.coins).toBe(12 + RECIPES.coffee.price);
  });
});

describe("baking croissants", () => {
  function doughOnTray() {
    let s = withLevel(15, { coins: 100 });
    for (const i of ["egg", "flour", "wheat", "butter"] as const) s = run(s, { type: "buy", ingredient: i }, { type: "add", ingredient: i });
    return run(s, { type: "whisk", now: T0 }, { type: "tick", now: T0 + DURATIONS.whisk }, { type: "transferToTray" });
  }

  it("requires every ingredient before whisking", () => {
    let s = withLevel(15, { coins: 100 });
    s = run(s, { type: "buy", ingredient: "egg" }, { type: "add", ingredient: "egg" });
    const r = applyAction(s, { type: "whisk", now: T0 });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/flour/);
    expect(applyAction(run(s, { type: "buy", ingredient: "egg" }), { type: "add", ingredient: "egg" }).ok).toBe(false);
  });

  it("bakes for exactly 60 seconds", () => {
    let s = run(doughOnTray(), { type: "bake", now: T0 });
    expect(s.bakery.ovenEndsAt).toBe(T0 + 60_000);
    expect(ovenRemainingMs(s, T0 + 15_000)).toBe(45_000);
    s = run(s, { type: "tick", now: T0 + 59_999 });
    expect(s.bakery.oven).toBe("baking");
    expect(applyAction(s, { type: "takeOutCroissants", now: T0 + 59_999 }).ok).toBe(false);
    s = run(s, { type: "tick", now: T0 + 60_000 });
    expect(s.bakery.oven).toBe("done");
    s = run(s, { type: "takeOutCroissants", now: T0 + 60_000 });
    expect(s.bakery.croissants).toBe(2);
  });

  it("lets the player keep shopping and blending while the oven runs", () => {
    let s = run(doughOnTray(), { type: "bake", now: T0 });
    s = run(s, { type: "buy", ingredient: "strawberry" }, { type: "add", ingredient: "strawberry" }, { type: "blenderOn", now: T0 + 1000 }, { type: "tick", now: T0 + 5000 });
    expect(s.blender.phase).toBe("blended");
    expect(s.bakery.oven).toBe("baking");
  });

  it("serves a croissant when ordered", () => {
    let s = run(doughOnTray(), { type: "bake", now: T0 }, { type: "takeOutCroissants", now: T0 + 60_000 });
    s = { ...s, currentOrder: { ...s.currentOrder!, recipeId: "croissant" } };
    const before = s.coins;
    s = run(s, { type: "serve", now: T0 + 61_000 });
    expect(s.bakery.croissants).toBe(1);
    expect(s.coins).toBe(before + RECIPES.croissant.price);
  });
});

describe("persistence", () => {
  function memoryStorage() {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
  }

  it("round-trips the full state through storage", () => {
    let s = serveStrawberry(createInitialState());
    s = run(s, { type: "addSpecial", name: "Pink Paws", recipeId: "strawberrySmoothie" }, { type: "setAvatar", avatar: { gender: "boy", name: "Theo", apron: "#7f9f7a" } }, { type: "nextCustomer", rand: [0.4, 0.9, 0, 0.3, 1] });
    const store = memoryStorage();
    saveGame(store, s);
    expect(store.m.has(SAVE_KEY)).toBe(true);
    const loaded = loadGame(store, T0);
    expect(loaded).toEqual(s);
  });

  it("preserves the oven's completion timestamp across a reload", () => {
    let s = withLevel(15, { coins: 100 });
    for (const i of ["egg", "flour", "wheat", "butter"] as const) s = run(s, { type: "buy", ingredient: i }, { type: "add", ingredient: i });
    s = run(s, { type: "whisk", now: T0 }, { type: "tick", now: T0 + 2000 }, { type: "transferToTray" }, { type: "bake", now: T0 });
    const json = serialize(s);
    const mid = deserialize(json, T0 + 30_000);
    expect(mid.bakery.oven).toBe("baking");
    expect(ovenRemainingMs(mid, T0 + 30_000)).toBe(30_000);
    const after = deserialize(json, T0 + 61_000);
    expect(after.bakery.oven).toBe("done");
  });

  it("sanitizes corrupt or hostile saves", () => {
    expect(deserialize("not json", T0)).toEqual(createInitialState());
    const bad = deserialize(JSON.stringify({ version: 1, coins: -50, inventory: { strawberry: -3, banana: "x" }, staff: ["hazel", "hazel", "nobody"] }), T0);
    expect(bad.coins).toBe(5);
    expect(bad.inventory.strawberry).toBe(0);
    expect(bad.inventory.banana).toBe(0);
    expect(bad.staff).toEqual(["hazel"]);
  });
});
