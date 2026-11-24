"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LEVEL_UNLOCKS } from "@/lib/game/data";
import { applyAction, createInitialState, type Action, type GameEvent, type GameState, type Result } from "@/lib/game/engine";
import { clearGame, loadGame, saveGame } from "@/lib/game/persistence";
import { playSound, type SoundName } from "@/lib/sound";

export interface Toast {
  id: number;
  text: string;
  tone: "ok" | "error" | "celebrate";
}

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const EVENT_SOUNDS: Partial<Record<GameEvent["kind"], SoundName>> = {
  bought: "buy",
  added: "drop",
  blendStart: "blend",
  pourStart: "pour",
  served: "coins",
  newCustomer: "meow",
  levelUp: "level",
  robber: "alarm",
  tillSecured: "ding",
  bakeDone: "ding",
  brewDone: "ding",
  hired: "coins",
};

/**
 * Owns the game state on the client. A ref mirrors the latest state so rapid
 * repeated clicks are always validated against the newest state, never a
 * stale render.
 */
export function useGame() {
  const [state, setState] = useState<GameState>(() => loadGame(storage(), Date.now()));
  const ref = useRef(state);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const toastId = useRef(0);

  const pushToast = useCallback((text: string, tone: Toast["tone"]) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setAnnouncement(text);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "celebrate" ? 4200 : 2600);
  }, []);

  const handleResult = useCallback(
    (r: Result, action: Action) => {
      if (r.state !== ref.current) {
        ref.current = r.state;
        setState(r.state);
      }
      const sound = r.state.settings.sound;
      if (!r.ok) {
        if (action.type !== "tick" && r.message) {
          pushToast(r.message, "error");
          if (sound) playSound("error");
        }
        return;
      }
      let played = false;
      for (const e of r.events) {
        const s = EVENT_SOUNDS[e.kind];
        if (sound && s && !played) {
          playSound(s);
          played = e.kind !== "served";
        }
        if (e.kind === "levelUp") {
          const unlock = LEVEL_UNLOCKS.find((u) => u.level === e.level);
          pushToast(`Level ${e.level}!${unlock ? ` Unlocked: ${unlock.text}.` : ""}`, "celebrate");
        }
        if (e.kind === "served" && e.becameVip) pushToast("New VIP! They'll tip extra from now on. ⭐", "celebrate");
        if (e.kind === "bakeDone") pushToast("Ding! Croissants are golden. Take them out of the oven.", "ok");
        if (e.kind === "robber") pushToast("A masked bandit is sneaking towards the till!", "error");
        if (e.kind === "brewDone") pushToast("Coffee is ready to serve.", "ok");
      }
      if (action.type !== "tick" && r.message) pushToast(r.message, "ok");
      else if (action.type !== "tick" && sound && r.events.length === 0) playSound("tap");
    },
    [pushToast],
  );

  const dispatch = useCallback(
    (action: Action) => {
      const r = applyAction(ref.current, action);
      handleResult(r, action);
      return r;
    },
    [handleResult],
  );

  // Persist every change.
  useEffect(() => {
    saveGame(storage(), state);
  }, [state]);

  // Drive timed phases (blender, pour, brew, whisk, oven).
  const timed =
    state.blender.phase === "blending" ||
    state.blender.phase === "pouring" ||
    state.coffee.phase === "brewing" ||
    state.bakery.bowlPhase === "whisking" ||
    state.bakery.oven === "baking";
  useEffect(() => {
    if (!timed) return;
    const id = window.setInterval(() => dispatch({ type: "tick", now: Date.now() }), 200);
    return () => window.clearInterval(id);
  }, [timed, dispatch]);

  const reset = useCallback(() => {
    clearGame(storage());
    const fresh = createInitialState();
    ref.current = fresh;
    setState(fresh);
    pushToast("A brand-new café! You have 5 Smoothie Coins.", "ok");
  }, [pushToast]);

  return { state, dispatch, toasts, announcement, reset };
}
