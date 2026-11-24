"use client";

import dynamic from "next/dynamic";

function Splash() {
  return (
    <div className="grid h-[100svh] place-items-center bg-[#fbf6ee] text-[#3b2a22]">
      <div className="text-center">
        <div className="text-6xl" aria-hidden>
          🐱🍓
        </div>
        <p className="mt-3 text-lg font-bold">Opening Smoothie Cat Café…</p>
      </div>
    </div>
  );
}

// The game reads localStorage and WebGL on first render, so it only renders in the browser.
const Game = dynamic(() => import("./Game"), { ssr: false, loading: Splash });

export default function GameClient() {
  return <Game />;
}
