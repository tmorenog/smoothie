"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CUSTOMERS, INGREDIENTS, INGREDIENT_IDS, LEVEL_UNLOCKS, MAX_SPECIALS, RECIPES, RECIPE_IDS, STAFF, STAFF_IDS, VIP_VISITS, REGULAR_VISITS, type Station } from "@/lib/game/data";
import { customerStatus, getLevel, isIngredientUnlocked, isRecipeUnlocked, unlockedCustomers, type Action, type Avatar, type GameState, type TutorialStep } from "@/lib/game/engine";
import { AvatarFace, CatFace } from "./CatFace";
import { ProductArt } from "./ShopArt";
import { btnGhost, btnPrimary, btnSage, glow } from "./Stations";

type Dispatch = (a: Action) => unknown;

export function Modal({ open, onClose, title, children, wide = false, bare = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; bare?: boolean }) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  // Keep the latest onClose without re-running the open/close effect on every render.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>("[data-autofocus], button, input, select");
      first?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab" && panel.current) {
        const f = [...panel.current.querySelectorAll<HTMLElement>("button:not([disabled]), input, select, [tabindex='0']")];
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      returnFocus.current?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-[#3b2a22]/45 p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && closeRef.current()}>
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={bare ? undefined : titleId}
            aria-label={bare ? title : undefined}
            className={`flex w-full flex-col overflow-hidden shadow-2xl ${bare ? "h-[100svh] bg-[#5e3d27] sm:h-auto sm:max-h-[94svh] sm:max-w-4xl sm:rounded-3xl" : `max-h-[92svh] rounded-t-3xl bg-[#fbf6ee] sm:rounded-3xl ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}`}
            initial={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
          >
            {bare ? (
              children
            ) : (
              <>
            <div className="flex items-center justify-between border-b border-[#eadccb] px-5 py-3">
              <h2 id={titleId} className="text-xl font-extrabold text-[#3b2a22]">
                {title}
              </h2>
              <button type="button" onClick={onClose} className={`${btnGhost} min-h-11 min-w-11 px-3`} aria-label={`Close ${title}`}>
                ✕
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


const SHELVES: { station: Station; label: string; crate: string }[] = [
  { station: "blender", label: "Fresh fruit", crate: "#b98552" },
  { station: "donut", label: "Donut corner", crate: "#c98f9f" },
  { station: "coffee", label: "Coffee roastery", crate: "#7a5038" },
  { station: "bakery", label: "Baking pantry", crate: "#a88b62" },
];

const GREETINGS = ["Fresh strawberries today, picked this morning!", "Mind the paws on the produce, dear.", "Everything's priced on the little tags.", "Back again? I saved you the ripest fruit."];

function ShopItem({ id, state, dispatch, highlight, onBought }: { id: (typeof INGREDIENT_IDS)[number]; state: GameState; dispatch: Dispatch; highlight: boolean; onBought: (text: string) => void }) {
  const ing = INGREDIENTS[id];
  const [qty, setQty] = useState(1);
  const unlocked = isIngredientUnlocked(state, id);
  const total = ing.price * qty;
  const label = qty === 1 ? `Buy ${ing.name.toLowerCase()} for ${total} coins` : `Buy ${qty} ${ing.plural.toLowerCase()} for ${total} coins`;
  const shelf = SHELVES.find((x) => x.station === ing.station)!;
  return (
    <li className="relative flex w-[9.5rem] shrink-0 flex-col items-center sm:w-40" data-testid={`shop-item-${id}`}>
      {/* crate */}
      <div className="relative grid h-28 w-full place-items-center rounded-t-xl border-b-4 border-black/20 pt-2" style={{ background: `repeating-linear-gradient(90deg, ${shelf.crate} 0 18px, color-mix(in srgb, ${shelf.crate} 82%, black) 18px 20px)` }}>
        <div className={unlocked ? "drop-shadow-[0_6px_4px_rgba(0,0,0,0.35)]" : "opacity-40 grayscale"}>
          <ProductArt id={id} size={84} />
        </div>
        {/* hanging price tag */}
        <div className="absolute -right-1 -top-1 rotate-6 rounded-md bg-[#fbf6ee] px-2 py-0.5 text-center shadow-md ring-1 ring-[#d9c9b2]">
          <span className="block text-[10px] font-semibold uppercase text-[#7a5a44]">each</span>
          <span className="block text-sm font-extrabold text-[#c94f6d]">{ing.price}🪙</span>
        </div>
        {!unlocked && (
          <div className="absolute inset-x-2 bottom-2 rounded bg-[#3b2a22]/85 px-1 py-0.5 text-center text-[11px] font-bold text-white">Arriving at level {ing.unlockLevel}</div>
        )}
      </div>
      <div className="w-full rounded-b-xl bg-[#fbf6ee] p-2 text-center shadow-inner">
        <p className="text-sm font-extrabold leading-tight text-[#3b2a22]">{ing.name}</p>
        <p className="text-[11px] text-[#7a5a44]">In your pantry: {state.inventory[id]}</p>
        {unlocked && (
          <>
            <div className="mt-1.5 flex items-center justify-center gap-1" role="group" aria-label={`${ing.name} quantity`}>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-white text-lg font-bold ring-1 ring-[#eadccb] disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label={`One fewer ${ing.name.toLowerCase()}`}>
                −
              </button>
              <span className="w-7 text-center font-extrabold" aria-live="polite">
                {qty}
              </span>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-white text-lg font-bold ring-1 ring-[#eadccb] disabled:opacity-40" onClick={() => setQty((q) => Math.min(9, q + 1))} disabled={qty >= 9} aria-label={`One more ${ing.name.toLowerCase()}`}>
                +
              </button>
            </div>
            <button
              type="button"
              className={`${btnPrimary} mt-1.5 min-h-11 w-full px-2 text-sm${glow(highlight)}`}
              disabled={state.coins < total}
              aria-label={label}
              onClick={() => {
                const r = dispatch({ type: "buy", ingredient: id, qty }) as { ok: boolean };
                if (r.ok) {
                  onBought(`${qty} × ${ing.name} — ${total}🪙`);
                  setQty(1);
                }
              }}
            >
              Buy · {total}🪙
            </button>
          </>
        )}
      </div>
    </li>
  );
}

export function ShopModal({ open, onClose, state, dispatch, tutorial }: { open: boolean; onClose: () => void; state: GameState; dispatch: Dispatch; tutorial: TutorialStep }) {
  const [receipt, setReceipt] = useState<string[]>([]);
  const greeting = GREETINGS[state.servedCount % GREETINGS.length];
  const close = () => {
    setReceipt([]);
    onClose();
  };
  return (
    <Modal open={open} onClose={close} title="Whiskers' Market, the ingredient shop" bare>
      {/* awning */}
      <div aria-hidden className="h-6 shrink-0 bg-[repeating-linear-gradient(90deg,#e8728f_0_28px,#fbf6ee_28px_56px)] [mask-image:radial-gradient(circle_at_14px_100%,transparent_8px,black_9px)] [mask-size:28px_100%]" />
      <header className="flex shrink-0 items-center gap-3 bg-[#5e3d27] px-4 pb-3 pt-1 text-[#fbf6ee]">
        <CatFace coat={CUSTOMERS.socks.coat} size={56} />
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-xl font-extrabold tracking-wide">Whiskers&apos; Market</h2>
          <p className="truncate text-sm italic text-[#f3e2bd]">&ldquo;{greeting}&rdquo;</p>
        </div>
        <div className="rounded-xl bg-[#fbf6ee] px-3 py-1.5 text-right text-[#3b2a22] shadow-inner" aria-label={`Your wallet: ${state.coins} coins`}>
          <span className="block text-[10px] font-bold uppercase text-[#7a5a44]">Wallet</span>
          <span className="font-extrabold" data-testid="shop-coins">
            {state.coins}🪙
          </span>
        </div>
        <button type="button" onClick={close} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fbf6ee] text-[#3b2a22]" aria-label="Close the market">
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[linear-gradient(#9fb89a,#8aa685)] px-3 py-4">
        {SHELVES.map(({ station, label }) => (
          <section key={station} className="mb-5" aria-label={label}>
            <h3 className="mb-1 inline-block rounded-md bg-[#2f3b33] px-3 py-1 font-serif text-sm font-bold text-[#f4efe4] shadow">{label}</h3>
            <ul className="flex gap-3 overflow-x-auto px-1 pb-1 pt-2">
              {INGREDIENT_IDS.filter((id) => INGREDIENTS[id].station === station).map((id) => (
                <ShopItem key={id} id={id} state={state} dispatch={dispatch} highlight={tutorial === "shop" && id === "strawberry"} onBought={(t) => setReceipt((r) => [...r.slice(-3), t])} />
              ))}
            </ul>
            {/* wooden shelf plank */}
            <div aria-hidden className="h-3 rounded-sm bg-gradient-to-b from-[#a8703f] to-[#6b4428] shadow-[0_6px_8px_rgba(0,0,0,0.25)]" />
          </section>
        ))}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t-4 border-[#3b2a22]/30 bg-[#a8703f] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1 rounded-md bg-[#fbf6ee] px-3 py-1.5 font-mono text-xs text-[#3b2a22] shadow-inner" aria-live="polite" data-testid="receipt">
          <span className="font-bold">RECEIPT</span> {receipt.length ? receipt.join(" · ") : "— nothing yet —"}
        </div>
        <button type="button" className={btnSage} onClick={close}>
          Back to the counter
        </button>
      </footer>
    </Modal>
  );
}

export function HelpModal({ open, onClose, dispatch }: { open: boolean; onClose: () => void; dispatch: Dispatch }) {
  return (
    <Modal open={open} onClose={onClose} title="How to play" wide>
      <div className="space-y-4 text-[#3b2a22]">
        <section>
          <h3 className="font-extrabold">Your first order</h3>
          <ol className="ml-5 list-decimal space-y-1 text-sm">
            <li>
              Open the <strong>Shop</strong> and buy strawberries for 5 coins.
            </li>
            <li>
              In <strong>Your inventory</strong>, tap the strawberry (or drag it onto the blender) to drop it in.
            </li>
            <li>
              Press <strong>ON</strong>. Watch the fruit swirl into a light pink smoothie.
            </li>
            <li>
              Press <strong>Pour</strong> to fill the cup, then <strong>Serve</strong>. Mochi pays you!
            </li>
            <li>
              Press <strong>Welcome next customer</strong>.
            </li>
          </ol>
        </section>
        <section>
          <h3 className="font-extrabold">Recipes</h3>
          <ul className="ml-5 list-disc text-sm">
            {RECIPE_IDS.map((id) => (
              <li key={id}>
                <strong>{RECIPES[id].name}</strong> (level {RECIPES[id].unlockLevel}): {Object.keys(RECIPES[id].ingredients).map((i) => INGREDIENTS[i as keyof typeof INGREDIENTS].name.toLowerCase()).join(" + ")} → pays {RECIPES[id].price}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="font-extrabold">Mistakes happen</h3>
          <p className="text-sm">
            Before blending, <em>Take fruit out</em> returns it to your inventory. A wrong smoothie can be kept for a later customer, or tossed. If you run out of coins for an order, the
            neighbourhood <em>tip jar</em> covers the shortfall.
          </p>
        </section>
        <section>
          <h3 className="font-extrabold">Donuts (level 5)</h3>
          <p className="text-sm">
            Buy donut dough and pink sprinkles. Tap the dough into the fryer, press <em>Fry</em>, then tap the sprinkles onto the hot donut and <em>Serve</em>. <em>Toss donut</em> undoes mistakes.
          </p>
        </section>
        <section>
          <h3 className="font-extrabold">Coffee (level 10) &amp; Bakery (level 15)</h3>
          <p className="text-sm">
            Coffee: buy beans, add them to the coffee machine, press <em>Brew</em>, then <em>Serve</em>. Croissants: add egg, flour, wheat and butter to the bowl, <em>Whisk</em>, move it
            <em> To tray</em>, then <em>Bake</em> for one real minute. Each batch makes 2 croissants. Keep playing while it bakes.
          </p>
        </section>
        <section>
          <h3 className="font-extrabold">Regulars, staff &amp; bandits</h3>
          <p className="text-sm">
            Customers become regulars after {REGULAR_VISITS} visits (+1 tip) and VIPs after {VIP_VISITS} (+25% tip, ⭐ badge). Hire staff in the Café menu for a bonus on every order. If a
            masked bandit sneaks up, press <em>Secure the till</em>. Nothing is ever stolen.
          </p>
        </section>
        <section>
          <h3 className="font-extrabold">Controls</h3>
          <p className="text-sm">Everything works with touch, mouse or keyboard (Tab, Enter, Space). Drag and drop is optional: tapping an ingredient adds it.</p>
        </section>
        <section>
          <h3 className="font-extrabold">Unlocks</h3>
          <ul className="ml-5 list-disc text-sm">
            {LEVEL_UNLOCKS.map((u) => (
              <li key={u.level}>
                Level {u.level}: {u.text}
              </li>
            ))}
          </ul>
        </section>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnPrimary}
            onClick={() => {
              dispatch({ type: "restartTutorial" });
              onClose();
            }}
          >
            Show tutorial tips again
          </button>
          <button type="button" className={btnGhost} onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </Modal>
  );
}

const SKINS = ["#f6d3b8", "#e8b99a", "#c98e6a", "#9a6646", "#6b4430"];
const HAIRS = ["#2b1d16", "#5a3825", "#a5693a", "#e2b462", "#c2463a", "#7b7f8a"];
const APRONS = ["#e8728f", "#7f9f7a", "#c9894b", "#6f8fc9", "#a77bc9", "#3b2a22"];

function Swatches({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={`${label} ${c}`}
            onClick={() => onChange(c)}
            className={`h-11 w-11 rounded-full ring-offset-2 transition focus-visible:outline-4 focus-visible:outline-[#3b2a22] ${value === c ? "ring-4 ring-[#3b2a22]" : "ring-1 ring-[#eadccb]"}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </fieldset>
  );
}

type ManageTab = "staff" | "menu" | "you" | "regulars" | "settings";

export function ManageModal({ open, onClose, state, dispatch, onReset, initialTab = "staff" }: { open: boolean; onClose: () => void; state: GameState; dispatch: Dispatch; onReset: () => void; initialTab?: ManageTab }) {
  const [tab, setTab] = useState<ManageTab>(initialTab);
  const [confirmReset, setConfirmReset] = useState(false);
  const [specialName, setSpecialName] = useState("");
  const [specialRecipe, setSpecialRecipe] = useState<(typeof RECIPE_IDS)[number]>("strawberrySmoothie");
  const [nameDraft, setNameDraft] = useState(state.avatar.name);
  const level = getLevel(state);
  const setAvatar = (a: Partial<Avatar>) => dispatch({ type: "setAvatar", avatar: a });
  const tabs: [ManageTab, string][] = [
    ["staff", "Staff"],
    ["menu", "Menu specials"],
    ["you", "Your barista"],
    ["regulars", "Regulars"],
    ["settings", "Settings"],
  ];

  return (
    <Modal open={open} onClose={onClose} title="Manage your café" wide>
      <div role="tablist" aria-label="Café management" className="-mx-1 mb-4 flex gap-1 overflow-x-auto pb-1">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab === id ? "bg-[#3b2a22] text-white" : "bg-white text-[#3b2a22] ring-1 ring-[#eadccb]"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "staff" && (
        <div role="tabpanel" className="space-y-3">
          <p className="text-sm text-[#7a5a44]">Staff add a service bonus to every order. You still make and serve every drink yourself.</p>
          {STAFF_IDS.map((id) => {
            const st = STAFF[id];
            const hired = state.staff.includes(id);
            const locked = level < st.unlockLevel;
            return (
              <div key={id} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-[#eadccb]">
                <CatFace coat={st.coat} size={52} />
                <div className="flex-1">
                  <p className="font-bold">
                    {st.name} <span className="text-sm font-normal text-[#7a5a44]">· {st.role}</span>
                  </p>
                  <p className="text-sm text-[#7a5a44]">{st.perk}</p>
                </div>
                {hired ? (
                  <span className="rounded-full bg-[#dfe9da] px-3 py-1 text-sm font-bold text-[#4d6b49]">On the team</span>
                ) : (
                  <button type="button" className={`${btnPrimary} min-h-11 text-sm`} disabled={locked || state.coins < st.cost} onClick={() => dispatch({ type: "hire", staffId: id })} aria-label={`Hire ${st.name} for ${st.cost} coins`}>
                    {locked ? `🔒 Lv ${st.unlockLevel}` : `Hire · ${st.cost}🪙`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "menu" && (
        <div role="tabpanel" className="space-y-3">
          <p className="text-sm text-[#7a5a44]">Name a special and pick an unlocked recipe. Customers will order it by name (+3 coin bonus).</p>
          <form
            className="flex flex-col gap-2 rounded-2xl bg-white p-3 ring-1 ring-[#eadccb] sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              const r = dispatch({ type: "addSpecial", name: specialName, recipeId: specialRecipe }) as { ok: boolean };
              if (r.ok) setSpecialName("");
            }}
          >
            <label className="flex flex-1 flex-col text-sm font-bold">
              Special name
              <input value={specialName} onChange={(e) => setSpecialName(e.target.value)} maxLength={24} placeholder="Pink Purrfection" className="mt-1 min-h-11 rounded-xl border border-[#eadccb] px-3 font-normal" />
            </label>
            <label className="flex flex-col text-sm font-bold">
              Recipe
              <select value={specialRecipe} onChange={(e) => setSpecialRecipe(e.target.value as typeof specialRecipe)} className="mt-1 min-h-11 rounded-xl border border-[#eadccb] bg-white px-3 font-normal">
                {RECIPE_IDS.filter((id) => isRecipeUnlocked(state, id)).map((id) => (
                  <option key={id} value={id}>
                    {RECIPES[id].name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={btnSage} disabled={state.specials.length >= MAX_SPECIALS}>
              Add to menu
            </button>
          </form>
          {state.specials.length === 0 ? (
            <p className="text-sm text-[#7a5a44]">No specials yet.</p>
          ) : (
            <ul className="space-y-2">
              {state.specials.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-2xl bg-white p-3 ring-1 ring-[#eadccb]">
                  <span>
                    <strong>&ldquo;{s.name}&rdquo;</strong> <span className="text-sm text-[#7a5a44]">— {RECIPES[s.recipeId].name}</span>
                  </span>
                  <button type="button" className={`${btnGhost} min-h-10 text-sm`} onClick={() => dispatch({ type: "removeSpecial", id: s.id })} aria-label={`Remove ${s.name}`}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "you" && (
        <div role="tabpanel" className="space-y-4">
          <div className="flex items-center gap-3">
            <AvatarFace {...state.avatar} size={72} />
            <p className="text-sm text-[#7a5a44]">This is you behind the counter. Changes save instantly.</p>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-bold">Barista</legend>
            <div className="flex gap-2" role="radiogroup" aria-label="Barista">
              {(["girl", "boy"] as const).map((g) => (
                <button key={g} type="button" role="radio" aria-checked={state.avatar.gender === g} onClick={() => setAvatar({ gender: g })} className={`${state.avatar.gender === g ? btnPrimary : btnGhost} flex-1`}>
                  {g === "girl" ? "Girl" : "Boy"}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col text-sm font-bold">
            Name
            <input
              value={nameDraft}
              maxLength={24}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => setAvatar({ name: nameDraft })}
              onKeyDown={(e) => e.key === "Enter" && setAvatar({ name: nameDraft })}
              className="mt-1 min-h-11 rounded-xl border border-[#eadccb] px-3 font-normal"
            />
          </label>
          <Swatches label="Apron color" value={state.avatar.apron} options={APRONS} onChange={(c) => setAvatar({ apron: c })} />
          <Swatches label="Skin tone" value={state.avatar.skin} options={SKINS} onChange={(c) => setAvatar({ skin: c })} />
          <Swatches label="Hair color" value={state.avatar.hair} options={HAIRS} onChange={(c) => setAvatar({ hair: c })} />
        </div>
      )}

      {tab === "regulars" && (
        <div role="tabpanel" className="space-y-2">
          <p className="text-sm text-[#7a5a44]">
            Regular after {REGULAR_VISITS} visits (+1 tip). VIP after {VIP_VISITS} visits (+25% tip, at least 3).
          </p>
          {unlockedCustomers(state).map((id) => {
            const c = CUSTOMERS[id];
            const status = customerStatus(state.visits[id]);
            return (
              <div key={id} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-[#eadccb]">
                <CatFace coat={c.coat} size={44} />
                <div className="flex-1">
                  <p className="font-bold">{c.name}</p>
                  <p className="text-xs text-[#7a5a44]">{c.description}</p>
                </div>
                <span className="text-sm">{state.visits[id]} visits</span>
                {status !== "new" && <StatusBadge status={status} />}
              </div>
            );
          })}
        </div>
      )}

      {tab === "settings" && (
        <div role="tabpanel" className="space-y-4">
          <button type="button" className={btnGhost} aria-pressed={state.settings.sound} onClick={() => dispatch({ type: "toggleSound" })}>
            Sound: {state.settings.sound ? "on 🔊" : "off 🔇"}
          </button>
          <p className="text-sm text-[#7a5a44]">Animations follow your device&apos;s reduced-motion setting. Progress is saved in this browser only.</p>
          <div className="rounded-2xl bg-white p-3 ring-1 ring-[#f0c6d1]">
            <h3 className="font-bold">Reset café</h3>
            <p className="text-sm text-[#7a5a44]">Erases coins, inventory, levels, staff, specials and visits.</p>
            {!confirmReset ? (
              <button type="button" className={`${btnGhost} mt-2`} onClick={() => setConfirmReset(true)}>
                Reset café…
              </button>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2" role="alert">
                <p className="w-full text-sm font-bold text-[#c94f6d]">Are you sure? This cannot be undone.</p>
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    setConfirmReset(false);
                    onReset();
                    onClose();
                  }}
                >
                  Yes, start over
                </button>
                <button type="button" className={btnGhost} onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function StatusBadge({ status }: { status: "regular" | "vip" }) {
  return status === "vip" ? (
    <span className="rounded-full bg-[#f2c84b] px-2 py-0.5 text-xs font-extrabold text-[#3b2a22]" data-testid="vip-badge">
      ⭐ VIP
    </span>
  ) : (
    <span className="rounded-full bg-[#dfe9da] px-2 py-0.5 text-xs font-bold text-[#4d6b49]">Regular</span>
  );
}
