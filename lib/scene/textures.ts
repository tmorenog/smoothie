import * as THREE from "three";
import type { CoatSpec } from "@/lib/game/data";

/** Small deterministic PRNG so every cat's coat looks the same on each load. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement, repeat?: [number, number]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

function shade(hex: string, amount: number) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amount)));
  return "#" + c.getHexString();
}

/** Fur-like coat texture for a sphere UV map (u = around, v = top → bottom). */
export function coatTexture(coat: CoatSpec, seed: number, kind: "body" | "head" | "tail") {
  const W = 256;
  const H = 128;
  const { c, ctx } = canvas(W, H);
  const rand = rng(seed * 7919 + (kind === "head" ? 3 : kind === "tail" ? 11 : 1));
  ctx.fillStyle = coat.base;
  ctx.fillRect(0, 0, W, H);

  const blob = (color: string, alpha: number, count: number, size: number) => {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = alpha;
      const x = rand() * W;
      const y = H * 0.15 + rand() * H * 0.7;
      const rx = size * (0.6 + rand());
      const ry = size * (0.4 + rand() * 0.6);
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      // Wrap blobs around the seam.
      if (x + rx > W) {
        ctx.beginPath();
        ctx.ellipse(x - W, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  const stripes = (color: string, alpha: number, n: number, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      ctx.globalAlpha = alpha * (0.7 + rand() * 0.3);
      ctx.lineWidth = width * (0.6 + rand() * 0.8);
      const x0 = (i / n) * W + rand() * 6;
      ctx.beginPath();
      ctx.moveTo(x0, H * 0.05);
      const wob = 6 + rand() * 8;
      ctx.bezierCurveTo(x0 + wob, H * 0.35, x0 - wob, H * 0.6, x0 + rand() * 8 - 4, H * (0.75 + rand() * 0.2));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  if (coat.pattern === "tabby" || coat.pattern === "bandit") {
    if (kind !== "tail") stripes(coat.markings, coat.pattern === "bandit" ? 0.35 : 0.8, kind === "head" ? 18 : 14, kind === "head" ? 4 : 7);
    for (const p of coat.patches) blob(p, 0.55, kind === "body" ? 4 : 2, 18);
  } else if (coat.pattern === "calico") {
    blob(coat.patches[0] ?? coat.markings, 0.95, kind === "body" ? 5 : 3, 22);
    blob(coat.patches[1] ?? coat.markings, 0.95, kind === "body" ? 4 : 2, 18);
  } else if (coat.pattern === "solid") {
    stripes(coat.markings, 0.18, 10, 5);
  } else if (coat.pattern === "point" && kind === "head") {
    // Darker face mask around the bottom-front of the head.
    const g = ctx.createRadialGradient(W * 0.25, H * 0.62, 4, W * 0.25, H * 0.62, 46);
    g.addColorStop(0, coat.markings);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // Fine fur strokes for a soft, realistic-ish look.
  const light = shade(coat.base, 0.08);
  const dark = shade(coat.base, -0.08);
  ctx.lineWidth = 1;
  for (let i = 0; i < 1400; i++) {
    ctx.strokeStyle = rand() > 0.5 ? light : dark;
    ctx.globalAlpha = 0.25;
    const x = rand() * W;
    const y = rand() * H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 2, y + 3 + rand() * 3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return toTexture(c);
}

export function woodTexture(base: string, plankCount: number, seed: number, vertical = false) {
  const S = 512;
  const { c, ctx } = canvas(S, S);
  const rand = rng(seed);
  const plank = S / plankCount;
  for (let i = 0; i < plankCount; i++) {
    ctx.fillStyle = shade(base, (rand() - 0.5) * 0.08);
    if (vertical) ctx.fillRect(i * plank, 0, plank, S);
    else ctx.fillRect(0, i * plank, S, plank);
    // grain
    for (let g = 0; g < 26; g++) {
      ctx.strokeStyle = shade(base, -0.06 - rand() * 0.05);
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1 + rand();
      ctx.beginPath();
      if (vertical) {
        const x = i * plank + rand() * plank;
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 4, S * 0.3, x - 4, S * 0.7, x + 2, S);
      } else {
        const y = i * plank + rand() * plank;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(S * 0.3, y + 3, S * 0.7, y - 3, S, y + 1);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = shade(base, -0.2);
    if (vertical) ctx.fillRect(i * plank, 0, 2, S);
    else ctx.fillRect(0, i * plank, S, 2);
  }
  return toTexture(c, [1, 1]);
}

export function chalkboardTexture() {
  const { c, ctx } = canvas(512, 320);
  ctx.fillStyle = "#2f3b33";
  ctx.fillRect(0, 0, 512, 320);
  ctx.strokeStyle = "#8a6443";
  ctx.lineWidth = 18;
  ctx.strokeRect(0, 0, 512, 320);
  ctx.fillStyle = "#f4efe4";
  ctx.textAlign = "center";
  ctx.font = "bold 44px Georgia, serif";
  ctx.fillText("Smoothie Cat", 256, 82);
  ctx.font = "bold 40px Georgia, serif";
  ctx.fillText("Café", 256, 130);
  ctx.font = "24px Georgia, serif";
  ctx.fillStyle = "#f7b6c8";
  ctx.fillText("Strawberry · 12", 256, 190);
  ctx.fillStyle = "#f6e4a6";
  ctx.fillText("Banana · 28", 256, 226);
  ctx.fillStyle = "#f7a66e";
  ctx.fillText("Sunrise · 38", 256, 262);
  // little paw prints
  ctx.fillStyle = "rgba(244,239,228,0.6)";
  for (const [x, y] of [[60, 280], [450, 60]]) {
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x - 12 + i * 8, y - 13 - (i === 1 || i === 2 ? 4 : 0), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return toTexture(c);
}

export function heartTexture() {
  const { c, ctx } = canvas(64, 64);
  ctx.fillStyle = "#f05d82";
  ctx.beginPath();
  ctx.moveTo(32, 54);
  ctx.bezierCurveTo(4, 36, 6, 10, 22, 10);
  ctx.bezierCurveTo(28, 10, 32, 16, 32, 20);
  ctx.bezierCurveTo(32, 16, 36, 10, 42, 10);
  ctx.bezierCurveTo(58, 10, 60, 36, 32, 54);
  ctx.fill();
  return toTexture(c);
}

export function softDotTexture(color = "#ffffff") {
  const { c, ctx } = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return toTexture(c);
}

export function wallTexture() {
  const { c, ctx } = canvas(256, 256);
  ctx.fillStyle = "#9fb89a";
  ctx.fillRect(0, 0, 256, 256);
  const rand = rng(42);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
    ctx.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  // subtle vertical stripes wallpaper
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let x = 0; x < 256; x += 32) ctx.fillRect(x, 0, 10, 256);
  return toTexture(c, [6, 3]);
}
