import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_HDRI_VARIANT_MAP,
} from "../../config/poolRoyaleInventoryConfig.js";

/**
 * File: src/TableTennis3D_VanillaThree.tsx
 *
 * User request:
 * - Keep gameplay logic exactly the same.
 * - Pull camera a bit farther from the table.
 * - Slightly more power.
 *
 * NOTE: Only constants CAM.zBase and POWER serve/hit speeds were adjusted.
 * Everything else (rules/physics/AI/controls) remains identical.
 */

type ErrState = { error: unknown | null; message: string; stack: string };
class ErrorBoundary extends Component<{ children?: React.ReactNode }, ErrState> {
  constructor(p: any) {
    super(p);
    this.state = { error: null, message: "", stack: "" };
  }
  static getDerivedStateFromError(error: unknown): ErrState {
    const e: any = error;
    return {
      error: error ?? null,
      message: typeof e?.message === "string" ? e.message : String(error ?? "Unknown error"),
      stack: typeof e?.stack === "string" ? e.stack : "(no stack)",
    };
  }
  render() {
    if (!this.state.error) return (this.props.children as React.ReactNode) || null;
    return (
      <div style={{ inset: 0, position: "absolute", display: "flex", alignItems: "center", justifyContent: "center", background: "#111" }}>
        <div style={{ color: "#fff", maxWidth: 760, padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>React render error</div>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "#222", padding: 12, borderRadius: 8 }}>{this.state.message + "\n\n" + this.state.stack}</pre>
        </div>
      </div>
    );
  }
}

type Side = "player" | "ai";
type Difficulty = "easy" | "medium" | "hard";
type Phase = "ready" | "serving" | "rally" | "gameOver";
type Call = "" | "SERVE" | "FAULT" | "LET" | "NET" | "OUT" | "DOUBLE" | "MISS";

type Score = { player: number; ai: number; server: Side; pointsPlayed: number };

type Gesture = { active: boolean; x: number; y: number; lastX: number; lastY: number; vx: number; vy: number; lastT: number };

type BallState = {
  p: THREE.Vector3;
  v: THREE.Vector3;
  spin: THREE.Vector3;
  served: boolean;
  lastBounceSide: Side | null;
  bouncesOnSide: number;
  serveBounce1: Side | null;
  serveBounce2: Side | null;
  netTouchedThisRally: boolean;
};

const M2U = 2.6;
const U = (m: number) => m * M2U;

const TIME_SCALE = 0.62;

const TABLE = {
  // Match the Pool Royale 9ft footprint so venue placement and framing align.
  L: U(2.54),
  W: U(1.27),
  H: U(0.76),
  THICK: U(0.03),
  APRON_H: U(0.10),
  LEG_H: U(0.68),
} as const;

const NET = { H: U(0.1525), T: U(0.02), POST_R: U(0.012), POST_H: U(0.18) } as const;
const BALL = { R: U(0.02) } as const;

const PADDLE = {
  bladeW: U(0.15),
  bladeH: U(0.02),
  bladeD: U(0.19),
  handleW: U(0.032),
  handleD: U(0.11),
  y: TABLE.H + U(0.12),
  reach: U(0.18),
} as const;

const PHYS = {
  g: -9.81 * M2U,
  dtClamp: 1 / 50,
  airDrag: 0.9989,
  tableRest: 0.86,
  netRest: 0.18,
  magnus: 0.00082,
  spinDamp: 0.995,
  maxSpeed: U(9.8),
} as const;

const POWER = {
  serveSpeedBase: U(3.15),
  serveSpeedMax: U(4.1),
  serveUpMin: U(1.05),
  hitSpeedBase: U(2.5),
  hitSpeedMax: U(7.3),
  targetZPad: U(0.45),
  swipeXToSpin: 0.00062,
  swipeYToSpin: 0.00046,
  edgeSpinK: 0.010,
} as const;

const AI = {
  lerp: { easy: 0.11, medium: 0.16, hard: 0.21 },
  react: { easy: 0.12, medium: 0.19, hard: 0.28 },
  jitter: { easy: U(0.10), medium: U(0.06), hard: U(0.04) },
  hitChance: { easy: 0.88, medium: 0.95, hard: 0.985 },
  serveDelayMs: { easy: 900, medium: 750, hard: 620 },
  sideBias: { easy: 0.62, medium: 0.8, hard: 0.93 },
  aimStrength: { easy: 0.58, medium: 0.8, hard: 0.98 },
  spinStrength: { easy: 0.55, medium: 0.75, hard: 0.95 },
  hitPowerScale: { easy: 0.76, medium: 0.84, hard: 0.92 },
  powerMix: {
    easy: [0.7, 0.84, 0.96],
    medium: [0.82, 0.98, 1.1],
    hard: [0.92, 1.08, 1.24],
  },
  sideTargets: {
    easy: [-0.35, 0, 0.35],
    medium: [-0.58, -0.14, 0.18, 0.62],
    hard: [-0.75, -0.42, -0.05, 0.24, 0.54, 0.78],
  },
} as const;

const CAM = {
  follow: 0.07,
  yBase: TABLE.H + U(0.72),
  zBase: TABLE.L * 1.06,
} as const;

const FRAME_RATE_OPTIONS = Object.freeze([
  { id: "hd50", label: "HD Performance (50 Hz)", fps: 50, pixelRatioCap: 1.35 },
  { id: "fhd90", label: "Full HD (90 Hz)", fps: 90, pixelRatioCap: 1.55 },
  { id: "qhd105", label: "Quad HD (105 Hz)", fps: 105, pixelRatioCap: 1.72 },
  { id: "uhd120", label: "Ultra HD (120 Hz cap)", fps: 120, pixelRatioCap: 1.85 },
] as const);
type FrameRateId = (typeof FRAME_RATE_OPTIONS)[number]["id"];
const FRAME_RATE_MAP = Object.freeze(
  FRAME_RATE_OPTIONS.reduce((acc, option) => {
    acc[option.id] = option;
    return acc;
  }, {} as Record<FrameRateId, (typeof FRAME_RATE_OPTIONS)[number]>)
);

const DEFAULT_DIFFICULTY: Difficulty = "medium";

type GraphicsQuality = "low" | "medium" | "high";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sgn = (v: number) => (v >= 0 ? 1 : -1);

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || (c.getContext as any)("experimental-webgl"));
  } catch {
    return false;
  }
}

function pickPolyHavenHdriUrl(apiJson: unknown, preferredResolutions: string[] = []) {
  const urls: string[] = [];
  const walk = (value: unknown) => {
    if (!value) return;
    if (typeof value === "string") {
      if (value.startsWith("http") && value.toLowerCase().includes(".hdr")) urls.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(walk);
    }
  };
  walk(apiJson);
  const lower = urls.map((u) => u.toLowerCase());
  for (const res of preferredResolutions) {
    const match = lower.find((u) => u.includes(`_${res}.`));
    if (match) return urls[lower.indexOf(match)] ?? null;
  }
  return urls[0] ?? null;
}

async function resolvePolyHavenHdriUrl(config: any = {}) {
  const preferred = Array.isArray(config?.preferredResolutions) && config.preferredResolutions.length
    ? config.preferredResolutions
    : ["2k"];
  const fallbackRes = config?.fallbackResolution || preferred[0] || "2k";
  const fallbackUrl = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${fallbackRes}/${config?.assetId ?? "neon_photostudio"}_${fallbackRes}.hdr`;
  if (typeof config?.assetUrl === "string" && config.assetUrl.length) return config.assetUrl;
  if (!config?.assetId || typeof fetch !== "function") return fallbackUrl;
  try {
    const response = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(config.assetId)}`);
    if (!response?.ok) return fallbackUrl;
    const json = await response.json();
    return pickPolyHavenHdriUrl(json, preferred) || fallbackUrl;
  } catch {
    return fallbackUrl;
  }
}

function observeResize(el: HTMLElement, cb: () => void) {
  const anyWin: any = window as any;
  if (typeof anyWin.ResizeObserver !== "undefined") {
    const ro = new anyWin.ResizeObserver(cb);
    ro.observe(el);
    return () => ro.disconnect();
  }
  const onResize = () => cb();
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}

function isGameOver(s: Score) {
  if (s.player >= 11 || s.ai >= 11) return Math.abs(s.player - s.ai) >= 2;
  return false;
}

function nextServer(s: Score): Side {
  const deuce = s.player >= 10 && s.ai >= 10;
  if (deuce) return s.pointsPlayed % 2 === 0 ? s.server : s.server === "player" ? "ai" : "player";
  return Math.floor(s.pointsPlayed / 2) % 2 === 0 ? "player" : "ai";
}

function sideOfZ(z: number): Side {
  return z >= 0 ? "player" : "ai";
}

function swipeMag(g: Gesture) {
  const sx = Math.abs(g.vx) * 1000;
  const sy = Math.abs(g.vy) * 1000;
  return Math.hypot(sx, sy);
}

function serveSpeedFromSwipe(g: Gesture) {
  const t = clamp(swipeMag(g) / 2.6, 0, 1);
  return lerp(POWER.serveSpeedBase, POWER.serveSpeedMax, t);
}

function hitSpeedFromSwipe(g: Gesture) {
  const t = clamp(swipeMag(g) / 2.2, 0, 1);
  return lerp(POWER.hitSpeedBase, POWER.hitSpeedMax, t);
}

function pickAiSideTarget(diff: Difficulty) {
  const lanes = AI.sideTargets[diff];
  const index = Math.floor(Math.random() * lanes.length);
  return lanes[index];
}

function pickAiPowerFactor(diff: Difficulty) {
  const options = AI.powerMix[diff];
  return options[Math.floor(Math.random() * options.length)];
}

function useTouch(rootRef: React.RefObject<HTMLDivElement>) {
  const g = useRef<Gesture>({ active: false, x: 0.5, y: 0.72, lastX: 0.5, lastY: 0.72, vx: 0, vy: 0, lastT: 0 });

  const update = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const nx = clamp((clientX - r.left) / r.width, 0, 1);
      const ny = clamp((clientY - r.top) / r.height, 0, 1);
      const t = performance.now();
      const dt = Math.max(1, t - g.current.lastT);
      const vx = (nx - g.current.lastX) / dt;
      const vy = (ny - g.current.lastY) / dt;
      g.current.vx = lerp(g.current.vx, vx, 0.72);
      g.current.vy = lerp(g.current.vy, vy, 0.72);
      g.current.lastX = nx;
      g.current.lastY = ny;
      g.current.lastT = t;
      g.current.x = nx;
      g.current.y = ny;
    },
    [rootRef]
  );

  const onDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      g.current.active = true;
      g.current.lastT = performance.now();
      update(e.clientX, e.clientY);
    },
    [update]
  );

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!g.current.active) return;
      update(e.clientX, e.clientY);
    },
    [update]
  );

  const onUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    g.current.active = false;
    g.current.vx *= 0.6;
    g.current.vy *= 0.6;
  }, []);

  return { g, onDown, onMove, onUp };
}

const PADDLE_SCALE = 1.18;
const BASE_HEAD_RADIUS = 0.4049601584672928;

function makeWeaveTex(w = 256, h = 256) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) {
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    tex.needsUpdate = true;
    return tex;
  }
  ctx.fillStyle = "#e9e9e9";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#dcdcdc";
  for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) if (((x + y) / 8) % 2 < 1) ctx.fillRect(x, y, 8, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 2);
  return tex;
}

function makeNetAlpha(w = 512, h = 256, pitch = 10) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) {
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    tex.needsUpdate = true;
    return tex;
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#fff";
  for (let y = 3; y < h; y += pitch) for (let x = 3; x < w; x += pitch) ctx.fillRect(x, y, pitch - 6, pitch - 6);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 2);
  return tex;
}

function createMaterials() {
  return {
    whiteMat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.0 }),
    tableMat: new THREE.MeshStandardMaterial({ color: 0x0a2d57, roughness: 0.82, metalness: 0.05 }),
    apronMat: new THREE.MeshStandardMaterial({ color: 0x10204d, roughness: 0.82, metalness: 0.05 }),
    steelMat: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.3, metalness: 0.8 }),
    wheelMat: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, metalness: 0.1 }),
    woodMat: new THREE.MeshStandardMaterial({ color: 0x8d5622, roughness: 0.6, metalness: 0.05 }),
    netMat: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0,
      alphaMap: makeNetAlpha(),
      map: makeWeaveTex(),
      transparent: true,
      side: THREE.DoubleSide,
    }),
  };
}

function buildTableLikeSnippet() {
  const m = createMaterials();
  const g = new THREE.Group();

  const top = new THREE.Mesh(new THREE.BoxGeometry(TABLE.W, TABLE.THICK, TABLE.L), m.tableMat);
  top.position.set(0, TABLE.H - TABLE.THICK / 2, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  const apronDepth = U(0.025);
  const apronGeoF = new THREE.BoxGeometry(TABLE.W + U(0.04), apronDepth, U(0.02));
  const apronFront = new THREE.Mesh(apronGeoF, m.apronMat);
  apronFront.position.set(0, TABLE.H - TABLE.THICK - apronDepth / 2, TABLE.L / 2 + U(0.01));
  const apronBack = apronFront.clone();
  apronBack.position.z = -TABLE.L / 2 - U(0.01);
  g.add(apronFront, apronBack);

  const sideApronGeo = new THREE.BoxGeometry(U(0.02), apronDepth, TABLE.L + U(0.04));
  const apronLeft = new THREE.Mesh(sideApronGeo, m.apronMat);
  apronLeft.position.set(-TABLE.W / 2 - U(0.01), TABLE.H - TABLE.THICK - apronDepth / 2, 0);
  const apronRight = apronLeft.clone();
  apronRight.position.x = TABLE.W / 2 + U(0.01);
  g.add(apronLeft, apronRight);

  const borderT = U(0.018);
  const lineH = U(0.0025);
  const lineY = TABLE.H + lineH / 2;
  const mkLine = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m.whiteMat);
    mesh.position.set(x, y, z);
    g.add(mesh);
  };

  mkLine(borderT, lineH, TABLE.L, -TABLE.W / 2 + borderT / 2, lineY, 0);
  mkLine(borderT, lineH, TABLE.L, TABLE.W / 2 - borderT / 2, lineY, 0);
  mkLine(TABLE.W, lineH, borderT, 0, lineY, TABLE.L / 2 - borderT / 2);
  mkLine(TABLE.W, lineH, borderT, 0, lineY, -TABLE.L / 2 + borderT / 2);
  mkLine(borderT, lineH, TABLE.L - borderT * 2, 0, lineY, 0);

  const netGroup = new THREE.Group();
  g.add(netGroup);

  const postR = U(0.012);
  const netWidth = TABLE.W + postR * 1.2;
  const netPlane = new THREE.Mesh(new THREE.PlaneGeometry(netWidth, NET.H), m.netMat);
  netPlane.position.set(0, TABLE.H + NET.H / 2, 0);
  netGroup.add(netPlane);

  const bandT = U(0.014);
  const bandTop = new THREE.Mesh(new THREE.BoxGeometry(netWidth, bandT, U(0.004)), m.whiteMat);
  bandTop.position.set(0, TABLE.H + NET.H - bandT / 2, 0);
  const bandBottom = bandTop.clone();
  bandBottom.position.set(0, TABLE.H + bandT / 2, 0);
  netGroup.add(bandTop, bandBottom);

  const postH = NET.H + U(0.08);
  const postGeo = new THREE.CylinderGeometry(postR, postR, postH, 28);
  const postRight = new THREE.Mesh(postGeo, m.steelMat);
  postRight.position.set(TABLE.W / 2 + postR * 0.6, TABLE.H + postH / 2, 0);
  const postLeft = postRight.clone();
  postLeft.position.x = -TABLE.W / 2 - postR * 0.6;
  g.add(postRight, postLeft);

  const clampGeo = new THREE.BoxGeometry(U(0.06), U(0.025), U(0.05));
  const clampRight = new THREE.Mesh(clampGeo, m.steelMat);
  clampRight.position.set(TABLE.W / 2 + U(0.03), TABLE.H + U(0.03), 0);
  const clampLeft = clampRight.clone();
  clampLeft.position.x = -TABLE.W / 2 - U(0.03);
  g.add(clampRight, clampLeft);

  const tubeR = U(0.02);
  const wheelRadius = U(0.035);
  const wheelThickness = U(0.02);
  const legClearance = U(0.004);
  const legH = TABLE.H - TABLE.THICK - legClearance - wheelRadius;
  const offsetZ = TABLE.L * 0.36;
  const offsetX = TABLE.W * 0.42;

  const frame = (zSign: number) => {
    const G = new THREE.Group();
    const upGeo = new THREE.CylinderGeometry(tubeR, tubeR, legH, 26);
    const upL = new THREE.Mesh(upGeo, m.steelMat);
    const upR = new THREE.Mesh(upGeo, m.steelMat);
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, offsetX * 2, 26), m.steelMat);

    upL.position.set(-offsetX, wheelRadius + legH / 2, zSign * offsetZ);
    upR.position.set(offsetX, wheelRadius + legH / 2, zSign * offsetZ);
    cross.rotation.z = Math.PI / 2;
    cross.position.set(0, wheelRadius + U(0.11), zSign * offsetZ);
    G.add(upL, upR, cross);

    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 24);
    const wL = new THREE.Mesh(wheelGeo, m.wheelMat);
    const wR = wL.clone();
    wL.rotation.x = Math.PI / 2;
    wR.rotation.x = Math.PI / 2;
    wL.position.set(-offsetX, wheelRadius, zSign * offsetZ);
    wR.position.set(offsetX, wheelRadius, zSign * offsetZ);
    G.add(wL, wR);

    g.add(G);
  };
  frame(-1);
  frame(1);

  return { group: g, materials: m };
}

function buildCurvedPaddle(frontHex: number, backHex: number, woodMat: THREE.Material) {
  const group = new THREE.Group();

  const headRadius = BASE_HEAD_RADIUS;
  const sh = new THREE.Shape();
  sh.absellipse(0, 0, headRadius, headRadius * 0.92, 0, Math.PI * 2, false, 0);

  const headFrontMat = new THREE.MeshStandardMaterial({ color: frontHex, roughness: 0.7, metalness: 0.05 });
  const headBackMat = new THREE.MeshStandardMaterial({ color: backHex, roughness: 0.7, metalness: 0.05 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.2 });

  const headFront = new THREE.Mesh(
    new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.003, curveSegments: 64, steps: 1 }),
    headFrontMat
  );
  headFront.rotation.x = Math.PI / 2;
  headFront.position.y = 0.001;

  const headBack = headFront.clone();
  headBack.material = headBackMat;
  headBack.position.y = -0.005;

  const headEdge = new THREE.Mesh(new THREE.TorusGeometry(headRadius, 0.004, 16, 96), edgeMat);
  headEdge.rotation.x = Math.PI / 2;

  const HANDLE_DEPTH = 0.028;
  const s = new THREE.Shape();
  const hw = 0.11;
  const hh = 0.24;
  const rr = 0.06;
  s.moveTo(-hw + rr, -hh);
  s.lineTo(hw - rr, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + rr);
  s.lineTo(hw, hh - rr);
  s.quadraticCurveTo(hw, hh, hw - rr, hh);
  s.lineTo(-hw + rr, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - rr);
  s.lineTo(-hw, -hh + rr);
  s.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);

  const handleGeo = new THREE.ExtrudeGeometry(s, { depth: HANDLE_DEPTH, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, curveSegments: 64, steps: 1 });
  handleGeo.rotateX(Math.PI / 2);

  const handle = new THREE.Mesh(handleGeo, woodMat);
  handle.position.set(0, -0.28, 0.01);

  group.add(headFront, headBack, headEdge, handle);

  const desiredHeadRadiusWorld = PADDLE.bladeW * 0.62;
  const scale = (desiredHeadRadiusWorld / headRadius) * PADDLE_SCALE;
  group.scale.setScalar(scale);

  return group;
}

export default function TableTennisRoyal() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const { g, onDown, onMove, onUp } = useTouch(rootRef);

  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>("high");
  const [frameRateId, setFrameRateId] = useState<FrameRateId>("fhd90");
  const [environmentHdriId, setEnvironmentHdriId] = useState<string>(POOL_ROYALE_DEFAULT_HDRI_ID);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const difficultyRef = useRef<Difficulty>(DEFAULT_DIFFICULTY);
  const graphicsQualityRef = useRef<GraphicsQuality>("high");
  const frameRateRef = useRef<(typeof FRAME_RATE_OPTIONS)[number]>(FRAME_RATE_MAP.fhd90);
  const me = useMemo(() => {
    if (typeof window === "undefined") return { username: "You", avatar: "/assets/icons/profile.svg" };
    const params = new URLSearchParams(window.location.search);
    const rawName = params.get("username") || params.get("player") || params.get("name") || "";
    const username = rawName.trim() || "You";
    const avatar = params.get("avatar") || "/assets/icons/profile.svg";
    return { username, avatar };
  }, []);
  const rival = useMemo(() => {
    if (typeof window === "undefined") return { username: "AI Bot", avatar: "/assets/icons/profile.svg" };
    const params = new URLSearchParams(window.location.search);
    const rawName = params.get("opponent") || params.get("opponentName") || params.get("aiName") || "AI Bot";
    const username = rawName.trim() || "AI Bot";
    const avatar = params.get("opponentAvatar") || "/assets/icons/profile.svg";
    return { username, avatar };
  }, []);
  useEffect(() => {
    graphicsQualityRef.current = graphicsQuality;
  }, [graphicsQuality]);
  useEffect(() => {
    frameRateRef.current = FRAME_RATE_MAP[frameRateId] ?? FRAME_RATE_OPTIONS[0];
  }, [frameRateId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const gfx = params.get("graphics") as GraphicsQuality | null;
    if (gfx === "low" || gfx === "medium" || gfx === "high") {
      setGraphicsQuality(gfx);
    }
    const fps = params.get("fps");
    if (fps && FRAME_RATE_MAP[fps as FrameRateId]) {
      setFrameRateId(fps as FrameRateId);
    }
  }, []);

  const [ui, setUi] = useState<{ phase: Phase; score: Score; call: Call; hint: string }>({
    phase: "ready",
    score: { player: 0, ai: 0, server: "player", pointsPlayed: 0 },
    call: "",
    hint: "Tap to serve",
  });

  const [boot, setBoot] = useState<string>("Booting…");
  const [fatal, setFatal] = useState<string>("");
  const [announcement, setAnnouncement] = useState<string>("");
  const announcementTimeoutRef = useRef<number | null>(null);

  const aiServeAt = useRef<number>(0);
  const lastFrameAtRef = useRef<number>(0);
  const lightRig = useRef<{ ambient: THREE.AmbientLight; key: THREE.DirectionalLight } | null>(null);
  const hdriHandle = useRef<{ envMap: THREE.Texture | null; bgMap: THREE.Texture | null } | null>(null);

  const sim = useRef<{ phase: Phase; score: Score; ball: BallState; call: Call; hint: string; callCooldownUntil: number }>({
    phase: "ready",
    score: { player: 0, ai: 0, server: "player", pointsPlayed: 0 },
    call: "",
    hint: "Tap to serve",
    callCooldownUntil: 0,
    ball: {
      p: new THREE.Vector3(0, TABLE.H + U(0.23), TABLE.L * 0.25),
      v: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      served: false,
      lastBounceSide: null,
      bouncesOnSide: 0,
      serveBounce1: null,
      serveBounce2: null,
      netTouchedThisRally: false,
    },
  });

  const three = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    clock: THREE.Clock;
    raf: number;
    table: THREE.Group;
    paddleP: THREE.Group;
    paddleA: THREE.Group;
    ballM: THREE.Mesh;
  } | null>(null);

  const setCallRef = useCallback((c: Call) => {
    const now = performance.now();
    if (now < sim.current.callCooldownUntil && c === "NET") return;
    sim.current.call = c;
    if (c === "NET") sim.current.callCooldownUntil = now + 250;
  }, []);

  const showAnnouncement = useCallback((text: string) => {
    if (!text) return;
    setAnnouncement(text);
    if (announcementTimeoutRef.current) {
      window.clearTimeout(announcementTimeoutRef.current);
    }
    announcementTimeoutRef.current = window.setTimeout(() => {
      setAnnouncement("");
      announcementTimeoutRef.current = null;
    }, 1300);
  }, []);

  useEffect(() => {
    return () => {
      if (announcementTimeoutRef.current) {
        window.clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!ui.call) return;
    if (ui.call === "NET") showAnnouncement("NET");
    else if (ui.call === "OUT") showAnnouncement("OUT");
    else if (ui.call === "FAULT" || ui.call === "DOUBLE" || ui.call === "MISS") showAnnouncement("FOUL");
  }, [showAnnouncement, ui.call]);

  const syncUiFromSim = useCallback(() => {
    const s = sim.current;
    setUi({ phase: s.phase, score: { ...s.score }, call: s.call, hint: s.hint });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      syncUiFromSim();
    }, 100);
    return () => window.clearInterval(id);
  }, [syncUiFromSim]);

  const placeForServe = useCallback(
    (srv: Side) => {
      const s = sim.current;
      const b = s.ball;
      const z = srv === "player" ? TABLE.L * 0.25 : -TABLE.L * 0.25;

      b.p.set(0, TABLE.H + U(0.23), z);
      b.v.set(0, 0, 0);
      b.spin.set(0, 0, 0);
      b.served = false;
      b.lastBounceSide = null;
      b.bouncesOnSide = 0;
      b.serveBounce1 = null;
      b.serveBounce2 = null;
      b.netTouchedThisRally = false;

      s.phase = "ready";
      s.call = "";
      s.hint = srv === "player" ? "Tap to serve" : "AI serving…";

      const t = three.current;
      if (t) {
        t.ballM.position.copy(b.p);
        t.paddleP.position.set(0, PADDLE.y, TABLE.L * 0.25);
        t.paddleA.position.set(0, PADDLE.y, -TABLE.L * 0.25);
      }

      aiServeAt.current = performance.now() + AI.serveDelayMs[difficultyRef.current];
    },
    [difficultyRef]
  );

  const awardPoint = useCallback(
    (winner: Side, call: Call) => {
      const s = sim.current;
      if (winner === "player") s.score.player += 1;
      else s.score.ai += 1;
      s.score.pointsPlayed += 1;

      showAnnouncement(winner === "player" ? "POINT YOU" : "POINT AI");

      s.call = call;

      if (isGameOver(s.score)) {
        s.phase = "gameOver";
        s.hint = winner === "player" ? "You win!" : "AI wins";
        return;
      }

      s.score.server = nextServer(s.score);
      placeForServe(s.score.server);
    },
    [placeForServe, showAnnouncement]
  );

  const serve = useCallback(() => {
    const s = sim.current;
    const b = s.ball;
    if (s.phase !== "ready") return;
    if (s.score.server !== "player") return;

    s.phase = "serving";
    s.call = "SERVE";
    s.hint = "";

    const targetX = lerp(-TABLE.W / 2 + U(0.18), TABLE.W / 2 - U(0.18), g.current.lastX);
    const targetZ = -TABLE.L / 2 + POWER.targetZPad;

    const speed = serveSpeedFromSwipe(g.current);

    const tmpTarget = new THREE.Vector3(targetX, TABLE.H + U(0.14), targetZ);
    const tmpDir = new THREE.Vector3().subVectors(tmpTarget, b.p);
    if (tmpDir.lengthSq() > 1e-9) {
      tmpDir.normalize();
      b.v.copy(tmpDir.multiplyScalar(speed));
      b.v.y = Math.max(b.v.y, POWER.serveUpMin);
    }

    const swipeX = g.current.vx * 1000;
    const swipeY = g.current.vy * 1000;
    b.spin.set(-swipeY * POWER.swipeYToSpin, swipeX * POWER.swipeXToSpin, 0);

    b.served = true;
  }, [g]);

  const reset = useCallback(() => {
    const s = sim.current;
    s.score = { player: 0, ai: 0, server: "player", pointsPlayed: 0 };
    s.phase = "ready";
    s.call = "";
    s.hint = "Tap to serve";
    placeForServe("player");
  }, [placeForServe]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const safeFail = (msg: string, err?: unknown) => {
      const extra = err ? `\n${String((err as any)?.stack ?? (err as any)?.message ?? err)}` : "";
      setFatal(msg + extra);
    };

    try {
      setBoot("Checking WebGL…");
      if (typeof document === "undefined") return;
      if (!hasWebGL()) {
        safeFail("WebGL is not available. Enable hardware acceleration or try another browser.");
        return;
      }

      setBoot("Creating renderer…");
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(frameRateRef.current.pixelRatioCap, window.devicePixelRatio || 1));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.04;
      renderer.domElement.style.position = "absolute";
      renderer.domElement.style.inset = "0";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";

      setBoot("Building scene…");
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#070b1a");
      const camera = new THREE.PerspectiveCamera(55, 1, 0.01, U(300));

      const ambient = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambient);
      const key = new THREE.DirectionalLight(0xffffff, 1.25);
      key.position.set(U(2.2), U(4.2), U(2.2));
      key.castShadow = graphicsQualityRef.current !== "low";
      key.shadow.mapSize.set(graphicsQualityRef.current === "high" ? 2048 : 1024, graphicsQualityRef.current === "high" ? 2048 : 1024);
      scene.add(key);
      lightRig.current = { ambient, key };

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(U(30), U(30)),
        new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.24 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0;
      floor.receiveShadow = true;
      scene.add(floor);

      const { group: table, materials } = buildTableLikeSnippet();
      scene.add(table);

      const playerPaddle = new THREE.Group();
      const pFancy = buildCurvedPaddle(0xff4d6d, 0x333333, materials.woodMat);
      const pWrist = new THREE.Group();
      pWrist.rotation.set(THREE.MathUtils.degToRad(-18), 0, THREE.MathUtils.degToRad(12));
      pWrist.add(pFancy);
      playerPaddle.add(pWrist);
      playerPaddle.position.set(0, PADDLE.y, TABLE.L * 0.25);
      table.add(playerPaddle);

      const aiPaddle = new THREE.Group();
      const aFancy = buildCurvedPaddle(0x49dcb1, 0x333333, materials.woodMat);
      const aWrist = new THREE.Group();
      aWrist.rotation.set(THREE.MathUtils.degToRad(-22), 0, THREE.MathUtils.degToRad(-12));
      aWrist.add(aFancy);
      aiPaddle.add(aWrist);
      aiPaddle.position.set(0, PADDLE.y, -TABLE.L * 0.25);
      table.add(aiPaddle);

      const ballM = new THREE.Mesh(new THREE.SphereGeometry(BALL.R, 26, 26), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.0 }));
      ballM.castShadow = true;
      ballM.position.copy(sim.current.ball.p);
      table.add(ballM);

      const clock = new THREE.Clock();

      mount.style.position = "absolute";
      mount.style.inset = "0";
      mount.appendChild(renderer.domElement);

      const resize = () => {
        const w = mount.clientWidth || 1;
        const h = mount.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.fov = w < h ? 58 : 55;
        camera.updateProjectionMatrix();
      };

      const unobs = observeResize(mount, resize);
      resize();

      three.current = { renderer, scene, camera, clock, raf: 0, table, paddleP: playerPaddle, paddleA: aiPaddle, ballM };

      placeForServe(sim.current.score.server);
      setBoot("");

      const tmpTarget = new THREE.Vector3();
      const tmpDir = new THREE.Vector3();
      const tmpCross = new THREE.Vector3();

      const tick = () => {
        try {
          const t = three.current;
          if (!t) return;

          const nowMs = performance.now();
          const targetIntervalMs = 1000 / Math.max(30, frameRateRef.current.fps || 60);
          if (nowMs - lastFrameAtRef.current < targetIntervalMs) {
            t.raf = requestAnimationFrame(tick);
            return;
          }
          lastFrameAtRef.current = nowMs;

          const dtRaw = Math.min(t.clock.getDelta(), PHYS.dtClamp);
          const dt = dtRaw * TIME_SCALE;

          const s = sim.current;
          const b = s.ball;
          const diff = difficultyRef.current;

          {
            const px = lerp(-TABLE.W / 2 + U(0.18), TABLE.W / 2 - U(0.18), g.current.x);
            const pz = lerp(U(0.12), TABLE.L / 2 - U(0.22), g.current.y);
            t.paddleP.position.x = lerp(t.paddleP.position.x, px, 0.30);
            t.paddleP.position.z = lerp(t.paddleP.position.z, pz, 0.30);
            t.paddleP.position.y = PADDLE.y;
          }

          {
            const predX = b.p.x + b.v.x * AI.react[diff];
            const wantX = b.p.z < 0 ? predX : 0;
            const jitter = (Math.random() * 2 - 1) * AI.jitter[diff];
            const ax = clamp(wantX + jitter, -TABLE.W / 2 + U(0.18), TABLE.W / 2 - U(0.18));
            const az = -TABLE.L / 2 + U(0.22);
            t.paddleA.position.x = lerp(t.paddleA.position.x, ax, AI.lerp[diff]);
            t.paddleA.position.z = lerp(t.paddleA.position.z, az, AI.lerp[diff] * 0.92);
            t.paddleA.position.y = PADDLE.y;
          }

          {
            const targetX = t.paddleP.position.x * 0.20 + b.p.x * 0.06;
            const targetY = CAM.yBase + b.p.y * 0.08;
            const targetZ = CAM.zBase + b.p.z * 0.06;
            t.camera.position.x = lerp(t.camera.position.x, targetX, CAM.follow);
            t.camera.position.y = lerp(t.camera.position.y, targetY, CAM.follow);
            t.camera.position.z = lerp(t.camera.position.z, targetZ, CAM.follow);
            t.camera.lookAt(b.p.x * 0.10, TABLE.H + U(0.22) + b.p.y * 0.03, -TABLE.L * 0.06);
          }

          if (s.phase === "ready" && s.score.server === "ai" && !b.served && performance.now() >= aiServeAt.current) {
            s.phase = "serving";
            s.call = "SERVE";
            s.hint = "";

            const lane = pickAiSideTarget(diff);
            const wide = Math.random() < AI.sideBias[diff];
            const laneBlend = wide ? lane : lane * 0.6;
            const targetX = clamp((TABLE.W * 0.5) * laneBlend, -TABLE.W / 2 + U(0.18), TABLE.W / 2 - U(0.18));
            const targetZ = TABLE.L / 2 - POWER.targetZPad;
            tmpTarget.set(targetX, TABLE.H + U(0.14), targetZ);

            const speed = POWER.serveSpeedBase * AI.hitPowerScale[diff] * pickAiPowerFactor(diff);
            tmpDir.subVectors(tmpTarget, b.p);
            if (tmpDir.lengthSq() > 1e-9) {
              tmpDir.normalize();
              b.v.copy(tmpDir.multiplyScalar(speed));
              b.v.y = Math.max(b.v.y, POWER.serveUpMin);
            }

            b.spin.set(0, -targetX * 0.0010 * AI.spinStrength[diff], 0);
            b.served = true;
          }

          if (s.phase === "gameOver") {
            t.renderer.render(t.scene, t.camera);
            t.raf = requestAnimationFrame(tick);
            return;
          }

          if (s.phase === "ready" && !b.served) {
            const refP = s.score.server === "player" ? t.paddleP : t.paddleA;
            b.p.set(refP.position.x, TABLE.H + U(0.23), refP.position.z + (s.score.server === "player" ? -U(0.10) : U(0.10)));
            t.ballM.position.copy(b.p);
            t.renderer.render(t.scene, t.camera);
            t.raf = requestAnimationFrame(tick);
            return;
          }

          tmpCross.crossVectors(b.spin, b.v).multiplyScalar(PHYS.magnus);
          b.v.addScaledVector(tmpCross, dt);
          b.v.y += PHYS.g * dt;
          b.v.multiplyScalar(PHYS.airDrag);
          b.spin.multiplyScalar(PHYS.spinDamp);
          if (b.v.length() > PHYS.maxSpeed) b.v.setLength(PHYS.maxSpeed);
          b.p.addScaledVector(b.v, dt);

          {
            const inZ = Math.abs(b.p.z) <= NET.T / 2 + BALL.R;
            const inX = Math.abs(b.p.x) <= TABLE.W / 2 + BALL.R;
            const inY = b.p.y <= TABLE.H + NET.H + BALL.R;
            if (inZ && inX && inY) {
              b.netTouchedThisRally = true;
              setCallRef("NET");
              b.v.z = -b.v.z * PHYS.netRest;
              b.p.z = sgn(b.p.z) * (NET.T / 2 + BALL.R + U(0.001));
            }
          }

          {
            const topY = TABLE.H + TABLE.THICK / 2;
            const inX = Math.abs(b.p.x) <= TABLE.W / 2;
            const inZ = Math.abs(b.p.z) <= TABLE.L / 2;
            if (b.p.y - BALL.R <= topY && inX && inZ && b.v.y < 0) {
              b.p.y = topY + BALL.R;
              b.v.y = -b.v.y * PHYS.tableRest;

              const side = sideOfZ(b.p.z);
              if (b.lastBounceSide === side) b.bouncesOnSide += 1;
              else {
                b.lastBounceSide = side;
                b.bouncesOnSide = 1;
              }

              if (s.phase === "serving") {
                if (b.serveBounce1 == null) b.serveBounce1 = side;
                else if (b.serveBounce2 == null && side !== b.serveBounce1) b.serveBounce2 = side;

                const serverSide: Side = s.score.server;
                const receiverSide: Side = s.score.server === "player" ? "ai" : "player";

                if (b.serveBounce1 !== serverSide) {
                  awardPoint(receiverSide, "FAULT");
                  t.raf = requestAnimationFrame(tick);
                  return;
                }

                if (b.serveBounce2 === receiverSide) {
                  s.phase = "rally";
                  if (!b.netTouchedThisRally) s.call = "";
                }
              }

              if (s.phase === "rally" && b.bouncesOnSide >= 2) {
                awardPoint(side === "player" ? "ai" : "player", "DOUBLE");
                t.raf = requestAnimationFrame(tick);
                return;
              }
            }
          }

          {
            const outXZ = Math.abs(b.p.x) > TABLE.W / 2 + U(0.30) || Math.abs(b.p.z) > TABLE.L / 2 + U(0.55);
            const floorHit = b.p.y - BALL.R <= 0;
            if (floorHit || outXZ) {
              const side = sideOfZ(b.p.z);
              awardPoint(side === "player" ? "ai" : "player", outXZ ? "OUT" : "MISS");
              t.raf = requestAnimationFrame(tick);
              return;
            }
          }

          const tryHit = (pad: THREE.Object3D, who: Side) => {
            const dx = b.p.x - pad.position.x;
            const dz = b.p.z - pad.position.z;
            if (Math.hypot(dx, dz) > PADDLE.reach + BALL.R) return false;
            if (Math.abs(b.p.y - pad.position.y) > U(0.28)) return false;

            if (who === "ai" && Math.random() > AI.hitChance[diff]) return false;

            if (who === "player") {
              const targetX = lerp(-TABLE.W / 2 + U(0.18), TABLE.W / 2 - U(0.18), g.current.x);
              const targetZ = -TABLE.L / 2 + POWER.targetZPad;
              tmpTarget.set(targetX, TABLE.H + U(0.14), targetZ);

              const speed = hitSpeedFromSwipe(g.current);
              tmpDir.subVectors(tmpTarget, b.p);
              if (tmpDir.lengthSq() > 1e-9) {
                tmpDir.normalize();
                b.v.copy(tmpDir.multiplyScalar(speed));
                b.v.z = -Math.abs(b.v.z);
                b.v.y = Math.max(b.v.y, U(1.05));
              }

              const edge = clamp(dx / (PADDLE.bladeW * 0.5), -1, 1);
              const edgeSpin = edge * POWER.edgeSpinK;
              b.spin.x += (-g.current.vy * 1000) * POWER.swipeYToSpin;
              b.spin.y += (g.current.vx * 1000) * POWER.swipeXToSpin + edgeSpin;
            } else {
              const lane = pickAiSideTarget(diff);
              const wide = Math.random() < AI.sideBias[diff];
              const targetLane = wide ? lane : lane * 0.52;
              const targetX = clamp((TABLE.W * 0.5) * targetLane, -TABLE.W / 2 + U(0.18), TABLE.W / 2 - U(0.18));
              const targetZ = TABLE.L / 2 - POWER.targetZPad;
              tmpTarget.set(targetX, TABLE.H + U(0.14), targetZ);

              const base =
                lerp(POWER.hitSpeedBase, POWER.hitSpeedMax * 0.78, AI.aimStrength[diff]) *
                AI.hitPowerScale[diff] *
                pickAiPowerFactor(diff);
              tmpDir.subVectors(tmpTarget, b.p);
              if (tmpDir.lengthSq() > 1e-9) {
                tmpDir.normalize();
                b.v.copy(tmpDir.multiplyScalar(base));
                b.v.z = Math.abs(b.v.z);
                b.v.y = Math.max(b.v.y, U(1.00));
              }

              const edge = clamp(dx / (PADDLE.bladeW * 0.5), -1, 1);
              const edgeSpin = edge * POWER.edgeSpinK * AI.spinStrength[diff];
              b.spin.x += (Math.random() * 2 - 1) * U(0.10) * AI.spinStrength[diff];
              b.spin.y += (Math.random() * 2 - 1) * U(0.14) * AI.spinStrength[diff] + edgeSpin;
            }

            b.lastBounceSide = null;
            b.bouncesOnSide = 0;
            b.netTouchedThisRally = false;
            s.phase = "rally";
            s.call = "";
            return true;
          };

          tryHit(t.paddleP, "player");
          tryHit(t.paddleA, "ai");

          t.ballM.position.copy(b.p);
          t.renderer.render(t.scene, t.camera);
          t.raf = requestAnimationFrame(tick);
        } catch (e) {
          setFatal("Runtime error:\n" + String((e as any)?.stack ?? e));
        }
      };

      three.current!.raf = requestAnimationFrame(tick);

      return () => {
        unobs();
        const t = three.current;
        if (t) {
          cancelAnimationFrame(t.raf);
          try {
            mount.removeChild(t.renderer.domElement);
          } catch {}
          t.renderer.dispose();
          t.scene.traverse((o) => {
            const m = (o as any).material;
            const gg = (o as any).geometry;
            if (gg?.dispose) gg.dispose();
            if (m) {
              if (Array.isArray(m)) m.forEach((mm) => mm?.dispose?.());
              else m.dispose?.();
            }
          });
        }
        if (hdriHandle.current?.envMap) hdriHandle.current.envMap.dispose();
        if (hdriHandle.current?.bgMap) hdriHandle.current.bgMap.dispose();
        hdriHandle.current = null;
        three.current = null;
        lightRig.current = null;
      };
    } catch (e) {
      safeFail("Init error:", e);
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awardPoint, difficultyRef, g, placeForServe, serve, setCallRef]);


  useEffect(() => {
    const t = three.current;
    const rig = lightRig.current;
    if (!t || !rig) return;

    const frameProfile = FRAME_RATE_MAP[frameRateId] ?? FRAME_RATE_OPTIONS[0];
    const qualityCap = graphicsQuality === "high" ? 2 : graphicsQuality === "medium" ? 1.5 : 1;
    t.renderer.setPixelRatio(Math.min(qualityCap, frameProfile.pixelRatioCap, window.devicePixelRatio || 1));
    rig.key.castShadow = graphicsQuality !== "low";
    const shadowSize = graphicsQuality === "high" ? 2048 : graphicsQuality === "medium" ? 1024 : 512;
    rig.key.shadow.mapSize.set(shadowSize, shadowSize);
  }, [frameRateId, graphicsQuality]);

  useEffect(() => {
    const t = three.current;
    if (!t) return;
    let disposed = false;
    const variant = POOL_ROYALE_HDRI_VARIANT_MAP[environmentHdriId] ?? POOL_ROYALE_HDRI_VARIANTS[0];
    const applyFallback = () => {
      t.scene.environment = null;
      t.scene.background = new THREE.Color("#070b1a");
      t.renderer.toneMappingExposure = 1.04;
    };

    resolvePolyHavenHdriUrl(variant)
      .then(
        (url) =>
          new Promise<THREE.Texture>((resolve, reject) => {
            const loader = new RGBELoader();
            loader.setCrossOrigin?.("anonymous");
            loader.load(url, resolve, undefined, reject);
          })
      )
      .then((texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        const pmrem = new THREE.PMREMGenerator(t.renderer);
        const envMap = pmrem.fromEquirectangular(texture).texture;
        pmrem.dispose();
        texture.mapping = THREE.EquirectangularReflectionMapping;
        t.scene.environment = envMap;
        t.scene.background = texture;
        t.renderer.toneMappingExposure = Number.isFinite(variant?.exposure) ? variant.exposure : 1.04;
        if (hdriHandle.current?.envMap) hdriHandle.current.envMap.dispose();
        if (hdriHandle.current?.bgMap) hdriHandle.current.bgMap.dispose();
        hdriHandle.current = { envMap, bgMap: texture };
      })
      .catch(() => {
        if (!disposed) applyFallback();
      });

    return () => {
      disposed = true;
    };
  }, [environmentHdriId]);

  const phaseLabel = ui.phase === "ready" ? "READY" : ui.phase === "serving" ? "SERVE" : ui.phase === "rally" ? "RALLY" : "GAME";
  const serverLabel = ui.score.server === "player" ? "YOU" : "AI";

  return (
    <ErrorBoundary>
      <div
        ref={rootRef}
        className="w-full h-[92vh] relative select-none"
        style={{ background: "#070b1a", touchAction: "none" }}
        onPointerDown={(e) => {
          onDown(e);
          if (sim.current.phase === "ready" && sim.current.score.server === "player") serve();
        }}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

        {(boot || fatal) && (
          <div style={{ position: "absolute", left: 8, top: 56, right: 8, background: fatal ? "rgba(180,0,0,0.55)" : "rgba(0,0,0,0.55)", color: "#fff", fontSize: 12, padding: "8px 10px", borderRadius: 14, pointerEvents: "none" }}>
            {fatal ? fatal : boot}
          </div>
        )}

        <div style={{ position: "absolute", left: 0, right: 0, top: 8, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div
            style={{
              background: "linear-gradient(180deg, rgba(23,28,40,0.96), rgba(7,9,16,0.93))",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "#fff",
              fontSize: 12,
              padding: "8px 12px",
              borderRadius: 16,
              display: "flex",
              gap: 10,
              alignItems: "center",
              boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
              width: "min(94vw, 560px)",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <img src={me.avatar} alt={`${me.username} avatar`} style={{ width: 26, height: 26, borderRadius: 99, border: "2px solid rgba(255,255,255,0.65)", objectFit: "cover" }} />
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: 10, opacity: 0.72 }}>PLAYER</span>
                <span style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }}>{me.username}</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, letterSpacing: 0.3 }}>
              <span>{ui.score.player}</span>
              <span style={{ opacity: 0.65 }}>:</span>
              <span>{ui.score.ai}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, justifyContent: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", minWidth: 0 }}>
                <span style={{ fontSize: 10, opacity: 0.72 }}>OPPONENT</span>
                <span style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }}>{rival.username}</span>
              </div>
              <img src={rival.avatar} alt={`${rival.username} avatar`} style={{ width: 26, height: 26, borderRadius: 99, border: "2px solid rgba(255,255,255,0.65)", objectFit: "cover" }} />
            </div>
          </div>
        </div>

        <div style={{ position: "absolute", right: 8, top: 66, display: "flex", gap: 8, alignItems: "center", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 11, padding: "6px 10px", borderRadius: 12 }}>
          <span style={{ opacity: 0.85 }}>SERVER {serverLabel}</span>
          <span style={{ opacity: 0.55 }}>•</span>
          <span style={{ opacity: 0.85 }}>{phaseLabel}</span>
          {ui.call && (
            <>
              <span style={{ opacity: 0.55 }}>•</span>
              <span style={{ fontWeight: 800 }}>{ui.call}</span>
            </>
          )}
        </div>

        {ui.hint && (
          <div style={{ position: "absolute", left: 8, top: 92, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 12, padding: "8px 10px", borderRadius: 14 }}>
            {ui.hint}
          </div>
        )}

        {announcement && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "46%",
              transform: "translate(-50%, -50%)",
              padding: "12px 20px",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.35)",
              background: "rgba(6,8,18,0.78)",
              color: "#fff",
              fontSize: "clamp(26px, 7vw, 56px)",
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textShadow: "0 8px 18px rgba(0,0,0,0.7)",
              pointerEvents: "none",
            }}
          >
            {announcement}
          </div>
        )}

        <div style={{ position: "absolute", left: 8, top: 8, zIndex: 20 }}>
          <button
            onClick={() => setShowTableMenu((v) => !v)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.28)",
              background: "rgba(0,0,0,0.66)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 18,
            }}
            aria-label="Open table menu"
            title="Table setup"
          >
            ⚙️
          </button>
          {showTableMenu && (
            <div style={{ marginTop: 8, width: 220, background: "rgba(5,10,20,0.92)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 12, padding: 10, color: "#fff", fontSize: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Table Setup</div>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                <span>Graphics</span>
                <select value={graphicsQuality} onChange={(e) => setGraphicsQuality(e.target.value as GraphicsQuality)} style={{ padding: "6px 8px", borderRadius: 8, fontSize: 12 }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                <span>FPS profile</span>
                <select value={frameRateId} onChange={(e) => setFrameRateId(e.target.value as FrameRateId)} style={{ padding: "6px 8px", borderRadius: 8, fontSize: 12 }}>
                  {FRAME_RATE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                <span>Venue HDRI</span>
                <select value={environmentHdriId} onChange={(e) => setEnvironmentHdriId(e.target.value)} style={{ padding: "6px 8px", borderRadius: 8, fontSize: 12 }}>
                  {POOL_ROYALE_HDRI_VARIANTS.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={reset} style={{ width: "100%", padding: "6px 10px", borderRadius: 8, fontSize: 12 }}>
                Reset match
              </button>
            </div>
          )}
        </div>

        <div style={{ position: "absolute", right: 8, bottom: 8, maxWidth: 560, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 12, padding: "8px 10px", borderRadius: 14 }}>
          Drag to move paddle • Tap to serve • Aim with finger X • Swipe faster = more speed
        </div>
      </div>
    </ErrorBoundary>
  );
}
