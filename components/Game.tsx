"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CUSTOMERS, RECIPES, type Station } from "@/lib/game/data";
import {
  canRescue,
  customerStatus,
  isStationUnlocked,
  levelProgress,
  missingCost,
  quoteOrder,
  tutorialStep,
  type Action,
  type GameState,
  type TutorialStep,
} from "@/lib/game/engine";
import type { PickTarget, SceneView } from "@/lib/scene/CafeScene";
import { AvatarFace, CatFace } from "./CatFace";
import { HelpModal, ManageModal, ShopModal, StatusBadge } from "./Modals";
import { Scene3D } from "./Scene3D";
import { BakeryPanel, BlenderPanel, CoffeePanel, DonutPanel, btnGhost, btnPrimary, btnSage, glow } from "./Stations";
import { useGame, type Toast } from "./useGame";

const TUTORIAL_TEXT: Record<Exclude<TutorialStep, null>, { step: string; text: string }> = {
  shop: { step: "Step 1 of 5", text: "Mochi wants a Strawberry Smoothie. Open the Shop and buy strawberries for 5 coins." },
  inventory: { step: "Step 2 of 5", text: "Tap the strawberry in your inventory to drop it in the blender (or drag it there)." },
  on: { step: "Step 3 of 5", text: "Press the ON button to start blending!" },
  blending: { step: "Step 3 of 5", text: "Whirr! Watch the fruit swirl and turn light pink…" },
  pour: { step: "Step 4 of 5", text: "Press Pour to fill the cup." },
  pouring: { step: "Step 4 of 5", text: "Pouring into the cup…" },
  serve: { step: "Step 5 of 5", text: "Press Serve to hand Mochi the smoothie." },
};

export default function Game() {
  const { state, dispatch: rawDispatch, toasts, announcement, reset } = useGame();
  const reduce = !!useReducedMotion();
  const [focus, setFocus] = useState<Station>(() => (state.currentOrder ? RECIPES[state.currentOrder.recipeId].station : "blender"));
  const [dragging, setDragging] = useState<Station | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState<null | "staff" | "you" | "settings">(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [insets, setInsets] = useState({ bottom: 0, right: 0 });
  const stackRef = useRef<HTMLDivElement>(null);

  // Measure how much of the café the HUD and drawer cover, so the 3D view can re-centre.
  useEffect(() => {
    const el = stackRef.current;
    if (!el) return;
    const measure = () => {
      const drawer = el.querySelector<HTMLElement>("#station-drawer");
      const total = el.getBoundingClientRect().height;
      const sideBySide = drawer ? drawer.getBoundingClientRect().width < el.getBoundingClientRect().width * 0.7 : false;
      const dH = drawer && sideBySide ? drawer.getBoundingClientRect().height : 0;
      const right = drawer && sideBySide ? drawer.getBoundingClientRect().width : 0;
      setInsets((p) => {
        const next = { bottom: Math.round(total - dH), right: Math.round(right) };
        return p.bottom === next.bottom && p.right === next.right ? p : next;
      });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: false });
    measure();
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  const dispatch = useCallback(
    (a: Action) => {
      const r = rawDispatch(a);
      // Jump to the station the new order needs, if it's unlocked.
      if (r.ok && a.type === "nextCustomer" && r.state.currentOrder) {
        const st = RECIPES[r.state.currentOrder.recipeId].station;
        if (isStationUnlocked(r.state, st)) setFocus(st);
      }
      return r;
    },
    [rawDispatch],
  );

  const tutorial = tutorialStep(state);
  const order = state.currentOrder;
  const happy = order?.status === "served";
  const view: SceneView = useMemo(() => ({ state, focus, reducedMotion: reduce, happy, insetBottom: insets.bottom, insetRight: insets.right }), [state, focus, reduce, happy, insets]);
  const lp = levelProgress(state.xp);

  const servable = !!order && order.status === "waiting" && (state.cup !== null || state.coffee.phase === "ready" || state.donut.phase === "decorated" || state.bakery.croissants > 0) && state.blender.phase !== "pouring";
  const rescue = canRescue(state);
  const needsStation = tutorial === "inventory" || tutorial === "on" || tutorial === "pour";

  // Tapping something in the 3D café: stations open their controls, the customer takes a ready order, the till locks.
  const onPick = useCallback(
    (target: PickTarget) => {
      if (target === "till") {
        if (state.robber.active) dispatch({ type: "secureTill" });
        return;
      }
      if (target === "customer") {
        if (servable && !state.robber.active) dispatch({ type: "serve", now: Date.now() });
        else if (order && order.status === "waiting" && isStationUnlocked(state, RECIPES[order.recipeId].station)) {
          setFocus(RECIPES[order.recipeId].station);
          setDrawerOpen(true);
        }
        return;
      }
      if (isStationUnlocked(state, target)) {
        setFocus(target);
        setDrawerOpen(true);
      }
    },
    [state, servable, order, dispatch],
  );

  return (
    <div className="flex h-[100svh] flex-col overflow-hidden bg-[#fbf6ee] text-[#3b2a22]">
      <TopBar state={state} level={lp} onHelp={() => setHelpOpen(true)} onManage={(t) => setManageOpen(t)} dispatch={dispatch} />

      <main className="relative min-h-0 flex-1 overflow-hidden bg-[#3a2a22]" data-dropzone="scene">
        {/* First-person 3D café fills the screen; tap a station to open its controls. */}
        <Scene3D view={view} onPick={onPick} />
        {order && <OrderCard state={state} />}
        {dragging && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#e8728f]/15 text-lg font-bold text-white">Drop to add</div>}

        {/* Bottom stack: toasts, alerts, tutorial, the hidden-by-default station drawer, and the floating action buttons */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div ref={stackRef} className="flex flex-col gap-2">
          <Toasts toasts={toasts} reduce={reduce} />
          {state.robber.active && (
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#3b2a22]/90 p-3 text-white shadow-xl" role="alert">
              <p className="text-sm font-semibold">🦝 A masked bandit is tiptoeing toward the till! Lock it up before you keep serving.</p>
              <button type="button" className={`${btnPrimary} min-h-11`} onClick={() => dispatch({ type: "secureTill" })}>
                🔒 Secure the till
              </button>
            </motion.div>
          )}
          {rescue && (
            <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-2xl bg-[#fde8ee]/95 p-3 shadow-lg ring-1 ring-[#f0c6d1]">
              <p className="text-sm">Short on coins for this order? The neighbours will chip in {order ? missingCost(state, order.recipeId) - state.coins : 0}.</p>
              <button type="button" className={`${btnPrimary} min-h-11 text-sm`} onClick={() => dispatch({ type: "rescue" })}>
                Tip jar
              </button>
            </div>
          )}
          {tutorial && !drawerOpen && (
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-[#3b2a22]/90 p-2.5 text-white shadow-lg" data-testid="tutorial" aria-live="polite">
              <span className="text-xl" aria-hidden>
                🐾
              </span>
              <p className="flex-1 text-sm leading-snug">
                <span className="mr-1 text-xs font-bold uppercase tracking-wide text-[#f7b6c8]">{TUTORIAL_TEXT[tutorial].step}:</span>
                {needsStation && !drawerOpen ? "Tap the blender in front of you (or the 🧰 Station button). " : ""}
                {TUTORIAL_TEXT[tutorial].text}
              </p>
              <button type="button" className="min-h-11 shrink-0 rounded-xl px-2 text-xs font-bold underline" onClick={() => dispatch({ type: "dismissTutorial" })}>
                Skip tutorial
              </button>
            </div>
          )}

          <AnimatePresence>
            {drawerOpen && (
              <motion.section
                key="drawer"
                id="station-drawer"
                aria-label="Café controls"
                role="region"
                initial={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
                transition={{ type: "spring", damping: 28, stiffness: 320 }}
                className="pointer-events-auto flex max-h-[52svh] w-full flex-col overflow-hidden rounded-3xl bg-[#fbf6ee]/97 shadow-2xl ring-1 ring-[#eadccb] backdrop-blur landscape:max-h-[calc(100svh-10rem)] landscape:w-[min(430px,55vw)] landscape:self-end lg:max-h-[calc(100svh-10rem)] lg:w-[430px] lg:self-end"
              >
                <div className="flex items-center gap-2 border-b border-[#eadccb] px-3 py-2">
                  <div className="flex-1">
                    <StationTabs state={state} focus={focus} setFocus={setFocus} />
                  </div>
                  <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-lg ring-1 ring-[#eadccb]" aria-label="Hide station controls" onClick={() => setDrawerOpen(false)}>
                    ▾
                  </button>
                </div>
                {tutorial && (
                  <p className="border-b border-[#eadccb] bg-[#3b2a22] px-3 py-1.5 text-xs text-white" data-testid="tutorial" aria-live="polite">
                    <span className="font-bold text-[#f7b6c8]">{TUTORIAL_TEXT[tutorial].step}:</span> {TUTORIAL_TEXT[tutorial].text}{" "}
                    <button type="button" className="ml-1 underline" onClick={() => dispatch({ type: "dismissTutorial" })}>
                      Skip tutorial
                    </button>
                  </p>
                )}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3" role="tabpanel" id={`panel-${focus}`} aria-labelledby={`tab-${focus}`}>
                  {focus === "blender" && <BlenderPanel state={state} dispatch={dispatch} tutorial={tutorial} dragging={dragging} onDragState={setDragging} />}
                  {focus === "donut" && <DonutPanel state={state} dispatch={dispatch} dragging={dragging} onDragState={setDragging} />}
                  {focus === "coffee" && <CoffeePanel state={state} dispatch={dispatch} dragging={dragging} onDragState={setDragging} />}
                  {focus === "bakery" && <BakeryPanel state={state} dispatch={dispatch} dragging={dragging} onDragState={setDragging} />}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <nav aria-label="Main actions" className="pointer-events-auto grid grid-cols-4 gap-2 self-center rounded-3xl bg-[#3b2a22]/55 p-2 shadow-xl backdrop-blur-sm sm:w-[34rem]">
            <button type="button" className={`${btnGhost} px-2 text-sm${glow(tutorial === "shop")}`} data-tutorial="shop" onClick={() => setShopOpen(true)}>
              🛒 Shop
            </button>
            <button
              type="button"
              className={`${btnGhost} px-2 text-sm${glow(needsStation && !drawerOpen)}`}
              aria-expanded={drawerOpen}
              aria-controls="station-drawer"
              aria-label={drawerOpen ? "Hide station controls" : "Open station controls"}
              onClick={() => setDrawerOpen((o) => !o)}
            >
              🧰 Station
            </button>
            <button type="button" className={`${btnPrimary} px-2 text-sm${glow(tutorial === "serve")}`} data-tutorial="serve" disabled={!servable || state.robber.active} onClick={() => dispatch({ type: "serve", now: Date.now() })}>
              Serve
            </button>
            <button type="button" className={`${btnSage} px-1 text-xs leading-tight`} disabled={!happy || state.robber.active} onClick={() => dispatch({ type: "nextCustomer", rand: [Math.random(), Math.random(), Math.random(), Math.random(), Math.random()] })}>
              Welcome next customer
            </button>
          </nav>
          </div>
        </div>
      </main>

            <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <ShopModal open={shopOpen} onClose={() => setShopOpen(false)} state={state} dispatch={dispatch} tutorial={tutorial} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} dispatch={dispatch} />
      {manageOpen && <ManageModal open onClose={() => setManageOpen(null)} state={state} dispatch={dispatch} onReset={reset} initialTab={manageOpen} />}
    </div>
  );
}

function TopBar({ state, level, onHelp, onManage, dispatch }: { state: GameState; level: ReturnType<typeof levelProgress>; onHelp: () => void; onManage: (t: "staff" | "you" | "settings") => void; dispatch: (a: Action) => unknown }) {
  const iconBtn = "grid h-11 w-11 place-items-center rounded-full bg-white text-lg shadow-sm ring-1 ring-[#eadccb] hover:bg-[#fdf3ea] focus-visible:outline-4 focus-visible:outline-[#3b2a22]";
  return (
    <header className="flex items-center gap-2 border-b border-[#eadccb] bg-[#f6ede2] px-3 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))]">
      <button type="button" onClick={() => onManage("you")} className="flex items-center gap-2 rounded-full pr-2 hover:bg-white/70 focus-visible:outline-4 focus-visible:outline-[#3b2a22]" aria-label={`Your barista ${state.avatar.name}. Customize`}>
        <AvatarFace {...state.avatar} size={40} />
        <span className="hidden flex-col text-left leading-tight sm:flex">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#7a5a44]">Smoothie Cat Café</span>
          <span className="text-sm font-bold">{state.avatar.name}</span>
        </span>
      </button>
      <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 font-extrabold shadow-sm ring-1 ring-[#eadccb]" aria-label={`${state.coins} Smoothie Coins`}>
        <span aria-hidden>🪙</span>
        <span data-testid="coins">{state.coins}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2" aria-label={`Level ${level.level}, ${level.current} of ${level.needed} XP to next level`}>
        <span className="shrink-0 rounded-full bg-[#7f9f7a] px-2.5 py-1 text-sm font-extrabold text-white" data-testid="level">
          Lv {level.level}
        </span>
        <div className="h-2.5 min-w-10 flex-1 overflow-hidden rounded-full bg-white ring-1 ring-[#eadccb]" role="progressbar" aria-label="Progress to next level" aria-valuenow={level.current} aria-valuemin={0} aria-valuemax={level.needed}>
          <div className="h-full rounded-full bg-[#e8728f] transition-[width] duration-500" style={{ width: `${Math.round(level.fraction * 100)}%` }} />
        </div>
        <span className="hidden shrink-0 text-xs text-[#7a5a44] md:inline">
          {level.current}/{level.needed} XP
        </span>
      </div>
      <button type="button" className={iconBtn} aria-label={state.settings.sound ? "Sound on. Mute" : "Sound off. Unmute"} aria-pressed={state.settings.sound} onClick={() => dispatch({ type: "toggleSound" })}>
        {state.settings.sound ? "🔊" : "🔇"}
      </button>
      <button type="button" className={iconBtn} aria-label="How to play" onClick={onHelp}>
        ?
      </button>
      <button type="button" className={iconBtn} aria-label="Manage café: staff, specials, avatar, settings" onClick={() => onManage("staff")}>
        ☰
      </button>
    </header>
  );
}

function OrderCard({ state }: { state: GameState }) {
  const order = state.currentOrder!;
  const c = CUSTOMERS[order.customerId];
  const status = customerStatus(state.visits[order.customerId]);
  const recipe = RECIPES[order.recipeId];
  const quote = quoteOrder(state, order);
  return (
    <motion.section key={order.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute left-2 top-2 flex max-w-[min(22rem,calc(100%-1rem))] items-center gap-2 rounded-2xl bg-[#fbf6ee]/95 p-2 pr-3 shadow-lg ring-1 ring-[#eadccb]" aria-label="Current order" data-testid="order-card">
      <CatFace coat={c.coat} size={52} happy={order.status === "served"} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5 font-extrabold">
          <span data-testid="customer-name">{c.name}</span>
          {status !== "new" && <StatusBadge status={status} />}
          <span className="text-xs font-normal text-[#7a5a44]">visits: {state.visits[order.customerId]}</span>
        </p>
        {order.status === "waiting" ? (
          <p className="text-sm" data-testid="order-text">
            Orders {order.specialName ? <strong>&ldquo;{order.specialName}&rdquo; ({recipe.name})</strong> : <strong>{recipe.name}</strong>} <span className="whitespace-nowrap">· pays {quote.total}🪙</span>
          </p>
        ) : (
          <p className="text-sm font-semibold text-[#4d6b49]" data-testid="order-text">
            Purr! Paid {order.paid}🪙{order.tip ? ` (tip ${order.tip})` : ""}. Thank you!
          </p>
        )}
      </div>
    </motion.section>
  );
}

function StationTabs({ state, focus, setFocus }: { state: GameState; focus: Station; setFocus: (s: Station) => void }) {
  const tabs: [Station, string, number][] = [
    ["blender", "🍓 Blender", 1],
    ["donut", "🍩 Donuts", 5],
    ["coffee", "☕ Coffee", 10],
    ["bakery", "🥐 Bakery", 15],
  ];
  return (
    <div role="tablist" aria-label="Stations" className="grid grid-cols-4 gap-1 rounded-2xl bg-[#f0e3d4] p-1">
      {tabs.map(([id, label, lvl]) => {
        const unlocked = isStationUnlocked(state, id);
        return (
          <button
            key={id}
            id={`tab-${id}`}
            type="button"
            role="tab"
            aria-selected={focus === id}
            aria-controls={`panel-${id}`}
            disabled={!unlocked}
            onClick={() => setFocus(id)}
            className={`min-h-11 rounded-xl px-1 text-xs font-bold sm:text-sm transition focus-visible:outline-4 focus-visible:outline-[#3b2a22] ${focus === id ? "bg-white shadow-sm" : "text-[#7a5a44]"} disabled:opacity-60`}
          >
            {unlocked ? label : `🔒 Lv ${lvl}`}
          </button>
        );
      })}
    </div>
  );
}

function Toasts({ toasts, reduce }: { toasts: Toast[]; reduce: boolean }) {
  return (
    <div className="pointer-events-none flex flex-col items-center gap-2" aria-hidden="true">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`max-w-md rounded-2xl px-4 py-2 text-center text-sm font-semibold shadow-lg ${t.tone === "error" ? "bg-[#3b2a22] text-white" : t.tone === "celebrate" ? "bg-[#f2c84b] text-[#3b2a22]" : "bg-white text-[#3b2a22] ring-1 ring-[#eadccb]"}`}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
