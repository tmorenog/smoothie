// Pure game engine. Every action returns a new state plus a result; the
// previous state is never mutated, so React can diff it safely and tests can
// replay any sequence deterministically (time and randomness are inputs).

import {
  BLENDER_CAPACITY,
  CUSTOMERS,
  CUSTOMER_IDS,
  DURATIONS,
  INGREDIENTS,
  INGREDIENT_IDS,
  MAX_LEVEL,
  MAX_SPECIALS,
  MAX_SPECIAL_NAME,
  RECIPES,
  RECIPE_IDS,
  REGULAR_VISITS,
  SPECIAL_BONUS,
  STAFF,
  STARTING_COINS,
  VIP_VISITS,
  type CustomerId,
  type IngredientId,
  type RecipeId,
  type StaffId,
  type Station,
} from "./data";

export type Inventory = Record<IngredientId, number>;

export interface Order {
  id: number;
  customerId: CustomerId;
  recipeId: RecipeId;
  specialId: number | null;
  specialName: string | null;
  status: "waiting" | "served";
  /** Coins paid when served (null until served). */
  paid: number | null;
  tip: number | null;
}

export interface Special {
  id: number;
  name: string;
  recipeId: RecipeId;
}

export interface Avatar {
  gender: "girl" | "boy";
  name: string;
  skin: string;
  hair: string;
  apron: string;
}

export type BlenderPhase = "idle" | "blending" | "blended" | "pouring";

export interface GameState {
  version: 1;
  coins: number;
  xp: number;
  inventory: Inventory;
  visits: Record<CustomerId, number>;
  currentOrder: Order | null;
  nextOrderId: number;
  lastCustomerId: CustomerId | null;
  servedCount: number;
  blender: {
    contents: IngredientId[];
    phase: BlenderPhase;
    endsAt: number | null;
    result: RecipeId | null;
  };
  /** The smoothie cup on the counter. */
  cup: RecipeId | null;
  coffee: {
    beans: number;
    phase: "idle" | "brewing" | "ready";
    endsAt: number | null;
  };
  donut: {
    dough: number;
    phase: "idle" | "frying" | "fried" | "decorated";
    endsAt: number | null;
  };
  bakery: {
    bowl: IngredientId[];
    bowlPhase: "idle" | "whisking" | "whisked";
    whiskEndsAt: number | null;
    tray: "empty" | "dough";
    oven: "idle" | "baking" | "done";
    ovenEndsAt: number | null;
    croissants: number;
  };
  staff: StaffId[];
  specials: Special[];
  nextSpecialId: number;
  avatar: Avatar;
  robber: { active: boolean; lastAtServe: number; stopped: number };
  tutorial: { dismissed: boolean; completed: boolean };
  settings: { sound: boolean };
  stats: { coinsEarned: number; rescues: number };
}

export type Action =
  | { type: "buy"; ingredient: IngredientId; qty?: number }
  | { type: "add"; ingredient: IngredientId }
  | { type: "emptyBlender" }
  | { type: "blenderOn"; now: number }
  | { type: "pour"; now: number }
  | { type: "tossCup" }
  | { type: "brew"; now: number }
  | { type: "emptyCoffee" }
  | { type: "fry"; now: number }
  | { type: "emptyFryer" }
  | { type: "whisk"; now: number }
  | { type: "emptyBowl" }
  | { type: "transferToTray" }
  | { type: "bake"; now: number }
  | { type: "takeOutCroissants"; now: number }
  | { type: "serve"; now: number }
  | { type: "nextCustomer"; rand: number[] }
  | { type: "secureTill" }
  | { type: "rescue" }
  | { type: "addSpecial"; name: string; recipeId: RecipeId }
  | { type: "removeSpecial"; id: number }
  | { type: "hire"; staffId: StaffId }
  | { type: "setAvatar"; avatar: Partial<Avatar> }
  | { type: "toggleSound" }
  | { type: "dismissTutorial" }
  | { type: "restartTutorial" }
  | { type: "tick"; now: number };

export type GameEvent =
  | { kind: "bought"; ingredient: IngredientId; qty: number }
  | { kind: "added"; ingredient: IngredientId; station: Station }
  | { kind: "blendStart" }
  | { kind: "blendDone"; recipe: RecipeId }
  | { kind: "pourStart" }
  | { kind: "pourDone"; recipe: RecipeId }
  | { kind: "brewStart" }
  | { kind: "brewDone" }
  | { kind: "fryStart" }
  | { kind: "fryDone" }
  | { kind: "whiskStart" }
  | { kind: "whiskDone" }
  | { kind: "bakeStart" }
  | { kind: "bakeDone" }
  | { kind: "served"; orderId: number; customerId: CustomerId; paid: number; tip: number; xp: number; becameVip: boolean }
  | { kind: "levelUp"; level: number }
  | { kind: "newCustomer"; customerId: CustomerId }
  | { kind: "robber" }
  | { kind: "tillSecured" }
  | { kind: "hired"; staffId: StaffId }
  | { kind: "tossed" }
  | { kind: "rescue"; coins: number };

export interface Result {
  ok: boolean;
  state: GameState;
  message?: string;
  events: GameEvent[];
}

// ---------------------------------------------------------------------------
// Construction

export function emptyInventory(): Inventory {
  return Object.fromEntries(INGREDIENT_IDS.map((id) => [id, 0])) as Inventory;
}

export function createInitialState(): GameState {
  return {
    version: 1,
    coins: STARTING_COINS,
    xp: 0,
    inventory: emptyInventory(),
    visits: Object.fromEntries(CUSTOMER_IDS.map((id) => [id, 0])) as Record<CustomerId, number>,
    currentOrder: {
      id: 1,
      customerId: "mochi",
      recipeId: "strawberrySmoothie",
      specialId: null,
      specialName: null,
      status: "waiting",
      paid: null,
      tip: null,
    },
    nextOrderId: 2,
    lastCustomerId: "mochi",
    servedCount: 0,
    blender: { contents: [], phase: "idle", endsAt: null, result: null },
    cup: null,
    coffee: { beans: 0, phase: "idle", endsAt: null },
    donut: { dough: 0, phase: "idle", endsAt: null },
    bakery: {
      bowl: [],
      bowlPhase: "idle",
      whiskEndsAt: null,
      tray: "empty",
      oven: "idle",
      ovenEndsAt: null,
      croissants: 0,
    },
    staff: [],
    specials: [],
    nextSpecialId: 1,
    avatar: { gender: "girl", name: "Robin", skin: "#e8b99a", hair: "#5a3825", apron: "#e8728f" },
    robber: { active: false, lastAtServe: 0, stopped: 0 },
    tutorial: { dismissed: false, completed: false },
    settings: { sound: true },
    stats: { coinsEarned: 0, rescues: 0 },
  };
}

// ---------------------------------------------------------------------------
// Levels

/** Total XP needed to reach `level` (level 1 needs 0). Steps grow by 5 XP. */
export function xpForLevel(level: number): number {
  const n = Math.max(0, Math.min(level, MAX_LEVEL) - 1);
  return n * 20 + (5 * n * (n - 1)) / 2;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  if (level >= MAX_LEVEL) return { level, current: 1, needed: 1, fraction: 1 };
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, current: xp - base, needed: next - base, fraction: (xp - base) / (next - base) };
}

export function getLevel(state: GameState): number {
  return levelFromXp(state.xp);
}

export function isIngredientUnlocked(state: GameState, id: IngredientId) {
  return getLevel(state) >= INGREDIENTS[id].unlockLevel;
}

export function isRecipeUnlocked(state: GameState, id: RecipeId) {
  return getLevel(state) >= RECIPES[id].unlockLevel;
}

export function isStationUnlocked(state: GameState, station: Station) {
  if (station === "coffee") return getLevel(state) >= RECIPES.coffee.unlockLevel;
  if (station === "donut") return getLevel(state) >= RECIPES.donut.unlockLevel;
  if (station === "bakery") return getLevel(state) >= RECIPES.croissant.unlockLevel;
  return true;
}

// ---------------------------------------------------------------------------
// Colour and flavour mixing

const FRUIT_COLORS: Partial<Record<IngredientId, string>> = {
  strawberry: RECIPES.strawberrySmoothie.color,
  banana: RECIPES.bananaSmoothie.color,
};

/** Which smoothie a set of blender contents becomes (null if invalid). */
export function smoothieFor(contents: IngredientId[]): RecipeId | null {
  if (contents.length === 0) return null;
  const set = new Set(contents);
  if ([...set].some((id) => INGREDIENTS[id].station !== "blender")) return null;
  const s = set.has("strawberry");
  const b = set.has("banana");
  if (s && b) return "sunriseSmoothie";
  if (s) return "strawberrySmoothie";
  if (b) return "bananaSmoothie";
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbToHex([r, g, b]: [number, number, number]) {
  return "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
}

/**
 * Colour of blended fruit. Known combinations map to their signature colours:
 * strawberry → light pink, banana → creamy yellow, both → peachy orange.
 */
export function mixColor(contents: IngredientId[]): string {
  const recipe = smoothieFor(contents);
  if (recipe) return RECIPES[recipe].color;
  const cols = contents.map((c) => FRUIT_COLORS[c]).filter(Boolean) as string[];
  if (cols.length === 0) return "#ffffff";
  const sum = cols.map(hexToRgb).reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]);
  return rgbToHex([sum[0] / cols.length, sum[1] / cols.length, sum[2] / cols.length]);
}

export function mixFlavor(contents: IngredientId[]): string {
  const recipe = smoothieFor(contents);
  return recipe ? RECIPES[recipe].flavor : "nothing yet";
}

// ---------------------------------------------------------------------------
// Customers and rewards

export function customerStatus(visits: number): "new" | "regular" | "vip" {
  if (visits >= VIP_VISITS) return "vip";
  if (visits >= REGULAR_VISITS) return "regular";
  return "new";
}

export function isVip(state: GameState, id: CustomerId) {
  return customerStatus(state.visits[id]) === "vip";
}

export function staffBonus(state: GameState) {
  return state.staff.reduce(
    (acc, id) => ({ coins: acc.coins + STAFF[id].coinBonus, xp: acc.xp + STAFF[id].xpBonus }),
    { coins: 0, xp: 0 },
  );
}

/** Coins/XP the current order would pay, given current visits and staff. */
export function quoteOrder(state: GameState, order: Order) {
  const recipe = RECIPES[order.recipeId];
  const status = customerStatus(state.visits[order.customerId]);
  const vipTip = status === "vip" ? Math.max(3, Math.ceil(recipe.price * 0.25)) : status === "regular" ? 1 : 0;
  const special = order.specialId !== null ? SPECIAL_BONUS : 0;
  const bonus = staffBonus(state);
  const tip = vipTip + special + bonus.coins;
  return { base: recipe.price, tip, total: recipe.price + tip, xp: recipe.xp + bonus.xp, vip: status === "vip" };
}

export function unlockedCustomers(state: GameState): CustomerId[] {
  const level = getLevel(state);
  return CUSTOMER_IDS.filter((id) => CUSTOMERS[id].unlockLevel <= level);
}

// ---------------------------------------------------------------------------
// Affordability

/** Ingredients the player already has towards a recipe (inventory + idle stations). */
function availableFor(state: GameState): Inventory {
  const inv = { ...state.inventory };
  if (state.blender.phase === "idle") for (const c of state.blender.contents) inv[c]++;
  if (state.coffee.phase === "idle") inv.coffeeBeans += state.coffee.beans;
  if (state.donut.phase === "idle") inv.donutDough += state.donut.dough;
  else if (state.donut.phase === "frying" || state.donut.phase === "fried") inv.donutDough += 1; // only sprinkles still needed
  if (state.bakery.bowlPhase === "idle") for (const c of state.bakery.bowl) inv[c]++;
  return inv;
}

/** Whether a finished (or in-progress) item for this recipe already exists. */
export function hasItemInProgress(state: GameState, recipeId: RecipeId): boolean {
  const recipe = RECIPES[recipeId];
  if (recipe.station === "blender") {
    if (state.cup === recipeId) return true;
    if (state.blender.phase !== "idle" && state.blender.result === recipeId) return true;
    if (state.blender.phase === "blending" && smoothieFor(state.blender.contents) === recipeId) return true;
    return false;
  }
  if (recipe.station === "coffee") return state.coffee.phase !== "idle";
  // A fried (undecorated) donut still needs sprinkles, so it isn't "done".
  if (recipe.station === "donut") return state.donut.phase === "decorated";
  return (
    state.bakery.croissants > 0 ||
    state.bakery.oven !== "idle" ||
    state.bakery.tray === "dough" ||
    state.bakery.bowlPhase !== "idle"
  );
}

/** Coins still needed to buy what's missing for one batch of a recipe. */
export function missingCost(state: GameState, recipeId: RecipeId): number {
  if (hasItemInProgress(state, recipeId)) return 0;
  const inv = availableFor(state);
  let cost = 0;
  for (const [id, n] of Object.entries(RECIPES[recipeId].ingredients) as [IngredientId, number][]) {
    cost += Math.max(0, n - inv[id]) * INGREDIENTS[id].price;
  }
  return cost;
}

/** The player can't finish the current order with what they have: offer the tip jar. */
export function canRescue(state: GameState): boolean {
  const order = state.currentOrder;
  if (!order || order.status !== "waiting") return false;
  return missingCost(state, order.recipeId) > state.coins;
}

// ---------------------------------------------------------------------------
// Helpers

function fail(state: GameState, message: string): Result {
  return { ok: false, state, message, events: [] };
}

function ok(state: GameState, events: GameEvent[] = [], message?: string): Result {
  return { ok: true, state, events, message };
}

function cleanName(raw: string): string {
  return raw.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, MAX_SPECIAL_NAME);
}

function pick<T>(items: T[], r: number): T {
  const i = Math.min(items.length - 1, Math.max(0, Math.floor(r * items.length)));
  return items[i];
}

function isTimedBusy(state: GameState): boolean {
  return (
    state.blender.phase === "blending" ||
    state.blender.phase === "pouring" ||
    state.coffee.phase === "brewing" ||
    state.donut.phase === "frying" ||
    state.bakery.bowlPhase === "whisking"
  );
}

// ---------------------------------------------------------------------------
// Order generation

export function generateOrder(state: GameState, rand: number[]): Order {
  const r = (i: number) => rand[i % Math.max(1, rand.length)] ?? 0.5;
  const pool = unlockedCustomers(state);
  const choices = pool.length > 1 ? pool.filter((c) => c !== state.lastCustomerId) : pool;
  const customerId = pick(choices, r(0));

  const unlocked = RECIPE_IDS.filter((id) => isRecipeUnlocked(state, id));
  // Only ask for things the player can afford right now. If nothing is
  // affordable, fall back to the cheapest recipe (the tip jar covers it).
  let affordable = unlocked.filter((id) => missingCost(state, id) <= state.coins);
  if (affordable.length === 0) {
    affordable = [unlocked.reduce((a, b) => (missingCost(state, a) <= missingCost(state, b) ? a : b))];
  }

  // Specials are ordered about 40% of the time when one is affordable.
  const specials = state.specials.filter((s) => affordable.includes(s.recipeId));
  if (specials.length > 0 && r(1) < 0.4) {
    const s = pick(specials, r(2));
    return { id: state.nextOrderId, customerId, recipeId: s.recipeId, specialId: s.id, specialName: s.name, status: "waiting", paid: null, tip: null };
  }

  // Weighted: favourites and the newest unlock come up more often.
  const newest = affordable.reduce((a, b) => (RECIPES[a].unlockLevel >= RECIPES[b].unlockLevel ? a : b));
  const weighted: RecipeId[] = [];
  for (const id of affordable) {
    weighted.push(id);
    if (id === CUSTOMERS[customerId].favorite) weighted.push(id, id);
    if (id === newest && affordable.length > 1) weighted.push(id);
  }
  const recipeId = pick(weighted, r(3));
  return { id: state.nextOrderId, customerId, recipeId, specialId: null, specialName: null, status: "waiting", paid: null, tip: null };
}

// ---------------------------------------------------------------------------
// Tick: completes timed phases whose end time has passed.

export function tick(state: GameState, now: number): Result {
  let s = state;
  const events: GameEvent[] = [];
  if (s.blender.phase === "blending" && s.blender.endsAt !== null && now >= s.blender.endsAt) {
    const result = smoothieFor(s.blender.contents);
    s = { ...s, blender: { contents: [], phase: "blended", endsAt: null, result } };
    if (result) events.push({ kind: "blendDone", recipe: result });
  }
  if (s.blender.phase === "pouring" && s.blender.endsAt !== null && now >= s.blender.endsAt) {
    const recipe = s.blender.result;
    s = { ...s, cup: recipe, blender: { contents: [], phase: "idle", endsAt: null, result: null } };
    if (recipe) events.push({ kind: "pourDone", recipe });
  }
  if (s.coffee.phase === "brewing" && s.coffee.endsAt !== null && now >= s.coffee.endsAt) {
    s = { ...s, coffee: { beans: 0, phase: "ready", endsAt: null } };
    events.push({ kind: "brewDone" });
  }
  if (s.donut.phase === "frying" && s.donut.endsAt !== null && now >= s.donut.endsAt) {
    s = { ...s, donut: { dough: 0, phase: "fried", endsAt: null } };
    events.push({ kind: "fryDone" });
  }
  if (s.bakery.bowlPhase === "whisking" && s.bakery.whiskEndsAt !== null && now >= s.bakery.whiskEndsAt) {
    s = { ...s, bakery: { ...s.bakery, bowlPhase: "whisked", whiskEndsAt: null } };
    events.push({ kind: "whiskDone" });
  }
  if (s.bakery.oven === "baking" && s.bakery.ovenEndsAt !== null && now >= s.bakery.ovenEndsAt) {
    s = { ...s, bakery: { ...s.bakery, oven: "done" } };
    events.push({ kind: "bakeDone" });
  }
  return ok(s, events);
}

export function ovenRemainingMs(state: GameState, now: number): number {
  if (state.bakery.oven !== "baking" || state.bakery.ovenEndsAt === null) return 0;
  return Math.max(0, state.bakery.ovenEndsAt - now);
}

// ---------------------------------------------------------------------------
// Reducer

export function applyAction(state: GameState, action: Action): Result {
  switch (action.type) {
    case "tick":
      return tick(state, action.now);

    case "buy": {
      const qty = Math.floor(action.qty ?? 1);
      if (qty < 1 || qty > 20) return fail(state, "Pick a quantity between 1 and 20.");
      const ing = INGREDIENTS[action.ingredient];
      if (!ing) return fail(state, "That isn't on the shop shelf.");
      if (!isIngredientUnlocked(state, ing.id)) return fail(state, `${ing.plural} unlock at level ${ing.unlockLevel}.`);
      const cost = ing.price * qty;
      if (state.coins < cost) return fail(state, `You need ${cost} coins for ${qty === 1 ? "one" : qty} ${qty === 1 ? ing.name.toLowerCase() : ing.plural.toLowerCase()}.`);
      return ok(
        { ...state, coins: state.coins - cost, inventory: { ...state.inventory, [ing.id]: state.inventory[ing.id] + qty } },
        [{ kind: "bought", ingredient: ing.id, qty }],
        `Bought ${qty} ${qty === 1 ? ing.name.toLowerCase() : ing.plural.toLowerCase()}.`,
      );
    }

    case "add": {
      const ing = INGREDIENTS[action.ingredient];
      if (!ing) return fail(state, "Unknown ingredient.");
      if (state.inventory[ing.id] <= 0) return fail(state, `No ${ing.plural.toLowerCase()} left. Visit the shop.`);
      const inv = { ...state.inventory, [ing.id]: state.inventory[ing.id] - 1 };
      if (ing.station === "blender") {
        if (state.blender.phase !== "idle") return fail(state, "Pour or empty the blender first.");
        if (state.blender.contents.length >= BLENDER_CAPACITY) return fail(state, "The blender is full.");
        return ok(
          { ...state, inventory: inv, blender: { ...state.blender, contents: [...state.blender.contents, ing.id] } },
          [{ kind: "added", ingredient: ing.id, station: "blender" }],
          `${ing.name} added to the blender.`,
        );
      }
      if (ing.station === "coffee") {
        if (!isStationUnlocked(state, "coffee")) return fail(state, "The coffee station opens at level 10.");
        if (state.coffee.phase !== "idle") return fail(state, "Serve or empty the coffee first.");
        if (state.coffee.beans >= 1) return fail(state, "The grinder already has a scoop of beans.");
        return ok(
          { ...state, inventory: inv, coffee: { ...state.coffee, beans: 1 } },
          [{ kind: "added", ingredient: ing.id, station: "coffee" }],
          "Beans loaded into the coffee machine.",
        );
      }
      if (ing.station === "donut") {
        if (!isStationUnlocked(state, "donut")) return fail(state, "The donut fryer opens at level 5.");
        const d = state.donut;
        if (ing.id === "donutDough") {
          if (d.phase !== "idle") return fail(state, "Serve or toss the donut in the fryer first.");
          if (d.dough >= 1) return fail(state, "There's already a donut ring in the fryer.");
          return ok(
            { ...state, inventory: inv, donut: { ...d, dough: 1 } },
            [{ kind: "added", ingredient: ing.id, station: "donut" }],
            "Donut ring lowered into the fryer.",
          );
        }
        // sprinkles go on a freshly fried donut
        if (d.phase === "decorated") return fail(state, "This donut already has sprinkles.");
        if (d.phase !== "fried") return fail(state, "Fry a donut first, then add sprinkles.");
        return ok(
          { ...state, inventory: inv, donut: { ...d, phase: "decorated" } },
          [{ kind: "added", ingredient: ing.id, station: "donut" }],
          "Pink glaze and sprinkles on top!",
        );
      }
      // bakery
      if (!isStationUnlocked(state, "bakery")) return fail(state, "The bakery opens at level 15.");
      if (state.bakery.bowlPhase !== "idle") return fail(state, "Move the batter to the tray first.");
      if (state.bakery.bowl.includes(ing.id)) return fail(state, `The bowl already has ${ing.name.toLowerCase()}.`);
      return ok(
        { ...state, inventory: inv, bakery: { ...state.bakery, bowl: [...state.bakery.bowl, ing.id] } },
        [{ kind: "added", ingredient: ing.id, station: "bakery" }],
        `${ing.name} added to the mixing bowl.`,
      );
    }

    case "emptyBlender": {
      const b = state.blender;
      if (b.phase === "idle") {
        if (b.contents.length === 0) return fail(state, "The blender is already empty.");
        const inv = { ...state.inventory };
        for (const c of b.contents) inv[c]++;
        return ok({ ...state, inventory: inv, blender: { ...b, contents: [] } }, [], "Fruit returned to your inventory.");
      }
      if (b.phase === "blended") {
        return ok({ ...state, blender: { contents: [], phase: "idle", endsAt: null, result: null } }, [{ kind: "tossed" }], "Blender rinsed out.");
      }
      return fail(state, "Wait for the blender to finish.");
    }

    case "blenderOn": {
      const b = state.blender;
      if (b.phase === "blending") return fail(state, "Already blending!");
      if (b.phase !== "idle") return fail(state, "Pour the smoothie first.");
      if (b.contents.length === 0) return fail(state, "Add fruit before switching the blender on.");
      return ok(
        { ...state, blender: { ...b, phase: "blending", endsAt: action.now + DURATIONS.blend, result: smoothieFor(b.contents) } },
        [{ kind: "blendStart" }],
        "Whirrr! Blending…",
      );
    }

    case "pour": {
      const b = state.blender;
      if (b.phase === "pouring") return fail(state, "Already pouring.");
      if (b.phase !== "blended") return fail(state, "Blend something first.");
      if (state.cup !== null) return fail(state, "The cup is full. Serve or toss it first.");
      return ok({ ...state, blender: { ...b, phase: "pouring", endsAt: action.now + DURATIONS.pour } }, [{ kind: "pourStart" }], "Pouring…");
    }

    case "tossCup":
      if (state.cup === null) return fail(state, "The cup is already empty.");
      if (state.blender.phase === "pouring") return fail(state, "Wait for the pour to finish.");
      return ok({ ...state, cup: null }, [{ kind: "tossed" }], "Cup emptied. Make a fresh one!");

    case "brew": {
      if (!isStationUnlocked(state, "coffee")) return fail(state, "The coffee station opens at level 10.");
      const c = state.coffee;
      if (c.phase === "brewing") return fail(state, "Already brewing.");
      if (c.phase === "ready") return fail(state, "A coffee is ready. Serve it first.");
      if (c.beans < 1) return fail(state, "Add coffee beans first.");
      return ok({ ...state, coffee: { ...c, phase: "brewing", endsAt: action.now + DURATIONS.brew } }, [{ kind: "brewStart" }], "Brewing coffee…");
    }

    case "emptyCoffee": {
      const c = state.coffee;
      if (c.phase === "brewing") return fail(state, "Wait for the brew to finish.");
      if (c.phase === "ready") return ok({ ...state, coffee: { beans: 0, phase: "idle", endsAt: null } }, [{ kind: "tossed" }], "Coffee poured out.");
      if (c.beans > 0)
        return ok(
          { ...state, inventory: { ...state.inventory, coffeeBeans: state.inventory.coffeeBeans + c.beans }, coffee: { ...c, beans: 0 } },
          [],
          "Beans returned to your inventory.",
        );
      return fail(state, "The coffee machine is empty.");
    }

    case "fry": {
      if (!isStationUnlocked(state, "donut")) return fail(state, "The donut fryer opens at level 5.");
      const d = state.donut;
      if (d.phase === "frying") return fail(state, "Already frying.");
      if (d.phase !== "idle") return fail(state, "Serve or toss the donut first.");
      if (d.dough < 1) return fail(state, "Add donut dough first.");
      return ok({ ...state, donut: { ...d, phase: "frying", endsAt: action.now + DURATIONS.fry } }, [{ kind: "fryStart" }], "Sizzle! Frying the donut…");
    }

    case "emptyFryer": {
      const d = state.donut;
      if (d.phase === "frying") return fail(state, "Wait for the donut to finish frying.");
      if (d.phase === "fried" || d.phase === "decorated")
        return ok({ ...state, donut: { dough: 0, phase: "idle", endsAt: null } }, [{ kind: "tossed" }], "Donut tossed. Fry a fresh one!");
      if (d.dough > 0)
        return ok(
          { ...state, inventory: { ...state.inventory, donutDough: state.inventory.donutDough + d.dough }, donut: { ...d, dough: 0 } },
          [],
          "Dough returned to your inventory.",
        );
      return fail(state, "The fryer is empty.");
    }

    case "whisk": {
      if (!isStationUnlocked(state, "bakery")) return fail(state, "The bakery opens at level 15.");
      const k = state.bakery;
      if (k.bowlPhase !== "idle") return fail(state, k.bowlPhase === "whisking" ? "Already whisking." : "Batter is ready. Move it to the tray.");
      const need = (Object.keys(RECIPES.croissant.ingredients) as IngredientId[]).filter((i) => !k.bowl.includes(i));
      if (need.length > 0) return fail(state, `The bowl still needs: ${need.map((i) => INGREDIENTS[i].name.toLowerCase()).join(", ")}.`);
      return ok({ ...state, bakery: { ...k, bowlPhase: "whisking", whiskEndsAt: action.now + DURATIONS.whisk } }, [{ kind: "whiskStart" }], "Whisking…");
    }

    case "emptyBowl": {
      const k = state.bakery;
      if (k.bowlPhase === "whisking") return fail(state, "Wait for the whisk to finish.");
      if (k.bowlPhase === "whisked") return ok({ ...state, bakery: { ...k, bowl: [], bowlPhase: "idle" } }, [{ kind: "tossed" }], "Bowl washed.");
      if (k.bowl.length === 0) return fail(state, "The bowl is already empty.");
      const inv = { ...state.inventory };
      for (const c of k.bowl) inv[c]++;
      return ok({ ...state, inventory: inv, bakery: { ...k, bowl: [] } }, [], "Ingredients returned to your pantry.");
    }

    case "transferToTray": {
      const k = state.bakery;
      if (k.bowlPhase !== "whisked") return fail(state, "Whisk the batter first.");
      if (k.tray !== "empty") return fail(state, "The tray already has dough on it.");
      return ok({ ...state, bakery: { ...k, bowl: [], bowlPhase: "idle", tray: "dough" } }, [], "Dough shaped onto the tray.");
    }

    case "bake": {
      const k = state.bakery;
      if (k.oven === "baking") return fail(state, "The oven is already baking.");
      if (k.oven === "done") return fail(state, "Take the croissants out first.");
      if (k.tray !== "dough") return fail(state, "Put dough on the tray first.");
      return ok(
        { ...state, bakery: { ...k, tray: "empty", oven: "baking", ovenEndsAt: action.now + DURATIONS.bake } },
        [{ kind: "bakeStart" }],
        "Into the oven! Croissants ready in 1 minute.",
      );
    }

    case "takeOutCroissants": {
      const t = tick(state, action.now).state;
      const k = t.bakery;
      if (k.oven !== "done") return fail(state, k.oven === "baking" ? "Still baking…" : "The oven is empty.");
      return ok(
        { ...t, bakery: { ...k, oven: "idle", ovenEndsAt: null, croissants: k.croissants + RECIPES.croissant.batch } },
        [],
        `${RECIPES.croissant.batch} golden croissants ready to serve!`,
      );
    }

    case "serve": {
      const order = state.currentOrder;
      if (!order) return fail(state, "No customer is waiting.");
      if (order.status === "served") return fail(state, "This order was already served.");
      if (state.robber.active) return fail(state, "Secure the till first!");
      const recipe = RECIPES[order.recipeId];
      const name = CUSTOMERS[order.customerId].name;
      let next: GameState = state;
      if (recipe.station === "blender") {
        if (state.blender.phase === "pouring") return fail(state, "Wait for the pour to finish.");
        if (state.cup === null) return fail(state, `Make a ${recipe.name} for ${name} first.`);
        if (state.cup !== order.recipeId)
          return fail(state, `${name} ordered a ${recipe.name}, but the cup has a ${RECIPES[state.cup].name}. Toss it or keep it for someone else.`);
        next = { ...state, cup: null };
      } else if (recipe.station === "coffee") {
        if (state.coffee.phase !== "ready") return fail(state, `Brew a coffee for ${name} first.`);
        next = { ...state, coffee: { beans: 0, phase: "idle", endsAt: null } };
      } else if (recipe.station === "donut") {
        if (state.donut.phase === "fried") return fail(state, `Add pink sprinkles to ${name}'s donut first.`);
        if (state.donut.phase !== "decorated") return fail(state, `Fry and decorate a donut for ${name} first.`);
        next = { ...state, donut: { dough: 0, phase: "idle", endsAt: null } };
      } else {
        if (state.bakery.croissants <= 0) return fail(state, `Bake croissants for ${name} first.`);
        next = { ...state, bakery: { ...state.bakery, croissants: state.bakery.croissants - 1 } };
      }
      const quote = quoteOrder(state, order);
      const beforeLevel = getLevel(state);
      const wasVip = isVip(state, order.customerId);
      const visits = { ...state.visits, [order.customerId]: state.visits[order.customerId] + 1 };
      next = {
        ...next,
        coins: state.coins + quote.total,
        xp: state.xp + quote.xp,
        visits,
        servedCount: state.servedCount + 1,
        currentOrder: { ...order, status: "served", paid: quote.total, tip: quote.tip },
        tutorial: { ...state.tutorial, completed: true },
        stats: { ...state.stats, coinsEarned: state.stats.coinsEarned + quote.total },
      };
      const becameVip = !wasVip && customerStatus(visits[order.customerId]) === "vip";
      const events: GameEvent[] = [
        { kind: "served", orderId: order.id, customerId: order.customerId, paid: quote.total, tip: quote.tip, xp: quote.xp, becameVip },
      ];
      const afterLevel = getLevel(next);
      for (let l = beforeLevel + 1; l <= afterLevel; l++) events.push({ kind: "levelUp", level: l });
      return ok(next, events, `${name} paid ${quote.total} coins${quote.tip > 0 ? ` (incl. ${quote.tip} tip)` : ""}!`);
    }

    case "nextCustomer": {
      const order = state.currentOrder;
      if (order && order.status === "waiting") return fail(state, "Finish the current order first.");
      if (state.robber.active) return fail(state, "Secure the till first!");
      const newOrder = generateOrder(state, action.rand);
      const events: GameEvent[] = [{ kind: "newCustomer", customerId: newOrder.customerId }];
      let robber = state.robber;
      const roll = action.rand[4] ?? 1;
      if (state.servedCount >= 4 && state.servedCount - robber.lastAtServe >= 5 && roll < 0.2) {
        robber = { ...robber, active: true, lastAtServe: state.servedCount };
        events.push({ kind: "robber" });
      }
      return ok(
        { ...state, currentOrder: newOrder, nextOrderId: state.nextOrderId + 1, lastCustomerId: newOrder.customerId, robber },
        events,
        `${CUSTOMERS[newOrder.customerId].name} walks in!`,
      );
    }

    case "secureTill":
      if (!state.robber.active) return fail(state, "The till is already safe.");
      return ok({ ...state, robber: { ...state.robber, active: false, stopped: state.robber.stopped + 1 } }, [{ kind: "tillSecured" }], "Till locked! The bandit tiptoes away empty-pawed.");

    case "rescue": {
      if (!canRescue(state)) return fail(state, "You have everything you need. No tip jar needed!");
      const need = missingCost(state, state.currentOrder!.recipeId) - state.coins;
      return ok(
        { ...state, coins: state.coins + need, stats: { ...state.stats, rescues: state.stats.rescues + 1 } },
        [{ kind: "rescue", coins: need }],
        `Neighbours chipped in ${need} coins from the tip jar.`,
      );
    }

    case "addSpecial": {
      const name = cleanName(action.name);
      if (name.length < 2) return fail(state, "Give your special a name (2+ characters).");
      if (!RECIPES[action.recipeId]) return fail(state, "Pick a recipe.");
      if (!isRecipeUnlocked(state, action.recipeId)) return fail(state, "You haven't unlocked that recipe yet.");
      if (state.specials.length >= MAX_SPECIALS) return fail(state, `Your menu board fits ${MAX_SPECIALS} specials.`);
      if (state.specials.some((s) => s.name.toLowerCase() === name.toLowerCase())) return fail(state, "A special with that name already exists.");
      return ok(
        { ...state, specials: [...state.specials, { id: state.nextSpecialId, name, recipeId: action.recipeId }], nextSpecialId: state.nextSpecialId + 1 },
        [],
        `"${name}" added to the menu!`,
      );
    }

    case "removeSpecial":
      if (!state.specials.some((s) => s.id === action.id)) return fail(state, "That special isn't on the menu.");
      return ok({ ...state, specials: state.specials.filter((s) => s.id !== action.id) }, [], "Special removed.");

    case "hire": {
      const staff = STAFF[action.staffId];
      if (!staff) return fail(state, "Unknown staff member.");
      if (state.staff.includes(staff.id)) return fail(state, `${staff.name} already works here.`);
      if (getLevel(state) < staff.unlockLevel) return fail(state, `${staff.name} is available from level ${staff.unlockLevel}.`);
      if (state.coins < staff.cost) return fail(state, `Hiring ${staff.name} costs ${staff.cost} coins.`);
      return ok({ ...state, coins: state.coins - staff.cost, staff: [...state.staff, staff.id] }, [{ kind: "hired", staffId: staff.id }], `${staff.name} joined the team!`);
    }

    case "setAvatar": {
      const a = { ...state.avatar, ...action.avatar };
      a.name = cleanName(a.name) || "Barista";
      if (a.gender !== "girl" && a.gender !== "boy") a.gender = "girl";
      for (const k of ["skin", "hair", "apron"] as const) if (!/^#[0-9a-f]{6}$/i.test(a[k])) a[k] = state.avatar[k];
      return ok({ ...state, avatar: a });
    }

    case "toggleSound":
      return ok({ ...state, settings: { ...state.settings, sound: !state.settings.sound } });

    case "dismissTutorial":
      return ok({ ...state, tutorial: { ...state.tutorial, dismissed: true } });

    case "restartTutorial":
      return ok({ ...state, tutorial: { dismissed: false, completed: false } });
  }
}

export { isTimedBusy };

// ---------------------------------------------------------------------------
// Tutorial

export type TutorialStep = "shop" | "inventory" | "on" | "blending" | "pour" | "pouring" | "serve" | null;

export function tutorialStep(state: GameState): TutorialStep {
  if (state.tutorial.dismissed || state.tutorial.completed) return null;
  if (state.cup !== null) return "serve";
  if (state.blender.phase === "pouring") return "pouring";
  if (state.blender.phase === "blended") return "pour";
  if (state.blender.phase === "blending") return "blending";
  if (state.blender.contents.length > 0) return "on";
  if (state.inventory.strawberry > 0) return "inventory";
  return "shop";
}
