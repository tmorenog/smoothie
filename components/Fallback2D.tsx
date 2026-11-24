"use client";

import { CUSTOMERS, INGREDIENTS, RECIPES } from "@/lib/game/data";
import { mixColor, ovenRemainingMs, xpForLevel } from "@/lib/game/engine";
import type { SceneView } from "@/lib/scene/CafeScene";
import { CatFace } from "./CatFace";
import { useNow } from "./Stations";

/** Illustrated, WebGL-free version of the counter. Fully playable via the HTML controls. */
export function Fallback2D({ view }: { view: SceneView }) {
  const s = view.state;
  const now = useNow(s.bakery.oven === "baking", 500);
  const order = s.currentOrder;
  const b = s.blender;
  const liquid = b.phase === "blended" || b.phase === "pouring" ? (b.result ? RECIPES[b.result].color : null) : b.phase === "blending" ? mixColor(b.contents) : null;
  const coffeeOn = s.xp >= xpForLevel(RECIPES.coffee.unlockLevel);
  const bakeryOn = s.xp >= xpForLevel(RECIPES.croissant.unlockLevel);
  return (
    <div data-testid="scene-2d" className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#a9c2a3] to-[#87a682]">
      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-b from-[#c99464] to-[#8f5c35] shadow-[0_-6px_0_#e8728f_inset]" />
      <div className="absolute inset-x-0 bottom-[38%] flex items-end justify-around px-4 pb-1">
        <div className="flex flex-col items-center">
          <div className={`relative h-24 w-16 overflow-hidden rounded-b-2xl rounded-t-md border-4 border-white/70 bg-white/25 ${b.phase === "blending" && !view.reducedMotion ? "animate-[jiggle_0.12s_linear_infinite]" : ""}`}>
            {liquid && <div className="absolute inset-x-0 bottom-0 h-3/4 transition-all duration-700" style={{ background: liquid }} />}
            {(b.phase === "idle" || b.phase === "blending") && (
              <div className={`absolute inset-x-0 bottom-1 flex flex-wrap justify-center gap-0.5 text-lg ${b.phase === "blending" ? "animate-spin opacity-60" : ""}`}>
                {b.contents.map((c, i) => (
                  <span key={i}>{INGREDIENTS[c].emoji}</span>
                ))}
              </div>
            )}
          </div>
          <div className="h-6 w-20 rounded-md bg-[#e8728f]" />
          <span className="mt-1 text-xs font-semibold text-[#3b2a22]">Blender</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="relative h-16 w-11 overflow-hidden rounded-b-xl border-4 border-white/70 bg-white/30">
            {(s.cup || b.phase === "pouring") && (
              <div className="absolute inset-x-0 bottom-0 transition-all duration-1000" style={{ height: s.cup ? "85%" : "40%", background: RECIPES[s.cup ?? b.result ?? "strawberrySmoothie"].color }} />
            )}
          </div>
          <span className="mt-1 text-xs font-semibold text-[#3b2a22]">Cup</span>
        </div>
        {coffeeOn && (
          <div className="flex flex-col items-center">
            <div className="text-4xl" aria-hidden>
              {s.coffee.phase === "ready" ? "☕" : s.coffee.phase === "brewing" ? "♨️" : "🫖"}
            </div>
            <span className="mt-1 text-xs font-semibold text-[#3b2a22]">Coffee</span>
          </div>
        )}
        {bakeryOn && (
          <div className="flex flex-col items-center">
            <div className={`grid h-14 w-16 place-items-center rounded-lg border-4 border-[#e9dfcf] ${s.bakery.oven === "baking" ? "bg-orange-400" : "bg-[#2a1d17]"} text-2xl`}>
              {s.bakery.oven !== "idle" ? "🥐" : ""}
            </div>
            <span className="mt-1 text-xs font-semibold text-[#3b2a22]">
              Oven{s.bakery.oven === "baking" ? ` ${Math.ceil(ovenRemainingMs(s, now) / 1000)}s` : ""}
            </span>
          </div>
        )}
        {order && (
          <div className={`flex flex-col items-center ${view.happy && !view.reducedMotion ? "animate-bounce" : ""}`}>
            <CatFace coat={CUSTOMERS[order.customerId].coat} size={84} happy={view.happy} />
            <span className="mt-1 text-xs font-semibold text-[#3b2a22]">{CUSTOMERS[order.customerId].name}</span>
          </div>
        )}
      </div>
      {s.robber.active && (
        <div className="absolute bottom-[40%] left-2 text-4xl" aria-hidden>
          🦝
        </div>
      )}
    </div>
  );
}
