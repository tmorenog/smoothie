// Local save/load. Everything lives in localStorage; no server, no accounts.

import { CUSTOMER_IDS, INGREDIENT_IDS, INGREDIENTS, RECIPES, STAFF, type IngredientId, type RecipeId, type StaffId } from "./data";
import { createInitialState, tick, type GameState, type Order } from "./engine";

export const SAVE_KEY = "smoothie-cat-cafe/save/v1";

const nonNegInt = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
const timestamp = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
const isIngredient = (v: unknown): v is IngredientId => typeof v === "string" && v in INGREDIENTS;
const isRecipe = (v: unknown): v is RecipeId => typeof v === "string" && v in RECIPES;
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;

type Loose = Record<string, unknown>;
const obj = (v: unknown): Loose => (v && typeof v === "object" ? (v as Loose) : {});

/** Turn arbitrary parsed JSON into a valid GameState, filling gaps with defaults. */
export function sanitize(raw: unknown): GameState {
  const d = createInitialState();
  const r = obj(raw);
  if (r.version !== 1) return d;

  const inv = obj(r.inventory);
  const visits = obj(r.visits);
  const blender = obj(r.blender);
  const coffee = obj(r.coffee);
  const bakery = obj(r.bakery);
  const donut = obj(r.donut);
  const avatar = obj(r.avatar);
  const robber = obj(r.robber);
  const tutorial = obj(r.tutorial);
  const settings = obj(r.settings);
  const stats = obj(r.stats);

  let currentOrder: Order | null = null;
  const o = obj(r.currentOrder);
  if (r.currentOrder && isRecipe(o.recipeId) && CUSTOMER_IDS.includes(o.customerId as never)) {
    currentOrder = {
      id: nonNegInt(o.id, 1),
      customerId: o.customerId as Order["customerId"],
      recipeId: o.recipeId,
      specialId: typeof o.specialId === "number" ? o.specialId : null,
      specialName: typeof o.specialName === "string" ? o.specialName.slice(0, 40) : null,
      status: oneOf(o.status, ["waiting", "served"] as const, "waiting"),
      paid: typeof o.paid === "number" ? o.paid : null,
      tip: typeof o.tip === "number" ? o.tip : null,
    };
  }

  const state: GameState = {
    version: 1,
    coins: nonNegInt(r.coins, d.coins),
    xp: nonNegInt(r.xp, 0),
    inventory: Object.fromEntries(INGREDIENT_IDS.map((id) => [id, nonNegInt(inv[id], 0)])) as GameState["inventory"],
    visits: Object.fromEntries(CUSTOMER_IDS.map((id) => [id, nonNegInt(visits[id], 0)])) as GameState["visits"],
    currentOrder,
    nextOrderId: Math.max(nonNegInt(r.nextOrderId, 2), (currentOrder?.id ?? 0) + 1),
    lastCustomerId: CUSTOMER_IDS.includes(r.lastCustomerId as never) ? (r.lastCustomerId as GameState["lastCustomerId"]) : null,
    servedCount: nonNegInt(r.servedCount, 0),
    blender: {
      contents: Array.isArray(blender.contents) ? blender.contents.filter(isIngredient).filter((i) => INGREDIENTS[i].station === "blender").slice(0, 4) : [],
      phase: oneOf(blender.phase, ["idle", "blending", "blended", "pouring"] as const, "idle"),
      endsAt: timestamp(blender.endsAt),
      result: isRecipe(blender.result) ? blender.result : null,
    },
    cup: isRecipe(r.cup) ? r.cup : null,
    coffee: {
      beans: Math.min(1, nonNegInt(coffee.beans, 0)),
      phase: oneOf(coffee.phase, ["idle", "brewing", "ready"] as const, "idle"),
      endsAt: timestamp(coffee.endsAt),
    },
    donut: {
      dough: Math.min(1, nonNegInt(donut.dough, 0)),
      phase: oneOf(donut.phase, ["idle", "frying", "fried", "decorated"] as const, "idle"),
      endsAt: timestamp(donut.endsAt),
    },
    bakery: {
      bowl: Array.isArray(bakery.bowl) ? [...new Set(bakery.bowl.filter(isIngredient).filter((i) => INGREDIENTS[i].station === "bakery"))] : [],
      bowlPhase: oneOf(bakery.bowlPhase, ["idle", "whisking", "whisked"] as const, "idle"),
      whiskEndsAt: timestamp(bakery.whiskEndsAt),
      tray: oneOf(bakery.tray, ["empty", "dough"] as const, "empty"),
      oven: oneOf(bakery.oven, ["idle", "baking", "done"] as const, "idle"),
      ovenEndsAt: timestamp(bakery.ovenEndsAt),
      croissants: nonNegInt(bakery.croissants, 0),
    },
    staff: Array.isArray(r.staff) ? [...new Set(r.staff.filter((s): s is StaffId => typeof s === "string" && s in STAFF))] : [],
    specials: Array.isArray(r.specials)
      ? r.specials
          .map(obj)
          .filter((s) => typeof s.name === "string" && isRecipe(s.recipeId) && typeof s.id === "number")
          .slice(0, 4)
          .map((s) => ({ id: s.id as number, name: (s.name as string).slice(0, 24), recipeId: s.recipeId as RecipeId }))
      : [],
    nextSpecialId: nonNegInt(r.nextSpecialId, 1),
    avatar: {
      gender: oneOf(avatar.gender, ["girl", "boy"] as const, d.avatar.gender),
      name: typeof avatar.name === "string" && avatar.name.trim() ? avatar.name.slice(0, 24) : d.avatar.name,
      skin: typeof avatar.skin === "string" && /^#[0-9a-f]{6}$/i.test(avatar.skin) ? avatar.skin : d.avatar.skin,
      hair: typeof avatar.hair === "string" && /^#[0-9a-f]{6}$/i.test(avatar.hair) ? avatar.hair : d.avatar.hair,
      apron: typeof avatar.apron === "string" && /^#[0-9a-f]{6}$/i.test(avatar.apron) ? avatar.apron : d.avatar.apron,
    },
    robber: { active: robber.active === true, lastAtServe: nonNegInt(robber.lastAtServe, 0), stopped: nonNegInt(robber.stopped, 0) },
    tutorial: { dismissed: tutorial.dismissed === true, completed: tutorial.completed === true },
    settings: { sound: settings.sound !== false },
    stats: { coinsEarned: nonNegInt(stats.coinsEarned, 0), rescues: nonNegInt(stats.rescues, 0) },
  };

  // Any timed phase without an end time is treated as just finished.
  if (state.blender.phase === "blending" || state.blender.phase === "pouring") state.blender.endsAt ??= 1;
  if (state.blender.phase !== "idle" && !state.blender.result) state.blender.result = "strawberrySmoothie";
  if (state.coffee.phase === "brewing") state.coffee.endsAt ??= 1;
  if (state.donut.phase === "frying") state.donut.endsAt ??= 1;
  if (state.bakery.bowlPhase === "whisking") state.bakery.whiskEndsAt ??= 1;
  if (state.bakery.oven === "baking") state.bakery.ovenEndsAt ??= 1;
  if (!state.specials.length) state.nextSpecialId = Math.max(1, state.nextSpecialId);
  else state.nextSpecialId = Math.max(state.nextSpecialId, ...state.specials.map((s) => s.id + 1));
  return state;
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** Parse a save and fast-forward any timers that finished while the page was closed. */
export function deserialize(json: string | null, now: number): GameState {
  if (!json) return createInitialState();
  try {
    return tick(sanitize(JSON.parse(json)), now).state;
  } catch {
    return createInitialState();
  }
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function loadGame(storage: StorageLike | undefined, now: number): GameState {
  try {
    return deserialize(storage?.getItem(SAVE_KEY) ?? null, now);
  } catch {
    return createInitialState();
  }
}

export function saveGame(storage: StorageLike | undefined, state: GameState): boolean {
  try {
    storage?.setItem(SAVE_KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function clearGame(storage: StorageLike | undefined) {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    /* storage unavailable */
  }
}
