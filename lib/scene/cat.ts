import * as THREE from "three";
import type { CoatSpec } from "@/lib/game/data";
import { coatTexture, rng } from "./textures";

export type CatMood = "idle" | "happy" | "sneaky" | "working";

export interface CatRig {
  group: THREE.Group;
  head: THREE.Group;
  update(t: number, dt: number, mood: CatMood, motion: number): void;
  dispose(): void;
}

const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });

/**
 * Builds a sitting cat from primitives with a procedurally painted coat.
 * Local space: the cat faces +Z, sits on y = 0, about 1 unit tall.
 */
export function buildCat(coat: CoatSpec, seed: number, opts: { apron?: string } = {}): CatRig {
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const rand = rng(seed);

  const bodyTex = track(coatTexture(coat, seed, "body"));
  const headTex = track(coatTexture(coat, seed, "head"));
  const coatMat = track(std("#ffffff", { map: bodyTex }));
  const headMat = track(std("#ffffff", { map: headTex }));
  const bellyMat = track(std(coat.belly));
  const muzzleMat = track(std(coat.muzzle));
  const pawMat = track(std(coat.paws));
  const markMat = track(std(coat.markings));
  const earInnerMat = track(std(coat.earInner, { roughness: 0.6 }));
  const noseMat = track(std(coat.nose, { roughness: 0.4 }));
  const irisMat = track(new THREE.MeshStandardMaterial({ color: coat.eyes, roughness: 0.15, emissive: coat.eyes, emissiveIntensity: 0.25 }));
  const pupilMat = track(new THREE.MeshStandardMaterial({ color: "#050505", roughness: 0.1 }));
  const glintMat = track(new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  const whiskerMat = track(new THREE.MeshBasicMaterial({ color: coat.muzzle === "#f7f4ee" || coat.muzzle === "#fbf8f2" ? "#bdb7ad" : "#f4f1ea" }));
  const tipMat = coat.tailTip ? track(std(coat.tailTip)) : null;

  const sphere = track(new THREE.SphereGeometry(1, 28, 20));
  const lowSphere = track(new THREE.SphereGeometry(1, 16, 12));
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], scale: [number, number, number]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.scale.set(...scale);
    m.castShadow = true;
    return m;
  };

  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);

  // Body, chest, haunches
  const body = mesh(sphere, coatMat, [0, 0.36, -0.02], [0.3, 0.37, 0.33]);
  bodyPivot.add(body);
  bodyPivot.add(mesh(sphere, bellyMat, [0, 0.42, 0.17], [0.19, 0.26, 0.15]));
  bodyPivot.add(mesh(sphere, coatMat, [0.19, 0.17, -0.05], [0.15, 0.15, 0.2]));
  bodyPivot.add(mesh(sphere, coatMat, [-0.19, 0.17, -0.05], [0.15, 0.15, 0.2]));

  // Front legs + paws, back feet
  const legGeo = track(new THREE.CapsuleGeometry(0.05, 0.24, 4, 10));
  for (const x of [-0.09, 0.09]) {
    const leg = new THREE.Mesh(legGeo, coat.pattern === "tuxedo" ? pawMat : coatMat);
    leg.position.set(x, 0.17, 0.17);
    leg.castShadow = true;
    bodyPivot.add(leg);
    bodyPivot.add(mesh(lowSphere, pawMat, [x, 0.035, 0.22], [0.065, 0.045, 0.085]));
  }
  for (const x of [-0.22, 0.22]) bodyPivot.add(mesh(lowSphere, pawMat, [x, 0.035, 0.07], [0.06, 0.04, 0.1]));

  if (opts.apron) {
    const apronMat = track(std(opts.apron, { roughness: 0.7 }));
    const apron = new THREE.Mesh(track(new THREE.CylinderGeometry(0.2, 0.26, 0.34, 20, 1, true, -0.9, 1.8)), apronMat);
    apron.position.set(0, 0.36, 0.03);
    apronMat.side = THREE.DoubleSide;
    bodyPivot.add(apron);
  }

  // Head
  const head = new THREE.Group();
  head.position.set(0, 0.8, 0.07);
  bodyPivot.add(head);
  head.add(mesh(sphere, headMat, [0, 0, 0], [0.22, 0.2, 0.2]));
  // cheek fluff
  head.add(mesh(sphere, headMat, [0.1, -0.06, 0.05], [0.12, 0.1, 0.11]));
  head.add(mesh(sphere, headMat, [-0.1, -0.06, 0.05], [0.12, 0.1, 0.11]));
  if (coat.pattern === "tuxedo") {
    // white blaze between the eyes
    head.add(mesh(sphere, muzzleMat, [0, -0.01, 0.13], [0.05, 0.11, 0.08]));
  }
  if (coat.pattern === "bandit") {
    head.add(mesh(sphere, markMat, [0, 0.025, 0.02], [0.228, 0.055, 0.2]));
  }
  // muzzle
  head.add(mesh(sphere, muzzleMat, [0.04, -0.075, 0.16], [0.058, 0.048, 0.05]));
  head.add(mesh(sphere, muzzleMat, [-0.04, -0.075, 0.16], [0.058, 0.048, 0.05]));
  head.add(mesh(sphere, muzzleMat, [0, -0.11, 0.14], [0.04, 0.03, 0.035]));
  const nose = new THREE.Mesh(track(new THREE.ConeGeometry(0.022, 0.026, 3)), noseMat);
  nose.rotation.x = Math.PI;
  nose.rotation.y = Math.PI;
  nose.position.set(0, -0.045, 0.205);
  head.add(nose);

  // Eyes (each in a group that scales on Y to blink)
  const eyes: THREE.Group[] = [];
  for (const x of [-0.078, 0.078]) {
    const eye = new THREE.Group();
    eye.position.set(x, 0.02, 0.165);
    eye.rotation.y = x > 0 ? 0.35 : -0.35;
    eye.add(mesh(sphere, irisMat, [0, 0, 0], [0.042, 0.04, 0.025]));
    eye.add(mesh(sphere, pupilMat, [0, 0, 0.017], [0.012, 0.032, 0.012]));
    eye.add(mesh(lowSphere, glintMat, [0.012, 0.014, 0.024], [0.008, 0.008, 0.005]));
    head.add(eye);
    eyes.push(eye);
  }

  // Ears
  const earGeo = track(new THREE.ConeGeometry(0.075, 0.15, 14));
  const innerGeo = track(new THREE.ConeGeometry(0.05, 0.1, 12));
  const ears: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(side * 0.12, 0.15, -0.01);
    ear.rotation.z = -side * 0.32;
    const outer = new THREE.Mesh(earGeo, coat.pattern === "point" ? markMat : headMat);
    outer.scale.z = 0.45;
    outer.castShadow = true;
    const inner = new THREE.Mesh(innerGeo, earInnerMat);
    inner.scale.z = 0.3;
    inner.position.set(0, -0.015, 0.018);
    ear.add(outer, inner);
    head.add(ear);
    ears.push(ear);
  }

  // Whiskers: thin cylinders fanning out from the muzzle
  const whiskerGeo = track(new THREE.CylinderGeometry(0.0022, 0.0012, 0.2, 4));
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Mesh(whiskerGeo, whiskerMat);
      w.position.set(side * 0.13, -0.08 + i * 0.016, 0.17);
      w.rotation.z = side * (Math.PI / 2 + (i - 1) * 0.16);
      w.rotation.y = -side * 0.35;
      head.add(w);
    }
  }

  // Tail: a chain of capsules that sways like a wave
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0.08, 0.1, -0.3);
  bodyPivot.add(tailRoot);
  const segs: THREE.Group[] = [];
  const N = 11;
  const segLen = 0.065;
  let parent: THREE.Object3D = tailRoot;
  for (let i = 0; i < N; i++) {
    const seg = new THREE.Group();
    seg.position.y = i === 0 ? 0 : segLen;
    const r = 0.042 - i * 0.0012;
    const banded = coat.pattern === "tabby" || coat.pattern === "bandit";
    const mat = tipMat && i >= N - 3 ? tipMat : banded && i % 2 === 1 ? markMat : coatMat;
    const m = new THREE.Mesh(track(new THREE.CapsuleGeometry(r, segLen, 3, 8)), mat);
    m.position.y = segLen / 2;
    m.castShadow = true;
    seg.add(m);
    parent.add(seg);
    segs.push(seg);
    parent = seg;
  }

  let blinkTimer = 1 + rand() * 3;
  let blink = 0;
  let earTwitch = 0;
  let earTimer = 2 + rand() * 4;
  let happyAmt = 0;
  const phase = rand() * 10;

  function update(t: number, dt: number, mood: CatMood, motion: number) {
    const m = motion; // 1 = full animation, small = reduced motion
    happyAmt += ((mood === "happy" ? 1 : 0) - happyAmt) * Math.min(1, dt * 5);

    // Breathing
    const breath = Math.sin(t * 1.9 + phase);
    body.scale.set(0.3 * (1 + 0.012 * breath), 0.37 * (1 + 0.02 * breath), 0.33 * (1 + 0.015 * breath));

    // Head: gentle look-around, perkier when happy, scanning when sneaky
    const scan = mood === "sneaky" ? Math.sin(t * 2.4) * 0.5 : 0;
    head.rotation.y = (0.2 * Math.sin(t * 0.55 + phase) + scan) * m;
    head.rotation.x = (0.06 * Math.sin(t * 0.8 + phase) - happyAmt * 0.15) * m;
    head.rotation.z = (0.07 * Math.sin(t * 0.4 + phase * 2) + happyAmt * 0.12 * Math.sin(t * 6)) * m;
    head.position.y = 0.8 + happyAmt * 0.03 * Math.abs(Math.sin(t * 7)) * m + 0.006 * breath;
    bodyPivot.position.y = mood === "sneaky" ? -0.06 + 0.03 * Math.abs(Math.sin(t * 4)) * m : 0;

    // Blinking
    blinkTimer -= dt;
    if (blinkTimer <= 0) {
      blink = 0.16;
      blinkTimer = 2 + rand() * 4;
    }
    let lid = 1;
    if (blink > 0) {
      blink -= dt;
      lid = 0.1 + Math.abs(blink / 0.16 - 0.5) * 1.8;
    }
    const squint = 1 - happyAmt * 0.65;
    for (const e of eyes) e.scale.y = Math.min(lid, squint);

    // Ear twitch
    earTimer -= dt;
    if (earTimer <= 0) {
      earTwitch = 0.25;
      earTimer = 3 + rand() * 5;
    }
    if (earTwitch > 0) earTwitch -= dt;
    ears[0].rotation.z = 0.32 + (earTwitch > 0 ? Math.sin(earTwitch * 50) * 0.15 * m : 0) - happyAmt * 0.05;
    ears[1].rotation.z = -0.32 - happyAmt * -0.05;
    ears[0].rotation.x = ears[1].rotation.x = mood === "sneaky" ? -0.35 : 0;

    // Tail: rests curled along the ground, rises when happy
    const up = happyAmt;
    tailRoot.rotation.x = -1.95 + up * 1.4;
    tailRoot.rotation.z = 0.5 * (1 - up);
    const speed = mood === "happy" ? 3.4 : mood === "sneaky" ? 5 : 1.6;
    for (let i = 0; i < segs.length; i++) {
      segs[i].rotation.x = i === 0 ? 0 : (0.2 - up * 0.12) + (i > 7 ? up * 0.25 : 0);
      segs[i].rotation.z = Math.sin(t * speed - i * 0.55 + phase) * (0.12 + i * 0.012) * m;
    }
  }

  return {
    group,
    head,
    update,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
