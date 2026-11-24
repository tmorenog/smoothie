import * as THREE from "three";
import type { Avatar } from "@/lib/game/engine";

export interface AvatarRig {
  group: THREE.Group;
  update(t: number, dt: number, busy: boolean, motion: number): void;
  dispose(): void;
}

/** Stylised barista standing behind the counter, facing +Z. */
export function buildAvatar(a: Avatar): AvatarRig {
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const mat = (color: string, roughness = 0.8) => track(new THREE.MeshStandardMaterial({ color, roughness }));
  const sphere = track(new THREE.SphereGeometry(1, 24, 16));

  const shirt = mat(a.gender === "girl" ? "#f6efe3" : "#eef1ea");
  const skin = mat(a.skin, 0.6);
  const hair = mat(a.hair, 0.7);
  const apron = mat(a.apron, 0.75);
  const dark = mat("#2b2220", 0.3);
  const blush = mat("#f2a1a8", 0.6);
  const pants = mat("#4a4f63");

  const group = new THREE.Group();
  const torsoPivot = new THREE.Group();
  group.add(torsoPivot);

  const legs = new THREE.Mesh(track(new THREE.CylinderGeometry(0.17, 0.15, 0.9, 16)), pants);
  legs.position.y = 0.45;
  group.add(legs);

  const torso = new THREE.Mesh(track(new THREE.CylinderGeometry(0.19, 0.22, 0.62, 20)), shirt);
  torso.position.y = 1.2;
  torso.castShadow = true;
  torsoPivot.add(torso);

  // Apron: bib + skirt wrapping the front, plus neck strap and pocket
  const skirt = new THREE.Mesh(track(new THREE.CylinderGeometry(0.235, 0.27, 0.55, 20, 1, true, -1.1, 2.2)), apron);
  skirt.position.y = 1.0;
  (skirt.material as THREE.Material).side = THREE.DoubleSide;
  torsoPivot.add(skirt);
  const bib = new THREE.Mesh(track(new THREE.BoxGeometry(0.24, 0.24, 0.02)), apron);
  bib.position.set(0, 1.33, 0.19);
  torsoPivot.add(bib);
  const strap = new THREE.Mesh(track(new THREE.TorusGeometry(0.12, 0.012, 6, 20, Math.PI)), apron);
  strap.position.set(0, 1.44, 0.12);
  strap.rotation.x = -0.3;
  torsoPivot.add(strap);
  const pocket = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 0.07, 0.01)), mat("#ffffff", 0.9));
  pocket.position.set(0, 0.98, 0.27);
  pocket.material.transparent = true;
  pocket.material.opacity = 0.5;
  torsoPivot.add(pocket);

  // Arms
  const armGeo = track(new THREE.CapsuleGeometry(0.055, 0.42, 4, 10));
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.24, 1.45, 0);
    const arm = new THREE.Mesh(armGeo, shirt);
    arm.position.y = -0.24;
    arm.castShadow = true;
    const hand = new THREE.Mesh(sphere, skin);
    hand.scale.setScalar(0.06);
    hand.position.y = -0.5;
    shoulder.add(arm, hand);
    shoulder.rotation.z = side * 0.18;
    shoulder.rotation.x = -0.5;
    torsoPivot.add(shoulder);
    arms.push(shoulder);
  }

  // Head
  const head = new THREE.Group();
  head.position.y = 1.68;
  torsoPivot.add(head);
  const neck = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10)), skin);
  neck.position.y = -0.16;
  head.add(neck);
  const face = new THREE.Mesh(sphere, skin);
  face.scale.set(0.17, 0.18, 0.165);
  face.castShadow = true;
  head.add(face);
  for (const x of [-0.06, 0.06]) {
    const eye = new THREE.Mesh(sphere, dark);
    eye.scale.set(0.022, 0.028, 0.012);
    eye.position.set(x, 0.01, 0.155);
    head.add(eye);
    const cheek = new THREE.Mesh(sphere, blush);
    cheek.scale.set(0.03, 0.018, 0.01);
    cheek.position.set(x * 1.5, -0.045, 0.145);
    head.add(cheek);
  }
  const smile = new THREE.Mesh(track(new THREE.TorusGeometry(0.035, 0.007, 6, 14, Math.PI)), dark);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.065, 0.158);
  head.add(smile);

  // Hair
  const cap = new THREE.Mesh(track(new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55)), hair);
  cap.scale.set(0.182, 0.19, 0.18);
  cap.position.set(0, 0.015, -0.01);
  cap.rotation.x = -0.25;
  head.add(cap);
  const fringe = new THREE.Mesh(sphere, hair);
  fringe.scale.set(0.15, 0.05, 0.07);
  fringe.position.set(0.02, 0.12, 0.11);
  fringe.rotation.z = -0.2;
  head.add(fringe);
  if (a.gender === "girl") {
    const back = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.15, 0.22, 4, 14)), hair);
    back.position.set(0, -0.1, -0.08);
    back.scale.z = 0.6;
    head.add(back);
    const bun = new THREE.Mesh(sphere, hair);
    bun.scale.setScalar(0.08);
    bun.position.set(0, 0.17, -0.1);
    head.add(bun);
    const bow = new THREE.Mesh(sphere, apron);
    bow.scale.set(0.06, 0.03, 0.03);
    bow.position.set(0.1, 0.14, 0.03);
    head.add(bow);
  } else {
    const tuft = new THREE.Mesh(sphere, hair);
    tuft.scale.set(0.07, 0.05, 0.06);
    tuft.position.set(-0.05, 0.18, 0.02);
    head.add(tuft);
  }

  function update(t: number, dt: number, busy: boolean, motion: number) {
    torsoPivot.rotation.z = Math.sin(t * 0.9) * 0.02 * motion;
    head.rotation.y = Math.sin(t * 0.5) * 0.15 * motion;
    head.rotation.z = Math.sin(t * 0.7) * 0.05 * motion;
    const work = busy ? Math.sin(t * 9) * 0.25 * motion : 0;
    arms[0].rotation.x = -0.6 + work;
    arms[1].rotation.x = -0.6 - work;
    void dt;
  }

  return {
    group,
    update,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
