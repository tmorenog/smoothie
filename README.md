# Smoothie Cat Café 🐱🍓

A cozy 3D café game for phones, tablets and desktops. Blend smoothies, brew coffee and bake croissants for a cast of cats. Cats include Mochi the tuxedo, Socks the brown tabby, Pineapple the orange tabby and Dan.

Built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS 4**, **Three.js** and **Motion**. There's no server, database, account or API key. Progress is saved in the browser's `localStorage`.

---

## Install and run

Requirements: Node.js 20.9 or newer and npm.

```bash
git clone https://github.com/tmorenog/smoothie.git
cd smoothie
npm install
npm run dev          # http://localhost:3000
```

Production build:

```bash
npm run build
npm run start        # http://localhost:3000
```

### Checks

```bash
npm run lint         # ESLint (next/core-web-vitals + TypeScript rules)
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit tests for the game engine
npm run build        # production build
npm run check        # all four of the above, in order
```

Browser tests (Playwright, Chromium). They cover desktop (1366×820), iPad Mini and Pixel 7:

```bash
npx playwright install chromium            # once, if you don't already have a Playwright Chromium
npm run test:e2e                           # builds, starts on :3123, runs all projects
npx playwright test --project=desktop      # one project only
BASE_URL=https://your-app.vercel.app npm run test:e2e   # run against a deployment
```

The e2e config starts Chromium with SwiftShader (`--use-gl=angle --use-angle=swiftshader`), so the real WebGL scene renders headlessly.

---

## How to play

### Your first order (the tutorial walks you through it)

You start with exactly **5 Smoothie Coins** and an empty inventory. **Mochi** (a tuxedo cat) orders a **Strawberry Smoothie**.

1. **Shop:** press **🛒 Shop** (it glows), then **Buy · 5🪙** next to Strawberry. You now have 0 coins and 1 strawberry.
2. **Inventory:** under *Your inventory: fruit*, **tap the strawberry** to drop it into the blender. You can also **drag** it onto the blender box or the 3D café, or focus it and press **Enter/Space**.
3. **ON:** press **⏻ ON**. The blender jiggles, the blades spin, and the strawberry pieces swirl and turn into a **light pink** smoothie.
4. **Pour:** press **Pour**. The jar tilts and a stream fills the cup on the counter.
5. **Serve:** press **Serve**. Mochi purrs, hearts float up, and you're paid **12 coins**.
6. Press **Welcome next customer**.

The tutorial highlights Shop → Inventory → ON → Pour → Serve. Press **Skip tutorial** to dismiss it. To see it again, use **? → Show tutorial tips again**. The **?** button always opens the full instructions.

### Recipes and prices

| Recipe | Ingredients (cost) | Pays | XP | Unlocks |
| --- | --- | --- | --- | --- |
| Strawberry Smoothie (light pink) | strawberry (5) | 12 | 10 | Level 1 |
| Banana Smoothie (creamy yellow) | banana (15) | 28 | 14 | Level 2 |
| Berry-Banana Sunrise (peachy orange) | strawberry + banana (20) | 38 | 18 | Level 3 |
| Sprinkle Donut 🍩 | donut dough (6) + pink sprinkles (2) | 22 | 15 | Level 5 |
| Fresh Coffee | coffee beans (8) | 24 | 20 | Level 10 |
| Butter Croissant ×2 per batch | egg (5) + flour (4) + wheat (3) + butter (6) | 30 each | 26 | Level 15 |

Colors mix: strawberry gives light pink, banana gives creamy yellow, and both together give peachy orange.

### Fixing mistakes

- **Wrong fruit in the blender?** Press **Take fruit out**. It all goes back to your inventory, so nothing is lost.
- **Blended the wrong smoothie?** **Rinse jar** before pouring, or pour it and either **Toss cup** or keep it for a later customer who orders it. Serving the wrong drink is refused politely, and the cup stays.
- **Out of coins for the current order?** A **Tip jar** button appears. The neighbours cover exactly the shortfall, so you're never stuck.
- Buttons disable while an animation runs, and the engine rejects repeated actions. Nothing can be served twice, paid twice or pushed below zero.

### Donut fryer (level 5) 🍩

1. Open the **🍩 Donuts** tab, which also opens automatically when a customer orders a donut.
2. Buy **donut dough** (6) and **pink sprinkles** (2) in the Shop.
3. Tap the dough to lower a ring into the fryer, then press **🍩 Fry**. The oil glows and bubbles while the donut turns golden (3 s).
4. Tap the **sprinkles** onto the hot donut. Pink glaze and rainbow sprinkles appear on a plate on the counter.
5. Press **Serve**. **Remove dough** / **Toss donut** undo mistakes. Sprinkles only work on a fried donut, and donut ingredients never go into the blender.

Luna the calico's favourite treat is a Sprinkle Donut.

### Coffee station (level 10)

1. Open the **☕ Coffee** tab, which appears automatically when a customer orders coffee.
2. Buy **coffee beans** (8 coins) in the Shop.
3. Tap the beans to load the machine, then press **☕ Brew**. Coffee drips into the mug and steams.
4. Press **Serve**. **Pour out** / **Remove beans** undo mistakes.

Coffee ingredients only go into the coffee machine, never the blender.

### Bakery: croissants (level 15)

1. Open the **🥐 Bakery** tab. Buy **egg** (5), **flour** (4), **wheat** (3) and **butter** (6).
2. Tap each one into the **mixing bowl**. The bowl accepts one of each and lists what's still missing.
3. Press **Whisk**, then **To tray**.
4. Press **Bake (1 min)**. The oven glows and the panel counts down the remaining seconds.
5. While it bakes, you can keep shopping, blending and serving. The oven's completion time is saved, so reloading or closing the tab doesn't reset it.
6. When it dings, press **Take out**. Each batch makes **2 croissants**. **Serve** one whenever a croissant is ordered.

Baking ingredients live in a separate *pantry* and only go into the mixing bowl.

### Café management (☰ button)

- **Staff:** hire named helpers with earned coins. Each one adds a service bonus to every order. You still make and serve every drink yourself.
  - **Hazel**, Greeter: 40 coins, level 3+, +1 coin per order
  - **Bean**, Barista: 90 coins, level 5+, +2 coins and +2 XP per order
  - **Clover**, Cashier: 150 coins, level 8+, +3 coins and +3 XP per order

  Hired staff appear as aproned cats on the back counter.
- **Menu specials:** name a special (e.g. "Pink Purrfection") and assign any recipe you've unlocked. Up to 4 specials. Customers order specials by name about 40% of the time, and a special pays a +3 coin bonus.
- **Your barista:** choose girl or boy, then set the name, apron color, skin tone and hair color. You appear behind the counter and in the top bar.
- **Regulars:** visit counts for every customer. **Regular** status comes at 3 visits (+1 tip). **⭐ VIP** comes at 5 visits (+25% tip, minimum 3 coins).
- **Settings:** sound toggle, and **Reset café…**, which asks for confirmation before erasing everything.

### The till bandit

Occasionally a masked bandit cat with a sack tiptoes toward the till. Serving pauses until you press **🔒 Secure the till**, and then the bandit slinks off empty-pawed. **Nothing is ever stolen.** The bandit can appear only after 4 orders, at most once every 5 orders, with a 20% chance per new customer.

### Customers

Mochi (tuxedo, white chest), Socks (brown tabby with dark brown markings and patches), and Pineapple (orange tabby) are there from the start. **Dan** (steel-grey, copper eyes) arrives at level 2, Luna (calico) at 4, Pepper (black) at 6, and Biscuit (cream colourpoint) at 8. The cats breathe, blink, twitch their ears, look around and sway their tails. A served cat squints happily, raises its tail and sends up hearts.

---

## Design notes and choices

- **Progression:** total XP for level *L* is `20·(L−1) + 5·(L−1)(L−2)/2`. Level 2 takes 20 XP (two strawberry orders), level 10 takes 360 XP, and level 15 takes 735 XP. Donuts unlock at 5, coffee at 10 and the bakery at 15, as specified. Bananas unlock at level 2 so the first few orders stay simple.
- **Affordability:** new orders are only drawn from recipes whose missing ingredients you can afford with your current coins and inventory (counting anything already in a station). Every recipe is profitable. If coins still run dry, the tip jar covers exactly the shortfall for the current order.
- **Fairness guards:** one active order at a time with unique increasing IDs. Serving changes the order to `served` and pays exactly once. Inventory is checked before every decrement. Every timed step (blend 2.6 s, pour 2 s, fry 3 s, brew 3.2 s, whisk 1.8 s, bake 60 s) is stored as an end timestamp and completed by `tick`, so repeated clicks and reloads can't duplicate anything.
- **Staff** give flat per-order bonuses rather than automating work, so the player always makes the drinks.
- **VIP** is based on visits so it rewards regular play: regular at 3 visits, VIP at 5.

## Architecture

```
app/                 Next.js App Router entry (static page, client-only game)
components/
  Game.tsx           Layout, top bar, order card, tutorial coach, action dock
  Stations.tsx       Blender / Coffee / Bakery panels, drag-or-tap ingredient chips
  Modals.tsx         Shop, Help, Manage (staff, specials, avatar, regulars, settings)
  Scene3D.tsx        Mounts the Three.js scene, falls back to Fallback2D without WebGL
  useGame.ts         State hook: dispatch, autosave, timers, toasts, sounds
lib/game/
  data.ts            Ingredients, recipes, customers, staff, durations
  engine.ts          Pure reducer (applyAction), levels, mixing, orders, tutorial
  persistence.ts     Validated localStorage save/load (timers fast-forward on load)
lib/scene/           Imperative Three.js: café room, blender, cup, donut fryer, coffee, oven, cats, avatar
lib/sound.ts         Synthesized Web Audio effects (no audio files)
tests/unit/          Vitest engine tests
tests/e2e/           Playwright browser tests
```

- **Accessibility:** all controls are HTML buttons with labels. You can play with the keyboard, using Tab, Enter/Space and Esc to close dialogs, and dialogs trap focus. Drag and drop is optional because tapping does the same thing. Messages are announced through a polite live region. The 3D canvas is decorative (`aria-hidden`), and the order card carries the information.
- **Reduced motion:** honours `prefers-reduced-motion`, which calms the camera, jiggle and tails, uses fade-only dialogs and stops the CSS pulses.
- **No WebGL?** The game automatically shows an illustrated 2D counter and stays fully playable. Force it with `/?nowebgl`.
- **Performance:** pixel ratio is capped at 1.25 on tablets, 1.75 on phones and 2 on desktop. The scene renders at full rate only while something animates (about 30 fps when idle), and pauses in background tabs. Customer and staff cats, the avatar, textures and the renderer are disposed when they're replaced or the scene unmounts.

---

## Deploying to Vercel

The app is a static Next.js page with no environment variables. Pick either option:

### Option A: Git import (recommended)

1. Push this repo to GitHub (`tmorenog/smoothie`).
2. Go to <https://vercel.com/new>, choose **Import Git Repository**, and select `tmorenog/smoothie`. Grant the Vercel GitHub app access to the repo if prompted.
3. Framework preset: **Next.js** (auto-detected). Leave the build command `next build`, the output setting and the install command `npm install` at their defaults. No environment variables are needed.
4. Click **Deploy**. Every later push to `main` deploys to production automatically.

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel link --yes --project smoothie    # in the repo root; creates .vercel/
vercel --prod                           # builds remotely and deploys to production
```

Or, non-interactively, with a token from <https://vercel.com/account/tokens>:

```bash
vercel pull --yes --environment=production --token "$VERCEL_TOKEN"
vercel build --prod --token "$VERCEL_TOKEN"
vercel deploy --prebuilt --prod --token "$VERCEL_TOKEN"
```

### After deploying

Open the production URL and play the first order. You can also run the browser suite against it:

```bash
BASE_URL=https://<your-project>.vercel.app npx playwright test --project=desktop first-order
```
