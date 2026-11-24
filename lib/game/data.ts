// Static game data: ingredients, recipes, customers, staff and timings.

export type IngredientId =
  | "strawberry"
  | "banana"
  | "coffeeBeans"
  | "egg"
  | "flour"
  | "wheat"
  | "butter";

/** Which station an ingredient belongs to. Stations never share contents. */
export type Station = "blender" | "coffee" | "bakery";

export type RecipeId =
  | "strawberrySmoothie"
  | "bananaSmoothie"
  | "sunriseSmoothie"
  | "coffee"
  | "croissant";

export type CustomerId =
  | "mochi"
  | "socks"
  | "pineapple"
  | "dan"
  | "luna"
  | "pepper"
  | "biscuit";

export type StaffId = "hazel" | "bean" | "clover";

export interface Ingredient {
  id: IngredientId;
  name: string;
  plural: string;
  price: number;
  station: Station;
  unlockLevel: number;
  emoji: string;
  color: string;
}

export const INGREDIENTS: Record<IngredientId, Ingredient> = {
  strawberry: {
    id: "strawberry",
    name: "Strawberry",
    plural: "Strawberries",
    price: 5,
    station: "blender",
    unlockLevel: 1,
    emoji: "🍓",
    color: "#e8435a",
  },
  banana: {
    id: "banana",
    name: "Banana",
    plural: "Bananas",
    price: 15,
    station: "blender",
    unlockLevel: 2,
    emoji: "🍌",
    color: "#f3d35b",
  },
  coffeeBeans: {
    id: "coffeeBeans",
    name: "Coffee beans",
    plural: "Coffee beans",
    price: 8,
    station: "coffee",
    unlockLevel: 10,
    emoji: "☕",
    color: "#5a3622",
  },
  egg: {
    id: "egg",
    name: "Egg",
    plural: "Eggs",
    price: 5,
    station: "bakery",
    unlockLevel: 15,
    emoji: "🥚",
    color: "#f4e7d0",
  },
  flour: {
    id: "flour",
    name: "Flour",
    plural: "Flour",
    price: 4,
    station: "bakery",
    unlockLevel: 15,
    emoji: "🌾",
    color: "#f2ede2",
  },
  wheat: {
    id: "wheat",
    name: "Wheat",
    plural: "Wheat",
    price: 3,
    station: "bakery",
    unlockLevel: 15,
    emoji: "🌿",
    color: "#d9b45a",
  },
  butter: {
    id: "butter",
    name: "Butter",
    plural: "Butter",
    price: 6,
    station: "bakery",
    unlockLevel: 15,
    emoji: "🧈",
    color: "#f6dc7d",
  },
};

export const INGREDIENT_IDS = Object.keys(INGREDIENTS) as IngredientId[];

export interface Recipe {
  id: RecipeId;
  name: string;
  station: Station;
  /** Exact ingredients needed (one of each listed id, `count` times). */
  ingredients: Partial<Record<IngredientId, number>>;
  price: number;
  xp: number;
  unlockLevel: number;
  /** Final colour of the drink or bake. */
  color: string;
  flavor: string;
  /** How many servings one batch makes. */
  batch: number;
}

export const RECIPES: Record<RecipeId, Recipe> = {
  strawberrySmoothie: {
    id: "strawberrySmoothie",
    name: "Strawberry Smoothie",
    station: "blender",
    ingredients: { strawberry: 1 },
    price: 12,
    xp: 10,
    unlockLevel: 1,
    color: "#f7b6c8",
    flavor: "sweet strawberry",
    batch: 1,
  },
  bananaSmoothie: {
    id: "bananaSmoothie",
    name: "Banana Smoothie",
    station: "blender",
    ingredients: { banana: 1 },
    price: 28,
    xp: 14,
    unlockLevel: 2,
    color: "#f6e4a6",
    flavor: "creamy banana",
    batch: 1,
  },
  sunriseSmoothie: {
    id: "sunriseSmoothie",
    name: "Berry-Banana Sunrise",
    station: "blender",
    ingredients: { strawberry: 1, banana: 1 },
    price: 38,
    xp: 18,
    unlockLevel: 3,
    color: "#f7a66e",
    flavor: "peachy strawberry-banana",
    batch: 1,
  },
  coffee: {
    id: "coffee",
    name: "Fresh Coffee",
    station: "coffee",
    ingredients: { coffeeBeans: 1 },
    price: 24,
    xp: 20,
    unlockLevel: 10,
    color: "#5b3a24",
    flavor: "toasty coffee",
    batch: 1,
  },
  croissant: {
    id: "croissant",
    name: "Butter Croissant",
    station: "bakery",
    ingredients: { egg: 1, flour: 1, wheat: 1, butter: 1 },
    price: 30,
    xp: 26,
    unlockLevel: 15,
    color: "#d9953f",
    flavor: "flaky butter",
    batch: 2,
  },
};

export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];

export interface CoatSpec {
  pattern: "tuxedo" | "tabby" | "solid" | "calico" | "point" | "bandit";
  base: string;
  belly: string;
  muzzle: string;
  paws: string;
  markings: string;
  patches: string[];
  eyes: string;
  nose: string;
  earInner: string;
  tailTip?: string;
}

export interface Customer {
  id: CustomerId;
  name: string;
  description: string;
  unlockLevel: number;
  coat: CoatSpec;
  favorite: RecipeId;
}

export const CUSTOMERS: Record<CustomerId, Customer> = {
  mochi: {
    id: "mochi",
    name: "Mochi",
    description: "Tuxedo cat with a bright white chest",
    unlockLevel: 1,
    favorite: "strawberrySmoothie",
    coat: {
      pattern: "tuxedo",
      base: "#1f1c21",
      belly: "#f7f4ee",
      muzzle: "#f7f4ee",
      paws: "#f7f4ee",
      markings: "#141216",
      patches: [],
      eyes: "#b9d64a",
      nose: "#e89aa6",
      earInner: "#d98c97",
    },
  },
  socks: {
    id: "socks",
    name: "Socks",
    description: "Brown tabby with dark brown stripes and patches",
    unlockLevel: 1,
    favorite: "bananaSmoothie",
    coat: {
      pattern: "tabby",
      base: "#8a6443",
      belly: "#b89068",
      muzzle: "#d7bb94",
      paws: "#e8dcc6",
      markings: "#3a2414",
      patches: ["#4d311d", "#5c3b22"],
      eyes: "#7fb24a",
      nose: "#b8645d",
      earInner: "#c98d7e",
    },
  },
  pineapple: {
    id: "pineapple",
    name: "Pineapple",
    description: "Orange tabby with a creamy chest",
    unlockLevel: 1,
    favorite: "sunriseSmoothie",
    coat: {
      pattern: "tabby",
      base: "#e38a3a",
      belly: "#f4cc95",
      muzzle: "#f8e0b8",
      paws: "#f4cc95",
      markings: "#b0521b",
      patches: [],
      eyes: "#e3a92e",
      nose: "#e5807a",
      earInner: "#f0a596",
    },
  },
  dan: {
    id: "dan",
    name: "Dan",
    description: "Steel-grey shorthair with copper eyes",
    unlockLevel: 2,
    favorite: "coffee",
    coat: {
      pattern: "solid",
      base: "#7d8590",
      belly: "#9aa1ab",
      muzzle: "#a7adb6",
      paws: "#8c939d",
      markings: "#646b75",
      patches: [],
      eyes: "#d98b2f",
      nose: "#6f6a73",
      earInner: "#b48f95",
    },
  },
  luna: {
    id: "luna",
    name: "Luna",
    description: "Calico with orange and black patches",
    unlockLevel: 4,
    favorite: "sunriseSmoothie",
    coat: {
      pattern: "calico",
      base: "#f5efe5",
      belly: "#fbf8f2",
      muzzle: "#fbf8f2",
      paws: "#fbf8f2",
      markings: "#2b2527",
      patches: ["#e08a3c", "#2b2527"],
      eyes: "#5fae6b",
      nose: "#ec9aa5",
      earInner: "#f1a9b2",
    },
  },
  pepper: {
    id: "pepper",
    name: "Pepper",
    description: "Sleek black cat with glowing green eyes",
    unlockLevel: 6,
    favorite: "coffee",
    coat: {
      pattern: "solid",
      base: "#19181b",
      belly: "#232126",
      muzzle: "#2a282d",
      paws: "#1d1c20",
      markings: "#101012",
      patches: [],
      eyes: "#8fe04f",
      nose: "#3a3236",
      earInner: "#5a4248",
    },
  },
  biscuit: {
    id: "biscuit",
    name: "Biscuit",
    description: "Cream colourpoint with chocolate ears and blue eyes",
    unlockLevel: 8,
    favorite: "croissant",
    coat: {
      pattern: "point",
      base: "#efdcc0",
      belly: "#f7ecd9",
      muzzle: "#6b4a35",
      paws: "#6b4a35",
      markings: "#6b4a35",
      patches: [],
      eyes: "#5aa7e6",
      nose: "#5a3c2c",
      earInner: "#8a6450",
      tailTip: "#6b4a35",
    },
  },
};

export const CUSTOMER_IDS = Object.keys(CUSTOMERS) as CustomerId[];

/** The playful till bandit. Never takes anything permanently. */
export const BANDIT_COAT: CoatSpec = {
  pattern: "bandit",
  base: "#8e8f96",
  belly: "#c9cad0",
  muzzle: "#e4e4e8",
  paws: "#3a3a40",
  markings: "#2a2a30",
  patches: [],
  eyes: "#f2c84b",
  nose: "#2a2a30",
  earInner: "#a9878e",
  tailTip: "#2a2a30",
};

export interface Staff {
  id: StaffId;
  name: string;
  role: string;
  cost: number;
  unlockLevel: number;
  /** Extra coins added to every order served. */
  coinBonus: number;
  /** Extra XP added to every order served. */
  xpBonus: number;
  perk: string;
  coat: CoatSpec;
  apron: string;
}

export const STAFF: Record<StaffId, Staff> = {
  hazel: {
    id: "hazel",
    name: "Hazel",
    role: "Greeter",
    cost: 40,
    unlockLevel: 3,
    coinBonus: 1,
    xpBonus: 0,
    perk: "+1 coin service bonus on every order",
    apron: "#e889a3",
    coat: { ...CUSTOMERS.luna.coat, pattern: "tabby", base: "#a7895f", markings: "#5d4428", patches: [], belly: "#e2d2b4", muzzle: "#eadbc0", paws: "#e2d2b4", eyes: "#79b356" },
  },
  bean: {
    id: "bean",
    name: "Bean",
    role: "Barista",
    cost: 90,
    unlockLevel: 5,
    coinBonus: 2,
    xpBonus: 2,
    perk: "+2 coins and +2 XP on every order",
    apron: "#7f9f7a",
    coat: { ...CUSTOMERS.dan.coat, base: "#3f3a38", belly: "#f3efe8", muzzle: "#f3efe8", paws: "#f3efe8", pattern: "tuxedo", eyes: "#e4b23c" },
  },
  clover: {
    id: "clover",
    name: "Clover",
    role: "Cashier",
    cost: 150,
    unlockLevel: 8,
    coinBonus: 3,
    xpBonus: 3,
    perk: "+3 coins and +3 XP on every order",
    apron: "#c9894b",
    coat: { ...CUSTOMERS.pineapple.coat, base: "#efe6d8", markings: "#c98f52", patches: ["#c98f52"], pattern: "calico", eyes: "#4f9fd6" },
  },
};

export const STAFF_IDS = Object.keys(STAFF) as StaffId[];

/** Durations (ms) for station animations. The oven is exactly one real minute. */
export const DURATIONS = {
  blend: 2600,
  pour: 2000,
  brew: 3200,
  whisk: 1800,
  bake: 60_000,
} as const;

export const BLENDER_CAPACITY = 4;
export const VIP_VISITS = 5;
export const REGULAR_VISITS = 3;
export const SPECIAL_BONUS = 3;
export const MAX_LEVEL = 30;
export const STARTING_COINS = 5;
export const MAX_SPECIALS = 4;
export const MAX_SPECIAL_NAME = 24;

export const LEVEL_UNLOCKS: { level: number; text: string }[] = [
  { level: 2, text: "Bananas, Banana Smoothie and new customer Dan" },
  { level: 3, text: "Berry-Banana Sunrise and staff hiring (Hazel)" },
  { level: 4, text: "New customer Luna" },
  { level: 5, text: "Barista Bean can be hired" },
  { level: 6, text: "New customer Pepper" },
  { level: 8, text: "Cashier Clover and new customer Biscuit" },
  { level: 10, text: "Coffee station and coffee beans" },
  { level: 15, text: "Bakery: eggs, flour, wheat, butter and croissants" },
];
