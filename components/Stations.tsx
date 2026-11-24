"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BLENDER_CAPACITY, DURATIONS, INGREDIENTS, INGREDIENT_IDS, RECIPES, type IngredientId, type Station } from "@/lib/game/data";
import { isIngredientUnlocked, mixColor, mixFlavor, ovenRemainingMs, type Action, type GameState, type TutorialStep } from "@/lib/game/engine";

type Dispatch = (a: Action) => unknown;

export const btn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-base font-bold shadow-sm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#3b2a22]";
export const btnPrimary = `${btn} bg-[#e8728f] text-white hover:bg-[#d95f7e]`;
export const btnSage = `${btn} bg-[#7f9f7a] text-white hover:bg-[#6d8c68]`;
export const btnGhost = `${btn} bg-white text-[#3b2a22] ring-1 ring-[#e3d5c3] hover:bg-[#fdf3ea]`;
export const glow = (on: boolean) => (on ? " tutorial-glow" : "");

/**
 * An inventory item. Tap/click/Enter/Space adds it to its station. On top of
 * that, pointer-drag (mouse, pen, touch) onto a matching drop zone also adds it.
 */
function IngredientChip({ id, count, onAdd, highlight, onDragState }: { id: IngredientId; count: number; onAdd: () => void; highlight: boolean; onDragState: (s: Station | null) => void }) {
  const ing = INGREDIENTS[id];
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const dragging = useRef(false);
  const suppressClick = useRef(false);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);

  const end = () => {
    start.current = null;
    dragging.current = false;
    setGhost(null);
    onDragState(null);
  };

  return (
    <>
      <button
        type="button"
        data-testid={`inv-${id}`}
        data-tutorial={id === "strawberry" ? "inventory" : undefined}
        disabled={count <= 0}
        aria-label={`Add ${ing.name.toLowerCase()} to the ${ing.station === "blender" ? "blender" : ing.station === "coffee" ? "coffee machine" : "mixing bowl"} (${count} in inventory)`}
        className={`relative flex min-h-14 min-w-[5.5rem] touch-none select-none flex-col items-center justify-center rounded-2xl bg-white px-3 py-1.5 text-sm font-semibold text-[#3b2a22] shadow-sm ring-1 ring-[#e3d5c3] transition hover:bg-[#fdf3ea] active:scale-95 disabled:opacity-40 focus-visible:outline-4 focus-visible:outline-[#3b2a22]${glow(highlight)}`}
        onPointerDown={(e) => {
          if (count <= 0 || (e.pointerType === "mouse" && e.button !== 0)) return;
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s || s.id !== e.pointerId) return;
          if (!dragging.current && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) {
            dragging.current = true;
            onDragState(ing.station);
            try {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }
          if (dragging.current) setGhost({ x: e.clientX, y: e.clientY });
        }}
        onPointerUp={(e) => {
          if (dragging.current) {
            suppressClick.current = true;
            const zone = document
              .elementsFromPoint(e.clientX, e.clientY)
              .map((el) => (el as HTMLElement).closest?.("[data-dropzone]") as HTMLElement | null)
              .find(Boolean);
            const target = zone?.dataset.dropzone;
            if (target === ing.station || target === "scene") onAdd();
          }
          end();
        }}
        onPointerCancel={end}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          onAdd();
        }}
      >
        <span className="text-2xl leading-none" aria-hidden>
          {ing.emoji}
        </span>
        <span>
          {ing.name} <span className="rounded-full bg-[#f3e7d8] px-1.5 text-xs">×{count}</span>
        </span>
      </button>
      {ghost &&
        createPortal(
          <div className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-1/2 text-5xl drop-shadow-lg" style={{ left: ghost.x, top: ghost.y }} aria-hidden>
            {ing.emoji}
          </div>,
          document.body,
        )}
    </>
  );
}

function Inventory({ state, station, dispatch, tutorial, onDragState, label }: { state: GameState; station: Station; dispatch: Dispatch; tutorial: TutorialStep; onDragState: (s: Station | null) => void; label: string }) {
  const items = INGREDIENT_IDS.filter((id) => INGREDIENTS[id].station === station && isIngredientUnlocked(state, id));
  const owned = items.filter((id) => state.inventory[id] > 0);
  return (
    <section aria-label={label} className="rounded-2xl bg-[#f6ede2] p-3">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#7a5a44]">{label}</h3>
      {owned.length === 0 ? (
        <p className="text-sm text-[#7a5a44]">Empty. Buy ingredients in the Shop.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {owned.map((id) => (
            <IngredientChip key={id} id={id} count={state.inventory[id]} highlight={tutorial === "inventory" && id === "strawberry"} onAdd={() => dispatch({ type: "add", ingredient: id })} onDragState={onDragState} />
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-[#7a5a44]">Tap an item to add it, or drag it onto the station.</p>
    </section>
  );
}

function DropZone({ station, active, children, label }: { station: Station; active: boolean; children: ReactNode; label: string }) {
  return (
    <div data-dropzone={station} aria-label={label} className={`rounded-2xl border-2 border-dashed p-3 transition ${active ? "border-[#e8728f] bg-[#fde8ee]" : "border-[#e3d5c3] bg-white/70"}`}>
      {children}
    </div>
  );
}

/** Re-render on an interval while `active`, returning the current time. */
export function useNow(active: boolean, every = 200) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(id);
  }, [active, every]);
  return now;
}

export function BlenderPanel({ state, dispatch, tutorial, dragging, onDragState }: { state: GameState; dispatch: Dispatch; tutorial: TutorialStep; dragging: Station | null; onDragState: (s: Station | null) => void }) {
  const b = state.blender;
  const now = useNow(b.phase === "blending");
  const contentsLabel = b.contents.length ? b.contents.map((c) => INGREDIENTS[c].name).join(" + ") : "empty";
  const preview = b.contents.length ? mixColor(b.contents) : null;
  return (
    <div className="flex flex-col gap-3">
      <Inventory state={state} station="blender" dispatch={dispatch} tutorial={tutorial} onDragState={onDragState} label="Your inventory: fruit" />
      <DropZone station="blender" active={dragging === "blender"} label="Blender drop zone">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-[#3b2a22]">Blender</h3>
            <p className="text-sm text-[#7a5a44]" data-testid="blender-status">
              {b.phase === "idle" && `Jar: ${contentsLabel} (${b.contents.length}/${BLENDER_CAPACITY})`}
              {b.phase === "blending" && "Blending… fruit is swirling into liquid!"}
              {b.phase === "blended" && `${RECIPES[b.result!].name} ready to pour.`}
              {b.phase === "pouring" && "Pouring into the cup…"}
            </p>
          </div>
          {(preview || b.result) && (
            <span className="flex items-center gap-1 text-xs text-[#7a5a44]">
              <span className="inline-block h-6 w-6 rounded-full ring-2 ring-white" style={{ background: b.result ? RECIPES[b.result].color : preview! }} aria-hidden />
              {b.result ? RECIPES[b.result].flavor : mixFlavor(b.contents)}
            </span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            type="button"
            className={`${btnPrimary} text-lg${glow(tutorial === "on")}`}
            data-tutorial="on"
            disabled={b.phase !== "idle" || b.contents.length === 0}
            onClick={() => dispatch({ type: "blenderOn", now: Date.now() })}
            aria-label="ON: start the blender"
          >
            ⏻ ON
          </button>
          <button type="button" className={`${btnSage}${glow(tutorial === "pour")}`} data-tutorial="pour" disabled={b.phase !== "blended" || state.cup !== null} onClick={() => dispatch({ type: "pour", now: Date.now() })}>
            Pour
          </button>
          <button type="button" className={btnGhost} disabled={!(b.phase === "idle" && b.contents.length > 0) && b.phase !== "blended"} onClick={() => dispatch({ type: "emptyBlender" })}>
            {b.phase === "blended" ? "Rinse jar" : "Take fruit out"}
          </button>
        </div>
        {b.phase === "blending" && <Progress value={1 - Math.max(0, (b.endsAt ?? now) - now) / DURATIONS.blend} label="Blending progress" />}
      </DropZone>
      <div className="flex items-center justify-between rounded-2xl bg-white/70 p-3 ring-1 ring-[#e3d5c3]">
        <p className="text-sm text-[#3b2a22]" data-testid="cup-status">
          <span className="font-bold">Cup:</span> {state.cup ? RECIPES[state.cup].name : b.phase === "pouring" ? "filling…" : "empty"}
        </p>
        <button type="button" className={`${btnGhost} min-h-10 text-sm`} disabled={!state.cup || b.phase === "pouring"} onClick={() => dispatch({ type: "tossCup" })}>
          Toss cup
        </button>
      </div>
    </div>
  );
}

export function CoffeePanel({ state, dispatch, dragging, onDragState }: { state: GameState; dispatch: Dispatch; dragging: Station | null; onDragState: (s: Station | null) => void }) {
  const c = state.coffee;
  return (
    <div className="flex flex-col gap-3">
      <Inventory state={state} station="coffee" dispatch={dispatch} tutorial={null} onDragState={onDragState} label="Your inventory: coffee" />
      <DropZone station="coffee" active={dragging === "coffee"} label="Coffee machine drop zone">
        <h3 className="font-bold text-[#3b2a22]">Coffee station</h3>
        <p className="text-sm text-[#7a5a44]" data-testid="coffee-status">
          {c.phase === "idle" && (c.beans ? "Beans loaded. Press Brew." : "Add a scoop of coffee beans.")}
          {c.phase === "brewing" && "Brewing… drip, drip."}
          {c.phase === "ready" && "Fresh coffee in the mug! Serve it."}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className={btnPrimary} disabled={c.phase !== "idle" || c.beans < 1} onClick={() => dispatch({ type: "brew", now: Date.now() })}>
            ☕ Brew
          </button>
          <button type="button" className={btnGhost} disabled={c.phase === "brewing" || (c.phase === "idle" && c.beans === 0)} onClick={() => dispatch({ type: "emptyCoffee" })}>
            {c.phase === "ready" ? "Pour out" : "Remove beans"}
          </button>
        </div>
      </DropZone>
    </div>
  );
}

export function BakeryPanel({ state, dispatch, dragging, onDragState }: { state: GameState; dispatch: Dispatch; dragging: Station | null; onDragState: (s: Station | null) => void }) {
  const k = state.bakery;
  const now = useNow(k.oven === "baking", 250);
  // Clamp: `now` may lag a moment behind the bake start until the first interval tick.
  const remaining = Math.min(DURATIONS.bake / 1000, Math.ceil(ovenRemainingMs(state, now) / 1000));
  const need = (Object.keys(RECIPES.croissant.ingredients) as IngredientId[]).filter((i) => !k.bowl.includes(i));
  return (
    <div className="flex flex-col gap-3">
      <Inventory state={state} station="bakery" dispatch={dispatch} tutorial={null} onDragState={onDragState} label="Your pantry: baking" />
      <DropZone station="bakery" active={dragging === "bakery"} label="Mixing bowl drop zone">
        <h3 className="font-bold text-[#3b2a22]">1 · Mixing bowl</h3>
        <p className="text-sm text-[#7a5a44]" data-testid="bowl-status">
          {k.bowlPhase === "idle" && (k.bowl.length ? `In bowl: ${k.bowl.map((i) => INGREDIENTS[i].name).join(", ")}. ` : "Empty. ") + (need.length ? `Still needs: ${need.map((i) => INGREDIENTS[i].name.toLowerCase()).join(", ")}.` : "Ready to whisk!")}
          {k.bowlPhase === "whisking" && "Whisking…"}
          {k.bowlPhase === "whisked" && "Smooth batter! Transfer it to the tray."}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button type="button" className={btnPrimary} disabled={k.bowlPhase !== "idle" || need.length > 0} onClick={() => dispatch({ type: "whisk", now: Date.now() })}>
            Whisk
          </button>
          <button type="button" className={btnSage} disabled={k.bowlPhase !== "whisked" || k.tray !== "empty"} onClick={() => dispatch({ type: "transferToTray" })}>
            To tray
          </button>
          <button type="button" className={btnGhost} disabled={k.bowlPhase === "whisking" || (k.bowlPhase === "idle" && k.bowl.length === 0)} onClick={() => dispatch({ type: "emptyBowl" })}>
            Empty bowl
          </button>
        </div>
      </DropZone>
      <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-[#e3d5c3]">
        <h3 className="font-bold text-[#3b2a22]">2 · Tray &amp; oven</h3>
        <p className="text-sm text-[#7a5a44]" data-testid="oven-status" aria-live="polite">
          Tray: {k.tray === "dough" ? "dough ready" : "empty"} · Oven:{" "}
          {k.oven === "idle" ? "off" : k.oven === "baking" ? <span className="font-bold text-[#c94f6d]">baking, {remaining}s left</span> : "done! 🥐"} · Croissants: {k.croissants}
        </p>
        {k.oven === "baking" && <Progress value={1 - remaining / 60} label="Oven progress" />}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className={btnPrimary} disabled={k.tray !== "dough" || k.oven !== "idle"} onClick={() => dispatch({ type: "bake", now: Date.now() })}>
            Bake (1 min)
          </button>
          <button type="button" className={btnSage} disabled={k.oven !== "done"} onClick={() => dispatch({ type: "takeOutCroissants", now: Date.now() })}>
            Take out
          </button>
        </div>
        <p className="mt-2 text-xs text-[#7a5a44]">You can keep shopping and serving while the oven runs. Progress survives a reload.</p>
      </div>
    </div>
  );
}

function Progress({ value, label }: { value: number; label: string }) {
  const v = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#f0e3d4]" role="progressbar" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-[#e8728f] transition-[width] duration-200" style={{ width: `${v}%` }} />
    </div>
  );
}
