import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { BANDIT_COAT, CUSTOMERS, DURATIONS, INGREDIENTS, RECIPES, STAFF, type CustomerId, type IngredientId, type StaffId, type Station } from "@/lib/game/data";
import { unlockedCustomers, xpForLevel, type Avatar, type GameState } from "@/lib/game/engine";
import { buildCat, type CatRig } from "./cat";
import { chalkboardTexture, heartTexture, softDotTexture, wallTexture, woodTexture } from "./textures";

/** Things the player can tap in the café. */
export type PickTarget = Station | "customer" | "till";

export interface SceneView {
  state: GameState;
  focus: Station;
  reducedMotion: boolean;
  happy: boolean;
  /** Pixels of the canvas covered by HUD/drawer, so the view can re-centre in what's visible. */
  insetBottom?: number;
  insetRight?: number;
}

const TOP = 1.06; // counter top surface height
const X = { fryer: -0.5, plate: 0.66, till: -2.2, blender: -1.35, cup: -0.72, coffee: 0.2, bowl: 1.0, tray: 1.55, oven: 1.5 };

type Piece = { mesh: THREE.Object3D; ing: IngredientId; y: number; vy: number; rest: number; angle: number; r: number };

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function progress(endsAt: number | null, duration: number, now: number) {
  if (endsAt === null) return 1;
  return Math.min(1, Math.max(0, 1 - (endsAt - now) / duration));
}

/** Chooses a pixel ratio that keeps tablets and phones cool. */
export function pickPixelRatio() {
  if (typeof window === "undefined") return 1;
  const dpr = window.devicePixelRatio || 1;
  const touch = navigator.maxTouchPoints > 1;
  const short = Math.min(window.screen.width, window.screen.height);
  const tablet = touch && short >= 600;
  const cap = tablet ? 1.25 : touch ? 1.75 : 2;
  return Math.min(dpr, cap);
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

export class CafeScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  private timer = new THREE.Timer();
  private raf = 0;
  private disposed = false;
  private view: SceneView | null = null;
  private resizeObserver: ResizeObserver;
  private camTarget = new THREE.Vector3(0, 1.3, 0);
  private camPos = new THREE.Vector3(0, 3, 6);
  private aspect = 1;
  private textures: THREE.Texture[] = [];

  // rigs
  private customer: { id: CustomerId; rig: CatRig } | null = null;
  private customerAnchor = new THREE.Group();
  private bandit: CatRig;
  private banditAnchor = new THREE.Group();
  private staffRigs = new Map<StaffId, CatRig>();
  // first-person hands
  private hands = new THREE.Group();
  private handParts: THREE.Group[] = [];
  private handsKey = "";
  // look-around + picking
  private yaw = 0;
  private pitch = 0;
  private lastFocus: Station | null = null;
  private lastFrontX = -1.0;
  private pointer: { id: number; x: number; y: number; lastX: number; lastY: number; drag: boolean } | null = null;
  private raycaster = new THREE.Raycaster();
  private pickables: THREE.Object3D[] = [];
  private ambient: { key: string; rigs: CatRig[] } = { key: "", rigs: [] };
  private ambientSeats = [
    { x: -2.15, z: 2.45, ry: 0.35 },
    { x: 2.55, z: 2.3, ry: -0.4 },
  ];
  private envTex: THREE.Texture | null = null;

  // blender
  private blenderBase = new THREE.Group();
  private jar = new THREE.Group();
  private blades = new THREE.Group();
  private jarLiquid: THREE.Mesh;
  private jarLiquidMat: THREE.MeshStandardMaterial;
  private pieces: Piece[] = [];
  private piecesKey = "";
  private pieceGroup = new THREE.Group();
  private stream: THREE.Mesh;
  private streamMat: THREE.MeshStandardMaterial;
  private onLight: THREE.MeshStandardMaterial;
  private cupLiquid: THREE.Mesh;
  private cupLiquidMat: THREE.MeshStandardMaterial;
  private cupTopping: THREE.Mesh;
  private straw: THREE.Mesh;
  private cupFill = 0;

  // coffee
  private coffeeGroup = new THREE.Group();
  private plant = new THREE.Group();
  private beanPile = new THREE.Group();
  private coffeeLiquid: THREE.Mesh;
  private coffeeStream: THREE.Mesh;
  private steam: THREE.Sprite[] = [];

  // bakery
  private bakeryGroup = new THREE.Group();

  // donut fryer
  private donutGroup = new THREE.Group();
  private fryDonut!: THREE.Mesh;
  private fryDonutMat!: THREE.MeshStandardMaterial;
  private oilMat!: THREE.MeshStandardMaterial;
  private bubbles: THREE.Mesh[] = [];
  private plateDonut = new THREE.Group();
  private cupGroup = new THREE.Group();
  private tillGroup = new THREE.Group();
  private topping = new THREE.Group();
  private bowlItems = new Map<IngredientId, THREE.Object3D>();
  private batter: THREE.Mesh;
  private whisk = new THREE.Group();
  private trayDough = new THREE.Group();
  private plateCroissants: THREE.Object3D[] = [];
  private ovenWindowMat: THREE.MeshStandardMaterial;
  private ovenLight: THREE.PointLight;
  private ovenDoneLamp: THREE.MeshStandardMaterial;
  private ovenInside = new THREE.Group();

  // till
  private tillDrawer: THREE.Mesh;
  private padlock = new THREE.Group();

  private hearts: { s: THREE.Sprite; life: number }[] = [];
  private heartTex: THREE.Texture;
  private lastHappy = false;

  constructor(
    private container: HTMLElement,
    private onPick: (target: PickTarget) => void = () => {},
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
    this.renderer.setPixelRatio(pickPixelRatio());
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color("#3a2a22");
    // Soft image-based lighting so glass, metal and glaze pick up realistic reflections.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.28;
    this.heartTex = this.tex(heartTexture());

    this.buildRoom();
    this.buildCounter();
    const b = this.buildBlender();
    this.jarLiquid = b.liquid;
    this.jarLiquidMat = b.liquidMat;
    this.stream = b.stream;
    this.streamMat = b.streamMat;
    this.onLight = b.onLight;
    const c = this.buildCup();
    this.cupLiquid = c.liquid;
    this.cupLiquidMat = c.mat;
    this.cupTopping = c.topping;
    this.straw = c.straw;
    const cf = this.buildCoffee();
    this.coffeeLiquid = cf.liquid;
    this.coffeeStream = cf.stream;
    this.buildDonutFryer();
    const bk = this.buildBakery();
    this.batter = bk.batter;
    this.ovenWindowMat = bk.windowMat;
    this.ovenLight = bk.light;
    this.ovenDoneLamp = bk.doneLamp;
    this.tillDrawer = this.buildTill();
    this.buildFrontOfHouse();

    this.scene.add(this.customerAnchor, this.banditAnchor, this.camera);
    this.camera.add(this.hands);
    this.customerAnchor.position.set(-0.3, 0, 0.95);
    this.customerAnchor.userData.pick = "customer";
    this.bandit = buildCat(BANDIT_COAT, 99);
    this.bandit.group.scale.setScalar(0.62);
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), new THREE.MeshStandardMaterial({ color: "#b89a6a", roughness: 1 }));
    sack.position.set(0.22, 0.1, 0.08);
    this.bandit.group.add(sack);
    this.banditAnchor.add(this.bandit.group);
    this.banditAnchor.position.set(-4.5, 0, 0.9);
    this.banditAnchor.visible = false;
    this.pickables = [this.blenderBase, this.jar, this.cupGroup, this.coffeeGroup, this.donutGroup, this.bakeryGroup, this.tillGroup, this.customerAnchor];
    const el = this.renderer.domElement;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("pointercancel", this.onPointerCancel);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.camera.position.set(-1.0, 1.62, -1.0);
    this.loop();
  }

  private tex<T extends THREE.Texture>(t: T): T {
    this.textures.push(t);
    return t;
  }

  // ------------------------------------------------------------------ build

  private buildRoom() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight("#ffe7cc", "#5a3d2c", 1.1));
    const key = new THREE.DirectionalLight("#ffdcb0", 2.2);
    key.position.set(2.5, 6, 4.5);
    key.castShadow = true;
    const big = typeof navigator !== "undefined" && navigator.maxTouchPoints <= 1;
    key.shadow.mapSize.set(big ? 2048 : 1024, big ? 2048 : 1024);
    key.shadow.radius = 3;
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.0008;
    key.shadow.normalBias = 0.02;
    s.add(key);
    const fill = new THREE.DirectionalLight("#f7c6d4", 0.5);
    fill.position.set(-4, 3, 3);
    s.add(fill);

    const floorTex = this.tex(woodTexture("#9a6b45", 8, 3));
    floorTex.repeat.set(3, 3);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = 1;
    floor.receiveShadow = true;
    s.add(floor);

    const wallTex = this.tex(wallTexture());
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 }));
    wall.position.set(0, 2.5, -2.0);
    wall.receiveShadow = true;
    s.add(wall);
    const wainTex = this.tex(woodTexture("#b07a4f", 14, 9, true));
    wainTex.repeat.set(4, 1);
    wainTex.wrapS = THREE.RepeatWrapping;
    const wain = new THREE.Mesh(new THREE.BoxGeometry(14, 1.1, 0.05), new THREE.MeshStandardMaterial({ map: wainTex, roughness: 0.7 }));
    wain.position.set(0, 0.55, -1.97);
    s.add(wain);

    // Window with warm evening glow
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshBasicMaterial({ color: "#ffd59a" }));
    glow.position.set(-0.3, 2.45, -1.98);
    s.add(glow);
    const frameMat = new THREE.MeshStandardMaterial({ color: "#f4ece0", roughness: 0.6 });
    for (const [w, h, x, y] of [[1.62, 0.07, -0.3, 2.95], [1.62, 0.07, -0.3, 1.95], [0.07, 1.06, -1.08, 2.45], [0.07, 1.06, 0.48, 2.45], [0.05, 1.0, -0.3, 2.45], [1.5, 0.05, -0.3, 2.45]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), frameMat);
      f.position.set(x, y, -1.95);
      s.add(f);
    }
    // Strawberry-pink awning stripes over window
    for (let i = 0; i < 8; i++) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.18, 0.2), new THREE.MeshStandardMaterial({ color: i % 2 ? "#f6efe5" : "#e8728f", roughness: 0.8 }));
      a.position.set(-1.04 + i * 0.21, 3.08, -1.88);
      a.rotation.x = 0.5;
      s.add(a);
    }

    // Chalkboard menu
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.78), new THREE.MeshStandardMaterial({ map: this.tex(chalkboardTexture()), roughness: 0.9 }));
    board.position.set(-2.15, 2.45, -1.96);
    s.add(board);

    // Shelf with jars
    const shelfMat = new THREE.MeshStandardMaterial({ color: "#8a5a37", roughness: 0.7 });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.28), shelfMat);
    shelf.position.set(1.55, 2.55, -1.84);
    shelf.castShadow = true;
    s.add(shelf);
    const jarColors = ["#f7b6c8", "#f6e4a6", "#f7a66e", "#c9dcc4", "#e8728f"];
    for (let i = 0; i < 5; i++) {
      const j = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22 + (i % 2) * 0.06, 16), new THREE.MeshStandardMaterial({ color: jarColors[i], roughness: 0.3 }));
      j.position.set(0.98 + i * 0.28, 2.69 + (i % 2) * 0.03, -1.82);
      j.castShadow = true;
      s.add(j);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.04, 16), shelfMat);
      lid.position.set(j.position.x, j.position.y + 0.13 + (i % 2) * 0.03, -1.82);
      s.add(lid);
    }
    // Hanging plant
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.18, 14), new THREE.MeshStandardMaterial({ color: "#d9825b" }));
    pot.position.set(2.7, 2.9, -1.6);
    s.add(pot);
    const leafMat = new THREE.MeshStandardMaterial({ color: "#6f9a63", roughness: 0.8 });
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), leafMat);
      leaf.position.set(2.7 + Math.cos(i) * 0.14, 2.82 - (i % 3) * 0.12, -1.6 + Math.sin(i) * 0.12);
      leaf.scale.set(1, 1.6, 0.6);
      s.add(leaf);
    }

    // Pendant lamps
    for (const x of [-1.5, 0.2, 1.8]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.0), new THREE.MeshBasicMaterial({ color: "#2a1f1a" }));
      cord.position.set(x, 3.6, -0.2);
      s.add(cord);
      const shadeM = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 20, 1, true), new THREE.MeshStandardMaterial({ color: "#9fb89a", side: THREE.DoubleSide, roughness: 0.6 }));
      shadeM.position.set(x, 3.05, -0.2);
      s.add(shadeM);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshStandardMaterial({ color: "#fff1d0", emissive: "#ffcf87", emissiveIntensity: 2 }));
      bulb.position.set(x, 2.95, -0.2);
      s.add(bulb);
      const pl = new THREE.PointLight("#ffbf7a", 3.2, 6, 1.6);
      pl.position.set(x, 2.85, -0.1);
      s.add(pl);
    }

    // Back counter
    const backTex = this.tex(woodTexture("#7b4e30", 6, 21, true));
    const back = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.0, 0.6), new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.75 }));
    back.position.set(0, 0.5, -1.6);
    back.receiveShadow = true;
    s.add(back);
    const backTop = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.05, 0.66), new THREE.MeshStandardMaterial({ color: "#efe6d6", roughness: 0.4 }));
    backTop.position.set(0, 1.02, -1.6);
    backTop.receiveShadow = true;
    s.add(backTop);
  }

  private buildCounter() {
    const frontTex = this.tex(woodTexture("#a8703f", 10, 5, true));
    frontTex.repeat.set(3, 1);
    frontTex.wrapS = THREE.RepeatWrapping;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.0, 1.0), new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.7 }));
    counter.position.set(0, 0.5, 0);
    counter.castShadow = counter.receiveShadow = true;
    this.scene.add(counter);
    const topTex = this.tex(woodTexture("#c99464", 6, 8));
    const top = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.06, 1.15), new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.45 }));
    top.position.set(0, TOP - 0.03, 0.02);
    top.receiveShadow = true;
    this.scene.add(top);
    // sage kick plate and pink trim
    const kick = new THREE.Mesh(new THREE.BoxGeometry(5.42, 0.14, 1.02), new THREE.MeshStandardMaterial({ color: "#7f9f7a", roughness: 0.8 }));
    kick.position.set(0, 0.07, 0);
    this.scene.add(kick);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(5.42, 0.04, 1.02), new THREE.MeshStandardMaterial({ color: "#e8728f", roughness: 0.6 }));
    trim.position.set(0, 0.93, 0);
    this.scene.add(trim);

    // Customer stool
    const stoolMat = new THREE.MeshStandardMaterial({ color: "#5e3d27", roughness: 0.6 });
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 24), new THREE.MeshStandardMaterial({ color: "#e8728f", roughness: 0.7 }));
    seat.position.y = 0.92;
    seat.castShadow = true;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9), stoolMat);
    pole.position.y = 0.45;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.04, 20), stoolMat);
    foot.position.y = 0.02;
    const stool = new THREE.Group();
    stool.add(seat, pole, foot);
    this.customerAnchor.add(stool);
  }

  private buildBlender() {
    const base = this.blenderBase;
    base.position.set(X.blender, TOP, 0);
    this.scene.add(base);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.22, 28), new THREE.MeshStandardMaterial({ color: "#e8728f", roughness: 0.35, metalness: 0.1 }));
    body.position.y = 0.11;
    body.castShadow = true;
    base.add(body);
    const onLight = new THREE.MeshStandardMaterial({ color: "#3b4a3a", emissive: "#5cd65c", emissiveIntensity: 0 });
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), onLight);
    btn.position.set(0, 0.11, -0.19);
    base.userData.pick = "blender";
    this.jar.userData.pick = "blender";
    base.add(btn);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.04, 24), new THREE.MeshStandardMaterial({ color: "#3b3534", roughness: 0.4 }));
    collar.position.y = 0.24;
    base.add(collar);

    // Jar pivots at its bottom centre so it can lift and tilt for pouring
    this.jar.position.set(X.blender, TOP + 0.26, 0);
    this.scene.add(this.jar);
    const glass = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 });
    const jarMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.52, 32, 1, true), glass);
    jarMesh.position.y = 0.26;
    jarMesh.renderOrder = 2;
    this.jar.add(jarMesh);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), glass);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = 0.005;
    this.jar.add(bottom);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 28), new THREE.MeshStandardMaterial({ color: "#3b3534", roughness: 0.4 }));
    lid.position.y = 0.54;
    this.jar.add(lid);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.05, 12), new THREE.MeshStandardMaterial({ color: "#e8728f" }));
    knob.position.y = 0.59;
    this.jar.add(knob);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: "#3b3534", roughness: 0.4 }));
    handle.rotation.z = -Math.PI / 2;
    handle.position.set(-0.17, 0.28, 0);
    this.jar.add(handle);
    // marking lines on glass
    for (let i = 1; i <= 3; i++) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.004, 0.004), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.6 }));
      tick.position.set(0.02, i * 0.12, 0.15 + i * 0.009);
      this.jar.add(tick);
    }

    // Blades
    const bladeMat = new THREE.MeshStandardMaterial({ color: "#d8dde0", metalness: 0.9, roughness: 0.25 });
    for (let i = 0; i < 2; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.008, 0.035), bladeMat);
      blade.rotation.y = (i * Math.PI) / 2;
      blade.rotation.x = i ? 0.25 : -0.25;
      this.blades.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 10), bladeMat);
    this.blades.add(hub);
    this.blades.position.y = 0.04;
    this.jar.add(this.blades);

    // Liquid (pivot at bottom, scaled on Y as it fills)
    const liquidGeo = new THREE.CylinderGeometry(0.155, 0.122, 1, 32);
    liquidGeo.translate(0, 0.5, 0);
    const liquidMat = new THREE.MeshStandardMaterial({ color: "#f7b6c8", roughness: 0.35, transparent: true, opacity: 0.95 });
    const liquid = new THREE.Mesh(liquidGeo, liquidMat);
    liquid.position.y = 0.01;
    liquid.scale.y = 0.0001;
    liquid.visible = false;
    liquid.renderOrder = 1;
    this.jar.add(liquid);
    this.jar.add(this.pieceGroup);

    // Pour stream: unit cylinder along +Y from its base
    const streamGeo = new THREE.CylinderGeometry(0.022, 0.03, 1, 12, 1, true);
    streamGeo.translate(0, 0.5, 0);
    const streamMat = new THREE.MeshStandardMaterial({ color: "#f7b6c8", roughness: 0.3, transparent: true, opacity: 0.95 });
    const stream = new THREE.Mesh(streamGeo, streamMat);
    stream.visible = false;
    this.scene.add(stream);
    return { liquid, liquidMat, stream, streamMat, onLight };
  }

  private buildCup() {
    const g = this.cupGroup;
    g.userData.pick = "blender";
    g.position.set(X.cup, TOP, -0.05);
    this.scene.add(g);
    const glass = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.08, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.26, 28, 1, true), glass);
    cup.position.y = 0.13;
    cup.renderOrder = 2;
    g.add(cup);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.093, 0.084, 0.08, 28, 1, true), new THREE.MeshStandardMaterial({ color: "#7f9f7a", roughness: 0.8, side: THREE.DoubleSide }));
    sleeve.position.y = 0.1;
    g.add(sleeve);
    const geo = new THREE.CylinderGeometry(0.094, 0.07, 1, 24);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ color: "#f7b6c8", roughness: 0.4 });
    const liquid = new THREE.Mesh(geo, mat);
    liquid.position.y = 0.005;
    liquid.scale.y = 0.0001;
    liquid.visible = false;
    g.add(liquid);
    const topping = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#fff7f0", roughness: 0.9 }));
    topping.position.y = 0.25;
    topping.visible = false;
    g.add(topping);
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.36, 8), new THREE.MeshStandardMaterial({ color: "#e8728f" }));
    straw.position.set(0.03, 0.32, 0);
    straw.rotation.z = -0.25;
    straw.visible = false;
    g.add(straw);
    return { liquid, mat, topping, straw };
  }

  private buildCoffee() {
    const g = this.coffeeGroup;
    g.userData.pick = "coffee";
    g.position.set(X.coffee, TOP, -0.12);
    g.rotation.y = Math.PI; // espresso machine faces the barista
    this.scene.add(g);
    const metal = new THREE.MeshStandardMaterial({ color: "#c9c3b6", metalness: 0.6, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: "#3b3534", roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.34), metal);
    body.position.y = 0.25;
    body.castShadow = true;
    g.add(body);
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.02), new THREE.MeshStandardMaterial({ color: "#7f9f7a" }));
    front.position.set(0, 0.42, 0.18);
    g.add(front);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.06, 14), dark);
    head.position.set(0, 0.3, 0.22);
    g.add(head);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.16), dark);
    tray.position.set(0, 0.01, 0.25);
    g.add(tray);
    const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.14, 16, 1, true), new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    hopper.position.set(0.1, 0.57, 0);
    g.add(hopper);
    this.beanPile.position.set(0.1, 0.52, 0);
    const beanMat = new THREE.MeshStandardMaterial({ color: INGREDIENTS.coffeeBeans.color, roughness: 0.5 });
    for (let i = 0; i < 9; i++) {
      const bean = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), beanMat);
      bean.scale.set(1, 0.65, 1.3);
      bean.position.set(Math.cos(i * 2.1) * 0.035, (i % 3) * 0.014, Math.sin(i * 2.1) * 0.035);
      this.beanPile.add(bean);
    }
    g.add(this.beanPile);
    // Mug
    const mug = new THREE.Group();
    mug.position.set(0, 0.02, 0.25);
    g.add(mug);
    const cer = new THREE.MeshStandardMaterial({ color: "#f6efe5", roughness: 0.4 });
    const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.11, 20, 1, true), cer);
    mugBody.position.y = 0.055;
    (mugBody.material as THREE.Material).side = THREE.DoubleSide;
    mug.add(mugBody);
    const mugBottom = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), cer);
    mugBottom.rotation.x = -Math.PI / 2;
    mugBottom.position.y = 0.003;
    mug.add(mugBottom);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 14), cer);
    handle.position.set(0.065, 0.06, 0);
    mug.add(handle);
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.057, 0.054, 1, 18), new THREE.MeshStandardMaterial({ color: RECIPES.coffee.color, roughness: 0.2 }));
    liquid.geometry.translate(0, 0.5, 0);
    liquid.position.y = 0.005;
    liquid.scale.y = 0.0001;
    mug.add(liquid);
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.17, 6), new THREE.MeshStandardMaterial({ color: RECIPES.coffee.color }));
    stream.position.set(0, 0.2, 0.24);
    stream.visible = false;
    g.add(stream);
    const steamTex = this.tex(softDotTexture());
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, opacity: 0, depthWrite: false }));
      s.scale.setScalar(0.08);
      s.position.set(0, 0.14, 0.25);
      g.add(s);
      this.steam.push(s);
    }

    // Placeholder plant while coffee is locked
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.14, 14), new THREE.MeshStandardMaterial({ color: "#d9825b" }));
    pot.position.y = 0.07;
    this.plant.add(pot);
    const leafMat = new THREE.MeshStandardMaterial({ color: "#6f9a63", roughness: 0.8 });
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), leafMat);
      leaf.position.set(Math.cos(i) * 0.06, 0.2 + (i % 2) * 0.06, Math.sin(i) * 0.06);
      leaf.scale.set(0.7, 1.6, 0.5);
      leaf.rotation.z = Math.cos(i) * 0.5;
      this.plant.add(leaf);
    }
    this.plant.position.set(X.coffee, TOP, -0.1);
    this.scene.add(this.plant);
    return { liquid, stream };
  }

  /** Fryer on the back counter plus a serving plate on the front counter. */
  private buildDonutFryer() {
    const g = this.donutGroup;
    g.userData.pick = "donut";
    this.scene.add(g);
    const steel = new THREE.MeshStandardMaterial({ color: "#c9c3b6", metalness: 0.7, roughness: 0.3 });
    const fryer = new THREE.Group();
    fryer.position.set(X.fryer, 1.045, -1.5);
    g.add(fryer);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.24, 0.4), steel);
    body.position.y = 0.12;
    body.castShadow = true;
    fryer.add(body);
    const pink = new THREE.Mesh(new THREE.BoxGeometry(0.565, 0.06, 0.405), new THREE.MeshStandardMaterial({ color: "#e8728f", roughness: 0.5 }));
    pink.position.y = 0.06;
    fryer.add(pink);
    this.oilMat = new THREE.MeshStandardMaterial({ color: "#c98a2c", emissive: "#ff9a3d", emissiveIntensity: 0.05, roughness: 0.15, metalness: 0.2 });
    const oil = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.32), this.oilMat);
    oil.rotation.x = -Math.PI / 2;
    oil.position.y = 0.235;
    fryer.add(oil);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 8), new THREE.MeshStandardMaterial({ color: "#3b3534" }));
    handle.rotation.x = Math.PI / 2.6;
    handle.position.set(0.18, 0.33, 0.25);
    fryer.add(handle);
    const ringGeo = new THREE.TorusGeometry(0.065, 0.034, 12, 24);
    this.fryDonutMat = new THREE.MeshStandardMaterial({ color: "#f1d9a8", roughness: 0.7 });
    this.fryDonut = new THREE.Mesh(ringGeo, this.fryDonutMat);
    this.fryDonut.rotation.x = -Math.PI / 2;
    this.fryDonut.position.y = 0.245;
    this.fryDonut.visible = false;
    fryer.add(this.fryDonut);
    const bubbleMat = new THREE.MeshStandardMaterial({ color: "#ffe2a8", transparent: true, opacity: 0.7 });
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), bubbleMat);
      b.position.set(Math.cos(i * 1.7) * 0.15, 0.24, Math.sin(i * 1.7) * 0.1);
      b.visible = false;
      fryer.add(b);
      this.bubbles.push(b);
    }
    // Plate with the finished donut
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.02, 24), new THREE.MeshStandardMaterial({ color: "#fbf6ee", roughness: 0.4 }));
    plate.position.y = 0.01;
    this.plateDonut.add(plate);
    const cooked = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: "#d6923f", roughness: 0.6 }));
    cooked.rotation.x = -Math.PI / 2;
    cooked.position.y = 0.05;
    cooked.castShadow = true;
    this.plateDonut.add(cooked);
    const glaze = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.03, 10, 24), new THREE.MeshStandardMaterial({ color: RECIPES.donut.color, roughness: 0.25 }));
    glaze.rotation.x = -Math.PI / 2;
    glaze.position.y = 0.065;
    glaze.scale.z = 0.8;
    this.topping.add(glaze);
    const colors = ["#ffffff", "#7f9f7a", "#f2c84b", "#6f8fc9", "#e8435a"];
    for (let i = 0; i < 18; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.005, 0.005), new THREE.MeshBasicMaterial({ color: colors[i % colors.length] }));
      const a = (i / 18) * Math.PI * 2;
      const r = 0.05 + (i % 3) * 0.012;
      sp.position.set(Math.cos(a) * r, 0.092, Math.sin(a) * r);
      sp.rotation.y = i * 1.3;
      this.topping.add(sp);
    }
    this.plateDonut.add(this.topping);
    this.plateDonut.position.set(X.fryer + 0.48, 1.045, -1.45);
    this.plateDonut.visible = false;
    g.add(this.plateDonut);
  }

  private animateDonut(t: number, now: number, motion: number) {
    if (!this.donutGroup.visible) return;
    const d = this.view!.state.donut;
    const frying = d.phase === "frying";
    this.fryDonut.visible = frying || (d.phase === "idle" && d.dough > 0);
    const p = frying ? progress(d.endsAt, DURATIONS.fry, now) : 0;
    this.fryDonutMat.color.set("#f1d9a8").lerp(new THREE.Color("#d6923f"), p);
    this.fryDonut.position.y = 0.245 + (frying ? Math.sin(t * 6) * 0.006 * motion : 0.03);
    this.oilMat.emissiveIntensity = frying ? 0.35 + Math.sin(t * 8) * 0.1 * motion : 0.05;
    this.bubbles.forEach((b, i) => {
      b.visible = frying;
      if (frying) {
        const ph = (t * 1.5 + i / 6) % 1;
        b.position.y = 0.24 + ph * 0.04 * motion;
        b.scale.setScalar(1 - ph * 0.6);
      }
    });
    this.plateDonut.visible = d.phase === "fried" || d.phase === "decorated";
    this.topping.visible = d.phase === "decorated";
  }

  private buildBakery() {
    const g = this.bakeryGroup;
    g.userData.pick = "bakery";
    this.scene.add(g);
    // Mixing bowl (lathe profile)
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * (Math.PI / 2);
      pts.push(new THREE.Vector2(0.05 + Math.sin(a) * 0.14, 0.14 - Math.cos(a) * 0.14 + 0.005));
    }
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), new THREE.MeshStandardMaterial({ color: "#9fb89a", roughness: 0.5, side: THREE.DoubleSide }));
    bowl.position.set(X.bowl, TOP, 0.05);
    bowl.castShadow = true;
    g.add(bowl);
    const batter = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.05, 24), new THREE.MeshStandardMaterial({ color: "#f3dfa5", roughness: 0.7 }));
    batter.position.set(X.bowl, TOP + 0.06, 0.05);
    batter.visible = false;
    g.add(batter);
    const mk = (geo: THREE.BufferGeometry, color: string, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1]) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
      m.position.set(...pos);
      m.scale.set(...scale);
      m.visible = false;
      g.add(m);
      return m;
    };
    this.bowlItems.set("egg", mk(new THREE.SphereGeometry(0.035, 12, 10), INGREDIENTS.egg.color, [X.bowl - 0.05, TOP + 0.08, 0.06], [1, 1.3, 1]));
    this.bowlItems.set("flour", mk(new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), "#fbf8f1", [X.bowl + 0.04, TOP + 0.05, 0.02]));
    this.bowlItems.set("butter", mk(new THREE.BoxGeometry(0.06, 0.03, 0.04), INGREDIENTS.butter.color, [X.bowl + 0.02, TOP + 0.07, 0.1]));
    this.bowlItems.set("wheat", mk(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 6), INGREDIENTS.wheat.color, [X.bowl - 0.02, TOP + 0.12, 0.0], [1, 1, 1]));
    // Whisk
    const wire = new THREE.MeshStandardMaterial({ color: "#d8dde0", metalness: 0.9, roughness: 0.25 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8), new THREE.MeshStandardMaterial({ color: "#e8728f" }));
    handle.position.y = 0.2;
    this.whisk.add(handle);
    for (let i = 0; i < 3; i++) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.003, 4, 16), wire);
      loop.scale.y = 2;
      loop.position.y = 0.07;
      loop.rotation.y = (i * Math.PI) / 3;
      this.whisk.add(loop);
    }
    this.whisk.position.set(X.bowl + 0.12, TOP + 0.02, 0.05);
    this.whisk.rotation.z = -0.5;
    g.add(this.whisk);

    // Tray and plate
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.02, 0.32), new THREE.MeshStandardMaterial({ color: "#6b6f74", metalness: 0.7, roughness: 0.35 }));
    tray.position.set(X.tray, TOP + 0.01, 0.08);
    tray.castShadow = true;
    g.add(tray);
    const croissantGeo = new THREE.TorusGeometry(0.06, 0.032, 10, 18, Math.PI * 1.2);
    const doughMat = new THREE.MeshStandardMaterial({ color: "#f3e2bd", roughness: 0.8 });
    const goldMat = new THREE.MeshStandardMaterial({ color: RECIPES.croissant.color, roughness: 0.55 });
    for (let i = 0; i < 2; i++) {
      const d = new THREE.Mesh(croissantGeo, doughMat);
      d.rotation.x = -Math.PI / 2;
      d.rotation.z = 0.9;
      d.position.set(-0.1 + i * 0.2, 0.04, 0);
      d.scale.set(1, 1, 0.7);
      this.trayDough.add(d);
    }
    this.trayDough.position.set(X.tray, TOP, 0.08);
    g.add(this.trayDough);
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(croissantGeo, goldMat);
      c.rotation.x = -Math.PI / 2;
      c.rotation.z = 0.9 + i * 0.3;
      c.position.set(X.tray - 0.12 + (i % 2) * 0.22, TOP + 0.05 + Math.floor(i / 2) * 0.05, 0.05 + Math.floor(i / 2) * 0.04);
      c.castShadow = true;
      c.visible = false;
      g.add(c);
      this.plateCroissants.push(c);
    }

    // Oven on the back counter
    const oven = new THREE.Group();
    oven.position.set(X.oven, 1.04, -1.55);
    g.add(oven);
    const ovenBody = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.62, 0.55), new THREE.MeshStandardMaterial({ color: "#e9dfcf", roughness: 0.45, metalness: 0.2 }));
    ovenBody.position.y = 0.31;
    ovenBody.castShadow = true;
    oven.add(ovenBody);
    const windowMat = new THREE.MeshStandardMaterial({ color: "#2a1d17", emissive: "#ff8a3d", emissiveIntensity: 0, roughness: 0.2 });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.32), windowMat);
    win.position.set(-0.08, 0.3, 0.28);
    oven.add(win);
    const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 8), new THREE.MeshStandardMaterial({ color: "#3b3534", metalness: 0.6 }));
    handleBar.rotation.z = Math.PI / 2;
    handleBar.position.set(-0.08, 0.52, 0.3);
    oven.add(handleBar);
    for (let i = 0; i < 2; i++) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), new THREE.MeshStandardMaterial({ color: "#e8728f" }));
      knob.rotation.x = Math.PI / 2;
      knob.position.set(0.36, 0.42 - i * 0.14, 0.29);
      oven.add(knob);
    }
    const doneLamp = new THREE.MeshStandardMaterial({ color: "#3b4a3a", emissive: "#6fe36f", emissiveIntensity: 0 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), doneLamp);
    lamp.position.set(0.36, 0.14, 0.29);
    oven.add(lamp);
    for (let i = 0; i < 2; i++) {
      const c = new THREE.Mesh(croissantGeo, goldMat);
      c.rotation.x = -Math.PI / 2;
      c.position.set(-0.2 + i * 0.22, 0.17, 0.12);
      this.ovenInside.add(c);
    }
    this.ovenInside.visible = false;
    oven.add(this.ovenInside);
    const light = new THREE.PointLight("#ff9a4d", 0, 1.6, 2);
    light.position.set(-0.08, 0.3, 0.5);
    oven.add(light);
    return { batter, windowMat, light, doneLamp };
  }

  private buildTill() {
    const g = this.tillGroup;
    g.userData.pick = "till";
    g.position.set(X.till, TOP, -0.05);
    g.rotation.y = Math.PI; // cashier side faces the barista
    this.scene.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.38), new THREE.MeshStandardMaterial({ color: "#f3c4cf", roughness: 0.5 }));
    body.position.y = 0.15;
    body.castShadow = true;
    g.add(body);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.03), new THREE.MeshStandardMaterial({ color: "#2f3b33", emissive: "#9fd69f", emissiveIntensity: 0.25 }));
    screen.position.set(0, 0.34, -0.05);
    screen.rotation.x = -0.3;
    g.add(screen);
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.34), new THREE.MeshStandardMaterial({ color: "#e8728f", roughness: 0.5 }));
    drawer.position.set(0, 0.03, 0);
    g.add(drawer);
    const coinMat = new THREE.MeshStandardMaterial({ color: "#f2c84b", metalness: 0.7, roughness: 0.3 });
    for (let i = 0; i < 3; i++) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 16), coinMat);
      coin.position.set(-0.08 + i * 0.07, 0.065, 0.05);
      drawer.add(coin);
    }
    // padlock shown while securing
    const lockMat = new THREE.MeshStandardMaterial({ color: "#f2c84b", metalness: 0.8, roughness: 0.3 });
    const lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.04), lockMat);
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI), lockMat);
    shackle.position.y = 0.04;
    this.padlock.add(lockBody, shackle);
    this.padlock.position.set(0, 0.12, 0.22);
    this.padlock.visible = false;
    g.add(this.padlock);
    return drawer;
  }

  /** Tables, chairs, windows, door and ceiling on the customer side of the counter. */
  private buildFrontOfHouse() {
    const s = this.scene;
    const wallTex = this.tex(wallTexture());
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 });
    for (const x of [-4.2, 4.2]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(9, 4), wallMat);
      side.position.set(x, 2, 2.4);
      side.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      side.receiveShadow = true;
      s.add(side);
    }
    const front = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 4), wallMat);
    front.position.set(0, 2, 5.6);
    front.rotation.y = Math.PI;
    s.add(front);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 8), new THREE.MeshStandardMaterial({ color: "#efe4d2", roughness: 1 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 3.6, 1.8);
    s.add(ceiling);
    // ceiling beams
    const beamMat = new THREE.MeshStandardMaterial({ color: "#7b4e30", roughness: 0.8 });
    for (let i = 0; i < 4; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.14, 0.18), beamMat);
      beam.position.set(0, 3.53, -1.2 + i * 2.1);
      s.add(beam);
    }
    // Shop-front windows with evening street glow, and a door
    const glowMat = new THREE.MeshBasicMaterial({ color: "#f6c98d" });
    const frameMat = new THREE.MeshStandardMaterial({ color: "#f4ece0", roughness: 0.6 });
    for (const x of [-2.3, 2.3]) {
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), glowMat);
      glow.position.set(x, 1.9, 5.58);
      glow.rotation.y = Math.PI;
      s.add(glow);
      for (const [w, h, dx, dy] of [[2.3, 0.08, 0, 0.82], [2.3, 0.08, 0, -0.82], [0.08, 1.7, -1.12, 0], [0.08, 1.7, 1.12, 0], [0.06, 1.6, 0, 0], [2.2, 0.06, 0, 0.25]]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), frameMat);
        f.position.set(x + dx, 1.9 + dy, 5.55);
        s.add(f);
      }
      // pink awning valance inside
      const val = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 0.08), new THREE.MeshStandardMaterial({ color: "#e8728f", roughness: 0.8 }));
      val.position.set(x, 2.84, 5.5);
      s.add(val);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.3, 0.08), new THREE.MeshStandardMaterial({ color: "#7f9f7a", roughness: 0.6 }));
    door.position.set(0, 1.15, 5.55);
    s.add(door);
    const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), glowMat);
    doorGlass.position.set(0, 1.6, 5.5);
    doorGlass.rotation.y = Math.PI;
    s.add(doorGlass);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshStandardMaterial({ color: "#d9b45a", metalness: 0.9, roughness: 0.25 }));
    knob.position.set(-0.4, 1.1, 5.49);
    s.add(knob);
    // warm fill for the seating area (one directional light instead of several point lights)
    const fill = new THREE.DirectionalLight("#ffd29a", 0.9);
    fill.position.set(0, 3, -1);
    fill.target.position.set(0, 0, 4);
    s.add(fill, fill.target);

    // Rug
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), new THREE.MeshStandardMaterial({ color: "#d98a9e", roughness: 1 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.2, 0.005, 3.2);
    rug.scale.set(1.4, 1, 1);
    rug.receiveShadow = true;
    s.add(rug);

    // Café tables and chairs
    const wood = new THREE.MeshPhysicalMaterial({ color: "#a8703f", roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: "#3b2a22", roughness: 0.5, metalness: 0.3 });
    const cushion = new THREE.MeshStandardMaterial({ color: "#9fb89a", roughness: 0.9 });
    const tables = [
      { x: -2.15, z: 3.15 },
      { x: 0.35, z: 3.7 },
      { x: 2.55, z: 3.0 },
    ];
    for (const t of tables) {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.05, 32), wood);
      top.position.set(t.x, 0.76, t.z);
      top.castShadow = top.receiveShadow = true;
      s.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.74, 12), dark);
      leg.position.set(t.x, 0.37, t.z);
      s.add(leg);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.03, 20), dark);
      foot.position.set(t.x, 0.015, t.z);
      s.add(foot);
      // a little vase with a flower and a mug on each table
      const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 12), new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.05, transparent: true, opacity: 0.4 }));
      vase.position.set(t.x + 0.12, 0.86, t.z);
      s.add(vase);
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: "#e8728f", roughness: 0.7 }));
      bloom.position.set(t.x + 0.12, 1.0, t.z);
      s.add(bloom);
      for (const a of [Math.PI * 0.85, -Math.PI * 0.15]) {
        const cx = t.x + Math.sin(a) * 0.72;
        const cz = t.z + Math.cos(a) * 0.72;
        const chair = new THREE.Group();
        chair.position.set(cx, 0, cz);
        chair.rotation.y = a + Math.PI;
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), wood);
        seat.position.y = 0.47;
        seat.castShadow = true;
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.38), cushion);
        pad.position.y = 0.52;
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.05), wood);
        back.position.set(0, 0.72, -0.2);
        back.castShadow = true;
        chair.add(seat, pad, back);
        for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
          const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.46, 8), wood);
          l.position.set(lx, 0.23, lz);
          chair.add(l);
        }
        s.add(chair);
      }
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 20, 1, true), new THREE.MeshStandardMaterial({ color: "#e8728f", side: THREE.DoubleSide, roughness: 0.6 }));
      shade.position.set(t.x, 2.75, t.z);
      s.add(shade);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.8), dark);
      cord.position.set(t.x, 3.2, t.z);
      s.add(cord);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: "#fff1d0", emissive: "#ffcf87", emissiveIntensity: 2 }));
      bulb.position.set(t.x, 2.65, t.z);
      s.add(bulb);
    }
    // Tall potted plants in the corners
    const leafMat = new THREE.MeshStandardMaterial({ color: "#5f8a55", roughness: 0.8 });
    for (const [x, z] of [[-3.8, 5.1], [3.8, 5.1], [-3.8, 0.9]]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.18, 0.45, 16), new THREE.MeshStandardMaterial({ color: "#d9825b", roughness: 0.8 }));
      pot.position.set(x, 0.225, z);
      pot.castShadow = true;
      s.add(pot);
      for (let i = 0; i < 9; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), leafMat);
        leaf.position.set(x + Math.cos(i * 2.4) * 0.18, 0.7 + (i % 4) * 0.22, z + Math.sin(i * 2.4) * 0.18);
        leaf.scale.set(0.6, 1.7, 0.5);
        leaf.rotation.z = Math.cos(i * 2.4) * 0.6;
        leaf.castShadow = true;
        s.add(leaf);
      }
    }
  }

  /** Where the barista stands and looks for the current station. */
  private viewRig(v: SceneView) {
    const s = v.state;
    const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    if (s.robber.active) return { pos: P(-1.7, 1.62, -0.95), look: P(-2.5, 1.0, 0.7) };
    switch (v.focus) {
      case "blender":
        this.lastFrontX = -1.0;
        return { pos: P(-1.05, 1.75, -1.42), look: P(-1.05, 1.0, 0.6) };
      case "coffee":
        this.lastFrontX = 0.2;
        return { pos: P(0.2, 1.75, -1.38), look: P(0.2, 1.0, 0.55) };
      case "donut":
        // turn around to the fryer on the back counter
        return { pos: P(-0.25, 1.62, -0.55), look: P(-0.25, 1.05, -1.55) };
      case "bakery": {
        const k = s.bakery;
        if (k.oven !== "idle" || (k.tray === "dough" && k.bowlPhase === "idle" && k.bowl.length === 0)) return { pos: P(1.5, 1.62, -0.6), look: P(1.5, 1.2, -1.6) };
        this.lastFrontX = 1.25;
        return { pos: P(1.25, 1.75, -1.38), look: P(1.25, 1.0, 0.55) };
      }
    }
  }

  private buildHands(a: Avatar) {
    for (const g of this.handParts) {
      this.hands.remove(g);
      disposeObject(g);
    }
    this.handParts = [];
    const mat = (color: string, r = 0.6) => new THREE.MeshStandardMaterial({ color, roughness: r, depthTest: false });
    const skin = mat(a.skin, 0.55);
    for (const side of [-1, 1]) {
      // Built pointing along -Z (away from the camera), palm down.
      const g = new THREE.Group();
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.046, 0.22, 14), mat("#f6efe3", 0.8));
      sleeve.rotation.x = Math.PI / 2;
      sleeve.position.z = 0.15;
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 14), mat(a.apron, 0.7));
      cuff.rotation.x = Math.PI / 2;
      cuff.position.z = 0.04;
      const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), skin);
      palm.scale.set(0.042, 0.018, 0.05);
      palm.position.z = -0.03;
      const parts: THREE.Mesh[] = [sleeve, cuff, palm];
      for (let f = 0; f < 4; f++) {
        const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.035 - Math.abs(f - 1.5) * 0.004, 3, 8), skin);
        finger.rotation.x = Math.PI / 2 + 0.25;
        finger.position.set((f - 1.5) * 0.019, -0.006, -0.085);
        parts.push(finger);
      }
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.03, 3, 8), skin);
      thumb.position.set(side * 0.042, -0.004, -0.04);
      thumb.rotation.set(Math.PI / 2, 0, side * 0.9);
      parts.push(thumb);
      parts.forEach((m, i) => {
        m.renderOrder = 20 + i;
        g.add(m);
      });
      g.userData.side = side;
      this.hands.add(g);
      this.handParts.push(g);
    }
  }

  private updateHands(t: number, s: GameState, motion: number) {
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * 0.5;
    const halfW = halfH * this.aspect;
    const busy = s.blender.phase === "blending" || s.blender.phase === "pouring" || s.coffee.phase === "brewing" || s.donut.phase === "frying" || s.bakery.bowlPhase === "whisking";
    const scale = 0.6 * Math.min(1, Math.max(0.7, this.aspect));
    for (const g of this.handParts) {
      const side = g.userData.side as number;
      const work = busy ? Math.sin(t * 9 + side) * 0.02 * motion : Math.sin(t * 1.3 + side) * 0.004 * motion;
      g.scale.setScalar(scale);
      // resting on the counter edge, just above the on-screen buttons
      const lift = Math.min(0.5, ((this.view?.insetBottom ?? 0) / Math.max(1, this.container.clientHeight)) * 2);
      g.position.set(side * halfW * 0.4, -halfH * ((this.aspect < 1 ? 0.5 : 0.78) - lift * 0.9) + work, -0.5);
      g.rotation.set(-0.75, side * 0.3, side * -0.1);
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, drag: false };
  };

  private onPointerMove = (e: PointerEvent) => {
    const p = this.pointer;
    if (p && p.id === e.pointerId) {
      if (!p.drag && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
        p.drag = true;
        try {
          this.renderer.domElement.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      if (p.drag) {
        // drag to look around (like turning your head)
        this.yaw = Math.max(-Math.PI, Math.min(Math.PI, this.yaw - (e.clientX - p.lastX) * 0.005));
        this.pitch = Math.max(-0.6, Math.min(0.6, this.pitch + (e.clientY - p.lastY) * 0.004));
        p.lastX = e.clientX;
        p.lastY = e.clientY;
      }
      return;
    }
    if (e.pointerType === "mouse") this.renderer.domElement.style.cursor = this.pickAt(e) ? "pointer" : "grab";
  };

  private onPointerUp = (e: PointerEvent) => {
    const p = this.pointer;
    this.pointer = null;
    if (!p || p.drag) return;
    const target = this.pickAt(e);
    if (target) this.onPick(target);
  };

  private onPointerCancel = () => {
    this.pointer = null;
  };

  private pickAt(e: PointerEvent): PickTarget | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables.filter((o) => o.visible), true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData.pick) return o.userData.pick as PickTarget;
        o = o.parent;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- updates

  setView(view: SceneView) {
    this.view = view;
    const s = view.state;

    // Customer
    const order = s.currentOrder;
    const cid = order?.customerId ?? null;
    if (cid !== (this.customer?.id ?? null)) {
      if (this.customer) {
        this.customerAnchor.remove(this.customer.rig.group);
        this.customer.rig.dispose();
        this.customer = null;
      }
      if (cid) {
        const rig = buildCat(CUSTOMERS[cid].coat, cid.length * 31 + cid.charCodeAt(0));
        rig.group.scale.setScalar(0.66);
        rig.group.position.y = 0.96;
        rig.group.rotation.y = Math.PI;
        this.customerAnchor.add(rig.group);
        this.customer = { id: cid, rig };
      }
    }

    // Staff
    const staffSet = new Set(s.staff);
    for (const [id, rig] of this.staffRigs) {
      if (!staffSet.has(id)) {
        this.scene.remove(rig.group);
        rig.dispose();
        this.staffRigs.delete(id);
      }
    }
    s.staff.forEach((id, i) => {
      if (!this.staffRigs.has(id)) {
        const rig = buildCat(STAFF[id].coat, 200 + i * 17, { apron: STAFF[id].apron });
        rig.group.scale.setScalar(0.5);
        rig.group.position.set(-2.3 + i * 0.55, 1.045, -1.55);
        rig.group.rotation.y = 0.15;
        this.scene.add(rig.group);
        this.staffRigs.set(id, rig);
      }
    });

    // First-person hands in the barista's colours
    const key = JSON.stringify(s.avatar);
    if (key !== this.handsKey) {
      this.handsKey = key;
      this.buildHands(s.avatar as Avatar);
    }

    // A couple of other regulars relaxing at the café tables
    // Keep the same regulars seated unless one of them just walked up to the counter.
    const unlocked = unlockedCustomers(s);
    const current = this.ambient.key ? this.ambient.key.split(",") : [];
    const keep = current.length > 0 && !current.includes(cid ?? "") && current.every((id) => unlocked.includes(id as never));
    const others = keep ? current : unlocked.filter((id) => id !== cid).slice(0, this.ambientSeats.length);
    const akey = others.join(",");
    if (akey !== this.ambient.key) {
      for (const r of this.ambient.rigs) {
        this.scene.remove(r.group);
        r.dispose();
      }
      this.ambient = {
        key: akey,
        rigs: others.map((id, i) => {
          const rig = buildCat(CUSTOMERS[id as keyof typeof CUSTOMERS].coat, id.length * 31 + id.charCodeAt(0));
          const seat = this.ambientSeats[i];
          rig.group.scale.setScalar(0.5);
          rig.group.position.set(seat.x, 0.5, seat.z);
          rig.group.rotation.y = Math.PI + seat.ry;
          this.scene.add(rig.group);
          return rig;
        }),
      };
    }

    if (view.focus !== this.lastFocus) {
      // Re-centre the view when the player switches station.
      this.lastFocus = view.focus;
      this.yaw = 0;
      this.pitch = 0;
    }

    // Blender pieces
    const pk = s.blender.phase === "idle" || s.blender.phase === "blending" ? s.blender.contents.join(",") : "";
    if (pk !== this.piecesKey) this.syncPieces(s.blender.contents, pk);

    // Station visibility
    const coffeeOn = levelAtLeast(s, RECIPES.coffee.unlockLevel);
    this.coffeeGroup.visible = coffeeOn;
    this.plant.visible = !coffeeOn;
    this.bakeryGroup.visible = levelAtLeast(s, RECIPES.croissant.unlockLevel);
    this.donutGroup.visible = levelAtLeast(s, RECIPES.donut.unlockLevel);
  }

  private syncPieces(contents: IngredientId[], key: string) {
    const prev = this.piecesKey.split(",").filter(Boolean);
    this.piecesKey = key;
    // Only add new pieces for newly added fruit; rebuild if contents shrank.
    if (contents.length < prev.length || !prev.every((p, i) => contents[i] === p)) {
      for (const p of this.pieces) {
        this.pieceGroup.remove(p.mesh);
        disposeObject(p.mesh);
      }
      this.pieces = [];
      prev.length = 0;
    }
    for (let i = prev.length; i < contents.length; i++) {
      const ing = contents[i];
      for (let k = 0; k < 3; k++) {
        const mesh = makePiece(ing);
        const angle = Math.random() * Math.PI * 2;
        const r = 0.03 + Math.random() * 0.06;
        const rest = 0.035 + this.pieces.length * 0.012;
        const y = 0.5 + k * 0.08;
        mesh.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
        mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        this.pieceGroup.add(mesh);
        this.pieces.push({ mesh, ing, y, vy: 0, rest, angle, r });
      }
    }
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(pickPixelRatio() * this.quality);
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  private lastFrame = 0;
  private slowTime = 0;
  private quality = 1; // multiplier on the device pixel-ratio cap

  /** Drop resolution (and finally shadows) when frames are consistently slow. */
  private adaptQuality(frameMs: number) {
    if (frameMs > 45) this.slowTime += frameMs;
    else this.slowTime = Math.max(0, this.slowTime - frameMs * 0.5);
    if (this.slowTime > 1200 && this.quality > 0.5) {
      this.slowTime = 0;
      this.quality = Math.max(0.5, this.quality - 0.2);
      this.renderer.setPixelRatio(pickPixelRatio() * this.quality);
      if (this.quality <= 0.5) this.renderer.shadowMap.enabled = false;
    }
  }

  /** True while a station animation is running and deserves full frame rate. */
  private busy() {
    const s = this.view?.state;
    if (!s) return false;
    return (
      s.blender.phase === "blending" ||
      s.blender.phase === "pouring" ||
      s.coffee.phase === "brewing" ||
      s.donut.phase === "frying" ||
      s.bakery.bowlPhase === "whisking"
    );
  }

  private loop = (ts = 0) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (typeof document !== "undefined" && document.hidden) return;
    // Idle scenes (breathing cats, swaying tails) render at ~30 fps to save battery.
    if (!this.busy() && ts - this.lastFrame < 31) return;
    if (this.lastFrame) this.adaptQuality(ts - this.lastFrame);
    this.lastFrame = ts;
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    const t = this.timer.getElapsed();
    this.animate(t, dt);
    this.renderer.render(this.scene, this.camera);
  };

  private animate(t: number, dt: number) {
    const v = this.view;
    if (!v) return;
    const s = v.state;
    const now = Date.now();
    const motion = v.reducedMotion ? 0.25 : 1;

    // First-person camera: standing behind the counter at eye height.
    const wide = this.aspect >= 1.2;
    const rig = this.viewRig(v);
    const hfov = 74;
    const vfov = Math.min(88, Math.max(50, (2 * Math.atan(Math.tan(((hfov / 2) * Math.PI) / 180) / this.aspect) * 180) / Math.PI));
    if (Math.abs(this.camera.fov - vfov) > 0.1) {
      this.camera.fov = vfov;
      this.camera.updateProjectionMatrix();
    }
    const k = v.reducedMotion ? 1 : Math.min(1, dt * 3.2);
    this.camPos.copy(rig.pos);
    this.camPos.y += Math.sin(t * 1.3) * 0.006 * motion; // gentle breathing
    this.camera.position.lerp(this.camPos, k);
    // apply the player's look-around offset
    const dir = this.tmpA.copy(rig.look).sub(rig.pos);
    const len = dir.length();
    const baseYaw = Math.atan2(dir.x, dir.z);
    const basePitch = Math.asin(dir.y / len);
    const yaw = baseYaw + this.yaw;
    const pitch = Math.max(-1.2, Math.min(0.9, basePitch + this.pitch));
    this.camTarget.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(len).add(rig.pos);
    this.lookAt.lerp(this.camTarget, k);
    this.camera.lookAt(this.lookAt);
    this.updateHands(t, s, motion);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const ox = Math.round((v.insetRight ?? 0) / 2);
    const oy = Math.round(Math.min(h * 0.4, v.insetBottom ?? 0) / 2);
    if (ox || oy) this.camera.setViewOffset(w, h, ox, oy, w, h);
    else if (this.camera.view) this.camera.clearViewOffset();

    // The customer sits across the counter, near whatever front station you're using.
    const custX = this.lastFrontX + (wide ? 0.85 : 0.5);
    this.customerAnchor.position.x += (custX - this.customerAnchor.position.x) * (v.reducedMotion ? 1 : Math.min(1, dt * 2.5));
    this.customerAnchor.position.z = 0.95;
    if (this.customer) {
      const toCam = Math.atan2(this.camera.position.x - this.customerAnchor.position.x, this.camera.position.z - this.customerAnchor.position.z);
      this.customer.rig.group.rotation.y = toCam;
      this.customer.rig.update(t, dt, v.happy ? "happy" : "idle", motion);
    }
    this.ambient.rigs.forEach((r, i) => r.update(t + i * 2.3, dt, "idle", motion * 0.7));

    // Hearts when the customer is served
    if (v.happy && !this.lastHappy && this.customer) this.burstHearts();
    this.lastHappy = v.happy;
    for (const h of this.hearts) {
      if (h.life <= 0) continue;
      h.life -= dt;
      h.s.position.y += dt * 0.35;
      h.s.position.x += Math.sin(t * 3 + h.s.id) * dt * 0.08;
      (h.s.material as THREE.SpriteMaterial).opacity = Math.min(1, h.life);
      if (h.life <= 0) h.s.visible = false;
    }

    let i = 0;
    for (const rig of this.staffRigs.values()) rig.update(t + i++ * 1.7, dt, "working", motion);

    // Bandit
    const robber = s.robber.active;
    if (robber) this.banditAnchor.visible = true;
    const bx = robber ? -2.75 : -4.8;
    this.banditAnchor.position.x += (bx - this.banditAnchor.position.x) * Math.min(1, dt * (robber ? 1.5 : 2.5));
    if (!robber && this.banditAnchor.position.x < -4.5) this.banditAnchor.visible = false;
    this.banditAnchor.rotation.y = robber ? Math.PI - 0.5 : -1.2;
    if (this.banditAnchor.visible) this.bandit.update(t, dt, "sneaky", motion);
    this.tillDrawer.position.z = robber ? 0.12 + Math.sin(t * 3) * 0.02 * motion : 0;
    this.padlock.visible = !robber && s.robber.stopped > 0 && this.banditAnchor.visible;

    this.animateBlender(t, dt, now, motion);
    this.animateCoffee(t, dt, now, motion);
    this.animateDonut(t, now, motion);
    this.animateBakery(t, now, motion);
  }

  private lookAt = new THREE.Vector3(0, 1.3, 0);
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  private animateBlender(t: number, dt: number, now: number, motion: number) {
    const s = this.view!.state;
    const b = s.blender;
    const resultColor = b.result ? RECIPES[b.result].color : "#f7b6c8";
    const home = new THREE.Vector3(X.blender, TOP + 0.26, 0);
    let jarPos = home.clone();
    let tilt = 0;
    let fill = 0;
    this.stream.visible = false;
    this.onLight.emissiveIntensity = b.phase === "blending" ? 2 : 0;

    if (b.phase === "idle" || b.phase === "blending") {
      const p = b.phase === "blending" ? progress(b.endsAt, DURATIONS.blend, now) : 0;
      // pieces fall in, then swirl and dissolve while blending
      for (const piece of this.pieces) {
        if (b.phase === "idle") {
          piece.vy -= 3.5 * dt;
          piece.y = Math.max(piece.rest, piece.y + piece.vy * dt);
          if (piece.y === piece.rest) piece.vy = 0;
          piece.mesh.position.set(Math.cos(piece.angle) * piece.r, piece.y, Math.sin(piece.angle) * piece.r);
          piece.mesh.scale.setScalar(1);
        } else {
          piece.angle += dt * (5 + 18 * p) * (0.4 + motion * 0.6);
          const r = 0.05 + piece.r * 0.8 * (1 + 0.3 * Math.sin(p * 6));
          const y = 0.05 + (0.12 + 0.1 * Math.sin(piece.angle * 0.7)) * smooth(0, 0.3, p);
          piece.mesh.position.set(Math.cos(piece.angle) * r, y, Math.sin(piece.angle) * r);
          piece.mesh.rotation.x += dt * 8 * motion;
          piece.mesh.rotation.y += dt * 6 * motion;
          piece.mesh.scale.setScalar(Math.max(0.001, 1.15 - 1.15 * smooth(0.45, 0.95, p)));
        }
      }
      if (b.phase === "blending") {
        fill = smooth(0.15, 1, p) * 0.36;
        this.jarLiquidMat.opacity = 0.55 + 0.4 * smooth(0.6, 1, p);
        const startColor = new THREE.Color("#fdf5f2");
        this.jarLiquidMat.color.copy(startColor).lerp(new THREE.Color(resultColor), smooth(0.1, 0.85, p));
        this.blades.rotation.y += dt * 70 * (0.3 + motion * 0.7);
        const jig = 0.007 * motion;
        jarPos.x += Math.sin(t * 73) * jig;
        jarPos.z += Math.cos(t * 61) * jig;
        tilt = Math.sin(t * 57) * 0.025 * motion;
        this.blenderBase.position.x = X.blender + Math.sin(t * 80) * jig * 0.6;
      } else {
        this.blenderBase.position.x = X.blender;
      }
      this.pieceGroup.visible = true;
    } else {
      this.pieceGroup.visible = false;
      this.blenderBase.position.x = X.blender;
      this.jarLiquidMat.color.set(resultColor);
      this.jarLiquidMat.opacity = 0.95;
      fill = 0.36;
      if (b.phase === "pouring") {
        const p = progress(b.endsAt, DURATIONS.pour, now);
        const lift = smooth(0, 0.22, p) * (1 - smooth(0.85, 1, p));
        const target = new THREE.Vector3(X.cup - 0.34, TOP + 0.5, 0.05);
        jarPos = home.clone().lerp(target, lift);
        tilt = -1.3 * lift;
        fill = 0.36 * (1 - smooth(0.25, 0.85, p));
        const pouring = p > 0.22 && p < 0.88;
        if (pouring) {
          // stream from the jar lip to the cup surface
          this.jar.position.copy(jarPos);
          this.jar.rotation.z = tilt;
          this.jar.updateMatrixWorld();
          const lip = this.jar.localToWorld(this.tmpA.set(0.17, 0.5, 0));
          const cupTop = this.tmpB.set(X.cup, TOP + 0.02 + this.cupFill * 0.22, 0.05);
          const dir = cupTop.clone().sub(lip);
          const len = dir.length();
          this.stream.visible = true;
          this.stream.position.copy(lip);
          this.stream.quaternion.setFromUnitVectors(this.up, dir.normalize());
          this.stream.scale.set(1 + Math.sin(t * 30) * 0.1 * motion, len, 1);
          this.streamMat.color.set(resultColor);
        }
      }
    }
    this.jar.position.copy(jarPos);
    this.jar.rotation.z = tilt;
    this.jarLiquid.visible = fill > 0.004;
    this.jarLiquid.scale.y = Math.max(0.0001, fill);
    if (b.phase === "blended") this.jarLiquid.scale.y = fill * (1 + Math.sin(t * 2) * 0.01 * motion);

    // Cup
    let cupTarget = 0;
    let cupColor = resultColor;
    if (s.cup) {
      cupTarget = 1;
      cupColor = RECIPES[s.cup].color;
    } else if (b.phase === "pouring") {
      cupTarget = smooth(0.25, 0.88, progress(b.endsAt, DURATIONS.pour, now));
    }
    this.cupFill = b.phase === "pouring" || !s.cup ? cupTarget : this.cupFill + (cupTarget - this.cupFill) * Math.min(1, dt * 6);
    this.cupLiquid.visible = this.cupFill > 0.01;
    this.cupLiquid.scale.y = Math.max(0.0001, this.cupFill * 0.23);
    this.cupLiquidMat.color.set(cupColor);
    this.cupTopping.visible = this.straw.visible = !!s.cup;
  }

  private animateCoffee(t: number, dt: number, now: number, motion: number) {
    if (!this.coffeeGroup.visible) return;
    const c = this.view!.state.coffee;
    this.beanPile.visible = c.beans > 0;
    let fill = 0;
    if (c.phase === "brewing") fill = smooth(0.1, 1, progress(c.endsAt, DURATIONS.brew, now));
    if (c.phase === "ready") fill = 1;
    this.coffeeStream.visible = c.phase === "brewing";
    this.coffeeLiquid.visible = fill > 0.01;
    this.coffeeLiquid.scale.y = Math.max(0.0001, fill * 0.09);
    this.steam.forEach((sp, i) => {
      const m = sp.material as THREE.SpriteMaterial;
      if (c.phase === "idle") {
        m.opacity = 0;
        return;
      }
      const ph = (t * 0.6 + i / this.steam.length) % 1;
      sp.position.y = 0.14 + ph * 0.25;
      sp.position.x = Math.sin(t * 2 + i) * 0.02 * motion;
      m.opacity = (1 - ph) * 0.5;
      sp.scale.setScalar(0.06 + ph * 0.08);
    });
    void dt;
  }

  private animateBakery(t: number, now: number, motion: number) {
    if (!this.bakeryGroup.visible) return;
    const k = this.view!.state.bakery;
    for (const [id, obj] of this.bowlItems) obj.visible = k.bowlPhase === "idle" && k.bowl.includes(id);
    this.batter.visible = k.bowlPhase !== "idle";
    if (k.bowlPhase === "whisking") {
      const p = progress(k.whiskEndsAt, DURATIONS.whisk, now);
      this.batter.visible = p > 0.3;
      this.whisk.position.set(X.bowl + Math.cos(t * 12 * motion) * 0.05, TOP + 0.02, 0.05 + Math.sin(t * 12 * motion) * 0.05);
      this.whisk.rotation.z = -0.2;
    } else {
      this.whisk.position.set(X.bowl + 0.16, TOP + 0.02, 0.1);
      this.whisk.rotation.z = -0.5;
    }
    this.trayDough.visible = k.tray === "dough";
    const baking = k.oven === "baking";
    const glow = baking ? 1.2 + Math.sin(t * 3) * 0.25 * motion : k.oven === "done" ? 0.5 : 0;
    this.ovenWindowMat.emissiveIntensity = glow;
    this.ovenLight.intensity = glow * 1.5;
    this.ovenDoneLamp.emissiveIntensity = k.oven === "done" ? 2 : 0;
    this.ovenInside.visible = k.oven !== "idle";
    if (baking) {
      const p = progress(k.ovenEndsAt, DURATIONS.bake, now);
      const col = new THREE.Color("#f3e2bd").lerp(new THREE.Color(RECIPES.croissant.color), p);
      this.ovenInside.children.forEach((c) => ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).color.copy(col));
    } else {
      this.ovenInside.children.forEach((c) => ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(RECIPES.croissant.color));
    }
    this.plateCroissants.forEach((c, i) => (c.visible = i < k.croissants));
  }

  private burstHearts() {
    const head = this.customer!.rig.head;
    const p = head.getWorldPosition(new THREE.Vector3());
    for (let i = 0; i < 5; i++) {
      let h = this.hearts.find((x) => x.life <= 0);
      if (!h) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.heartTex, transparent: true, depthWrite: false }));
        this.scene.add(s);
        h = { s, life: 0 };
        this.hearts.push(h);
      }
      h.life = 1.4 + i * 0.15;
      h.s.visible = true;
      h.s.scale.setScalar(0.12 + Math.random() * 0.06);
      h.s.position.set(p.x + (Math.random() - 0.5) * 0.3, p.y + 0.15 + i * 0.05, p.z + 0.05);
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.customer?.rig.dispose();
    this.bandit.dispose();
    for (const r of this.ambient.rigs) r.dispose();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointercancel", this.onPointerCancel);
    this.envTex?.dispose();
    for (const r of this.staffRigs.values()) r.dispose();
    disposeObject(this.scene);
    for (const t of this.textures) t.dispose();
    this.timer.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

function levelAtLeast(s: GameState, level: number) {
  return s.xp >= xpForLevel(level);
}

function makePiece(ing: IngredientId): THREE.Object3D {
  if (ing === "strawberry") {
    const g = new THREE.Group();
    const berry = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), new THREE.MeshStandardMaterial({ color: "#e23b52", roughness: 0.4 }));
    berry.scale.set(1, 1.25, 1);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.02, 6), new THREE.MeshStandardMaterial({ color: "#4f9a46" }));
    leaf.position.y = 0.05;
    leaf.rotation.x = Math.PI;
    g.add(berry, leaf);
    return g;
  }
  const slice = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.028, 16), new THREE.MeshStandardMaterial({ color: "#f8eab8", roughness: 0.6 }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.006, 6, 16), new THREE.MeshStandardMaterial({ color: "#f0cf4f", roughness: 0.5 }));
  rim.rotation.x = Math.PI / 2;
  const g = new THREE.Group();
  g.add(slice, rim);
  return g;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
