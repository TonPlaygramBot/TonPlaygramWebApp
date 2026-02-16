import React, { Component, useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type ErrState = { error: unknown | null; message: string; stack: string };
class ErrorBoundary extends Component<{ children?: React.ReactNode }, ErrState> {
  constructor(p: any) {
    super(p);
    this.state = { error: null, message: '', stack: '' };
  }
  static getDerivedStateFromError(error: unknown): ErrState {
    const e: any = error;
    return {
      error: error ?? null,
      message: typeof e?.message === 'string' ? e.message : String(error ?? 'Unknown error'),
      stack: typeof e?.stack === 'string' ? e.stack : '(no stack)',
    };
  }
  render() {
    if (!this.state.error) return (this.props.children as React.ReactNode) || null;
    return (
      <div style={{ inset: 0, position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
        <div style={{ color: '#fff', maxWidth: 760, padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>React render error</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#222', padding: 12, borderRadius: 8 }}>{this.state.message + '\n\n' + this.state.stack}</pre>
        </div>
      </div>
    );
  }
}

type Side = 'player' | 'ai';
type Difficulty = 'easy' | 'medium' | 'hard';
type Phase = 'ready' | 'serving' | 'rally' | 'gameOver';
type Call = '' | 'SERVE' | 'FAULT' | 'LET' | 'NET' | 'OUT' | 'DOUBLE' | 'MISS';

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

const TABLE = { L: U(2.74), W: U(1.525), H: U(0.76), THICK: U(0.03), APRON_H: U(0.10), LEG_H: U(0.68) } as const;
const NET = { H: U(0.1525), T: U(0.02), POST_R: U(0.012), POST_H: U(0.18) } as const;
const BALL = { R: U(0.02) } as const;
const PADDLE = { bladeW: U(0.15), bladeH: U(0.02), bladeD: U(0.19), handleW: U(0.032), handleD: U(0.11), y: TABLE.H + U(0.12), reach: U(0.18) } as const;

const PHYS = {
  g: -9.81 * M2U,
  dtClamp: 1 / 50,
  airDrag: 0.9996,
  tableRest: 0.82,
  netRest: 0.18,
  magnus: 0.00115,
  spinDamp: 0.9978,
  maxSpeed: U(11.0),
} as const;

const POWER = {
  serveSpeedBase: U(3.0),
  serveSpeedMax: U(4.1),
  serveUpMin: U(1.05),
  hitSpeedBase: U(2.35),
  hitSpeedMax: U(7.6),
  targetZPad: U(0.45),
  swipeXToSpin: 0.00062,
  swipeYToSpin: 0.00046,
  edgeSpinK: 0.010,
} as const;

const AI = {
  lerp: { easy: 0.10, medium: 0.15, hard: 0.19 },
  react: { easy: 0.10, medium: 0.16, hard: 0.22 },
  jitter: { easy: U(0.10), medium: U(0.06), hard: U(0.04) },
  hitChance: { easy: 0.86, medium: 0.93, hard: 0.97 },
  serveDelayMs: { easy: 900, medium: 750, hard: 620 },
  sideBias: { easy: 0.60, medium: 0.75, hard: 0.88 },
  aimStrength: { easy: 0.55, medium: 0.75, hard: 0.95 },
  spinStrength: { easy: 0.55, medium: 0.75, hard: 0.95 },
  hitPowerScale: { easy: 0.72, medium: 0.78, hard: 0.84 },
} as const;

const CAM = { follow: 0.07, yBase: TABLE.H + U(0.72), zBase: TABLE.L * 0.88 } as const;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sgn = (v: number) => (v >= 0 ? 1 : -1);

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl') || (c.getContext as any)('experimental-webgl'));
  } catch {
    return false;
  }
}

function observeResize(el: HTMLElement, cb: () => void) {
  const anyWin: any = window as any;
  if (typeof anyWin.ResizeObserver !== 'undefined') {
    const ro = new anyWin.ResizeObserver(cb);
    ro.observe(el);
    return () => ro.disconnect();
  }
  const onResize = () => cb();
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}

function isGameOver(s: Score) {
  if (s.player >= 11 || s.ai >= 11) return Math.abs(s.player - s.ai) >= 2;
  return false;
}

function nextServer(s: Score): Side {
  const deuce = s.player >= 10 && s.ai >= 10;
  if (deuce) return s.pointsPlayed % 2 === 0 ? s.server : s.server === 'player' ? 'ai' : 'player';
  return Math.floor(s.pointsPlayed / 2) % 2 === 0 ? 'player' : 'ai';
}

function sideOfZ(z: number): Side {
  return z >= 0 ? 'player' : 'ai';
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

function useTouch(rootRef: React.RefObject<HTMLDivElement>) {
  const g = useRef<Gesture>({ active: false, x: 0.5, y: 0.72, lastX: 0.5, lastY: 0.72, vx: 0, vy: 0, lastT: 0 });
  const update = useCallback((clientX: number, clientY: number) => {
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
  }, [rootRef]);

  const onDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    g.current.active = true;
    g.current.lastT = performance.now();
    update(e.clientX, e.clientY);
  }, [update]);

  const onMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!g.current.active) return;
    update(e.clientX, e.clientY);
  }, [update]);

  const onUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    g.current.active = false;
    g.current.vx *= 0.6;
    g.current.vy *= 0.6;
  }, []);

  return { g, onDown, onMove, onUp };
}

const PADDLE_SCALE = 1.18;
const BASE_HEAD_RADIUS = 0.4049601584672928;

function makeWeaveTex(w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) {
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    tex.needsUpdate = true;
    return tex;
  }
  ctx.fillStyle = '#e9e9e9';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#dcdcdc';
  for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) if (((x + y) / 8) % 2 < 1) ctx.fillRect(x, y, 8, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 2);
  return tex;
}

function makeNetAlpha(w = 512, h = 256, pitch = 10) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) {
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    tex.needsUpdate = true;
    return tex;
  }
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#fff';
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
    netMat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0, alphaMap: makeNetAlpha(), map: makeWeaveTex(), transparent: true, side: THREE.DoubleSide }),
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

  const headFront = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.003, curveSegments: 64, steps: 1 }), headFrontMat);
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

  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const difficultyRef = useRef<Difficulty>('medium');
  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  const [ui, setUi] = useState<{ phase: Phase; score: Score; call: Call; hint: string }>({ phase: 'ready', score: { player: 0, ai: 0, server: 'player', pointsPlayed: 0 }, call: '', hint: 'Tap to serve' });
  const [boot, setBoot] = useState<string>('Booting…');
  const [fatal, setFatal] = useState<string>('');
  const aiServeAt = useRef<number>(0);

  const sim = useRef<{ phase: Phase; score: Score; ball: BallState; call: Call; hint: string; callCooldownUntil: number }>({
    phase: 'ready',
    score: { player: 0, ai: 0, server: 'player', pointsPlayed: 0 },
    call: '',
    hint: 'Tap to serve',
    callCooldownUntil: 0,
    ball: { p: new THREE.Vector3(0, TABLE.H + U(0.23), TABLE.L * 0.25), v: new THREE.Vector3(), spin: new THREE.Vector3(), served: false, lastBounceSide: null, bouncesOnSide: 0, serveBounce1: null, serveBounce2: null, netTouchedThisRally: false },
  });

  const three = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; clock: THREE.Clock; raf: number; table: THREE.Group; paddleP: THREE.Group; paddleA: THREE.Group; ballM: THREE.Mesh } | null>(null);

  const setCallRef = useCallback((c: Call) => {
    const now = performance.now();
    if (now < sim.current.callCooldownUntil && c === 'NET') return;
    sim.current.call = c;
    if (c === 'NET') sim.current.callCooldownUntil = now + 250;
  }, []);

  const syncUiFromSim = useCallback(() => {
    const s = sim.current;
    setUi({ phase: s.phase, score: { ...s.score }, call: s.call, hint: s.hint });
  }, []);

  useEffect(() => {
    const id = window.setInterval(syncUiFromSim, 100);
    return () => window.clearInterval(id);
  }, [syncUiFromSim]);

  const placeForServe = useCallback((srv: Side) => {
    const s = sim.current;
    const b = s.ball;
    const z = srv === 'player' ? TABLE.L * 0.25 : -TABLE.L * 0.25;
    b.p.set(0, TABLE.H + U(0.23), z);
    b.v.set(0, 0, 0);
    b.spin.set(0, 0, 0);
    b.served = false;
    b.lastBounceSide = null;
    b.bouncesOnSide = 0;
    b.serveBounce1 = null;
    b.serveBounce2 = null;
    b.netTouchedThisRally = false;
    s.phase = 'ready';
    s.call = '';
    s.hint = srv === 'player' ? 'Tap to serve' : 'AI serving…';

    const t = three.current;
    if (t) {
      t.ballM.position.copy(b.p);
      t.paddleP.position.set(0, PADDLE.y, TABLE.L * 0.25);
      t.paddleA.position.set(0, PADDLE.y, -TABLE.L * 0.25);
    }
    aiServeAt.current = performance.now() + AI.serveDelayMs[difficultyRef.current];
  }, []);

  const awardPoint = useCallback((winner: Side, call: Call) => {
    const s = sim.current;
    if (winner === 'player') s.score.player += 1;
    else s.score.ai += 1;
    s.score.pointsPlayed += 1;
    s.call = call;
    if (isGameOver(s.score)) {
      s.phase = 'gameOver';
      s.hint = winner === 'player' ? 'You win!' : 'AI wins';
      return;
    }
    s.score.server = nextServer(s.score);
    placeForServe(s.score.server);
  }, [placeForServe]);

  const serve = useCallback(() => {
    const s = sim.current;
    const b = s.ball;
    if (s.phase !== 'ready' || s.score.server !== 'player') return;
    s.phase = 'serving';
    s.call = 'SERVE';
    s.hint = '';

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
    sim.current.score = { player: 0, ai: 0, server: 'player', pointsPlayed: 0 };
    sim.current.phase = 'ready';
    sim.current.call = '';
    sim.current.hint = 'Tap to serve';
    placeForServe('player');
  }, [placeForServe]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const safeFail = (msg: string, err?: unknown) => {
      const extra = err ? `\n${String((err as any)?.stack ?? (err as any)?.message ?? err)}` : '';
      setFatal(msg + extra);
    };

    try {
      setBoot('Checking WebGL…');
      if (!hasWebGL()) return safeFail('WebGL is not available. Enable hardware acceleration or try another browser.');

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.inset = '0';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#070b1a');
      const camera = new THREE.PerspectiveCamera(55, 1, 0.01, U(300));
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 1.0);
      key.position.set(U(2.2), U(4.2), U(2.2));
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      scene.add(key);

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(U(30), U(30)), new THREE.MeshStandardMaterial({ color: 0x0f1222, roughness: 0.95, metalness: 0.05 }));
      floor.rotation.x = -Math.PI / 2;
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
      mount.style.position = 'absolute';
      mount.style.inset = '0';
      mount.appendChild(renderer.domElement);

      const resize = () => {
        const w = mount.clientWidth || 1;
        const h = mount.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const unobs = observeResize(mount, resize);
      resize();

      three.current = { renderer, scene, camera, clock, raf: 0, table, paddleP: playerPaddle, paddleA: aiPaddle, ballM };
      placeForServe(sim.current.score.server);
      setBoot('');

      const tmpTarget = new THREE.Vector3();
      const tmpDir = new THREE.Vector3();
      const tmpCross = new THREE.Vector3();

      const tick = () => {
        try {
          const t = three.current;
          if (!t) return;
          const dt = Math.min(t.clock.getDelta(), PHYS.dtClamp) * TIME_SCALE;
          const s = sim.current;
          const b = s.ball;
          const diff = difficultyRef.current;

          const px = lerp(-TABLE.W / 2 + U(0.18), TABLE.W / 2 - U(0.18), g.current.x);
          const pz = lerp(U(0.12), TABLE.L / 2 - U(0.22), g.current.y);
          t.paddleP.position.x = lerp(t.paddleP.position.x, px, 0.30);
          t.paddleP.position.z = lerp(t.paddleP.position.z, pz, 0.30);
          t.paddleP.position.y = PADDLE.y;

          const predX = b.p.x + b.v.x * AI.react[diff];
          const wantX = b.p.z < 0 ? predX : 0;
          const jitter = (Math.random() * 2 - 1) * AI.jitter[diff];
          t.paddleA.position.x = lerp(t.paddleA.position.x, clamp(wantX + jitter, -TABLE.W / 2 + U(0.18), TABLE.W / 2 - U(0.18)), AI.lerp[diff]);
          t.paddleA.position.z = lerp(t.paddleA.position.z, -TABLE.L / 2 + U(0.22), AI.lerp[diff] * 0.92);
          t.paddleA.position.y = PADDLE.y;

          const targetX = t.paddleP.position.x * 0.20 + b.p.x * 0.06;
          const targetY = CAM.yBase + b.p.y * 0.08;
          const targetZ = CAM.zBase + b.p.z * 0.06;
          t.camera.position.x = lerp(t.camera.position.x, targetX, CAM.follow);
          t.camera.position.y = lerp(t.camera.position.y, targetY, CAM.follow);
          t.camera.position.z = lerp(t.camera.position.z, targetZ, CAM.follow);
          t.camera.lookAt(b.p.x * 0.10, TABLE.H + U(0.22) + b.p.y * 0.03, -TABLE.L * 0.06);

          if (s.phase === 'ready' && s.score.server === 'ai' && !b.served && performance.now() >= aiServeAt.current) {
            s.phase = 'serving';
            s.call = 'SERVE';
            s.hint = '';
            const wide = Math.random() < AI.sideBias[diff];
            const mag = wide ? 0.75 : 0.45;
            const targetXAi = clamp((Math.random() * 2 - 1) * (TABLE.W * mag), -TABLE.W / 2 + U(0.18), TABLE.W / 2 - U(0.18));
            tmpTarget.set(targetXAi, TABLE.H + U(0.14), TABLE.L / 2 - POWER.targetZPad);
            const speed = POWER.serveSpeedBase * AI.hitPowerScale[diff];
            tmpDir.subVectors(tmpTarget, b.p);
            if (tmpDir.lengthSq() > 1e-9) {
              tmpDir.normalize();
              b.v.copy(tmpDir.multiplyScalar(speed));
              b.v.y = Math.max(b.v.y, POWER.serveUpMin);
            }
            b.spin.set(0, -targetXAi * 0.0010 * AI.spinStrength[diff], 0);
            b.served = true;
          }

          if (s.phase === 'gameOver') {
            t.renderer.render(t.scene, t.camera);
            t.raf = requestAnimationFrame(tick);
            return;
          }

          if (s.phase === 'ready' && !b.served) {
            const refP = s.score.server === 'player' ? t.paddleP : t.paddleA;
            b.p.set(refP.position.x, TABLE.H + U(0.23), refP.position.z + (s.score.server === 'player' ? -U(0.10) : U(0.10)));
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

          const inZ = Math.abs(b.p.z) <= NET.T / 2 + BALL.R;
          const inX = Math.abs(b.p.x) <= TABLE.W / 2 + BALL.R;
          const inY = b.p.y <= TABLE.H + NET.H + BALL.R;
          if (inZ && inX && inY) {
            b.netTouchedThisRally = true;
            setCallRef('NET');
            b.v.z = -b.v.z * PHYS.netRest;
            b.p.z = sgn(b.p.z) * (NET.T / 2 + BALL.R + U(0.001));
          }

          const topY = TABLE.H + TABLE.THICK / 2;
          if (b.p.y - BALL.R <= topY && Math.abs(b.p.x) <= TABLE.W / 2 && Math.abs(b.p.z) <= TABLE.L / 2 && b.v.y < 0) {
            b.p.y = topY + BALL.R;
            b.v.y = -b.v.y * PHYS.tableRest;
            const side = sideOfZ(b.p.z);
            if (b.lastBounceSide === side) b.bouncesOnSide += 1;
            else { b.lastBounceSide = side; b.bouncesOnSide = 1; }

            if (s.phase === 'serving') {
              if (b.serveBounce1 == null) b.serveBounce1 = side;
              else if (b.serveBounce2 == null && side !== b.serveBounce1) b.serveBounce2 = side;
              const serverSide: Side = s.score.server;
              const receiverSide: Side = s.score.server === 'player' ? 'ai' : 'player';
              if (b.serveBounce1 !== serverSide) return void awardPoint(receiverSide, 'FAULT');
              if (b.serveBounce2 === receiverSide) {
                s.phase = 'rally';
                if (!b.netTouchedThisRally) s.call = '';
              }
            }
            if (s.phase === 'rally' && b.bouncesOnSide >= 2) return void awardPoint(side === 'player' ? 'ai' : 'player', 'DOUBLE');
          }

          const outXZ = Math.abs(b.p.x) > TABLE.W / 2 + U(0.30) || Math.abs(b.p.z) > TABLE.L / 2 + U(0.55);
          const floorHit = b.p.y - BALL.R <= 0;
          if (floorHit || outXZ) return void awardPoint(sideOfZ(b.p.z) === 'player' ? 'ai' : 'player', outXZ ? 'OUT' : 'MISS');

          const tryHit = (pad: THREE.Object3D, who: Side) => {
            const dx = b.p.x - pad.position.x;
            const dz = b.p.z - pad.position.z;
            if (Math.hypot(dx, dz) > PADDLE.reach + BALL.R || Math.abs(b.p.y - pad.position.y) > U(0.28)) return false;
            if (who === 'ai' && Math.random() > AI.hitChance[diff]) return false;

            if (who === 'player') {
              tmpTarget.set(lerp(-TABLE.W / 2 + U(0.18), TABLE.W / 2 - U(0.18), g.current.x), TABLE.H + U(0.14), -TABLE.L / 2 + POWER.targetZPad);
              const speed = hitSpeedFromSwipe(g.current);
              tmpDir.subVectors(tmpTarget, b.p);
              if (tmpDir.lengthSq() > 1e-9) {
                tmpDir.normalize();
                b.v.copy(tmpDir.multiplyScalar(speed));
                b.v.z = -Math.abs(b.v.z);
                b.v.y = Math.max(b.v.y, U(1.05));
              }
              const edge = clamp(dx / (PADDLE.bladeW * 0.5), -1, 1);
              b.spin.x += (-g.current.vy * 1000) * POWER.swipeYToSpin;
              b.spin.y += (g.current.vx * 1000) * POWER.swipeXToSpin + edge * POWER.edgeSpinK;
            } else {
              const wide = Math.random() < AI.sideBias[diff];
              const mag = wide ? 0.75 : 0.40;
              tmpTarget.set(clamp((Math.random() * 2 - 1) * (TABLE.W * mag), -TABLE.W / 2 + U(0.18), TABLE.W / 2 - U(0.18)), TABLE.H + U(0.14), TABLE.L / 2 - POWER.targetZPad);
              const base = lerp(POWER.hitSpeedBase, POWER.hitSpeedMax * 0.70, AI.aimStrength[diff]) * AI.hitPowerScale[diff];
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
            s.phase = 'rally';
            s.call = '';
            return true;
          };

          tryHit(t.paddleP, 'player');
          tryHit(t.paddleA, 'ai');
          t.ballM.position.copy(b.p);
          t.renderer.render(t.scene, t.camera);
          t.raf = requestAnimationFrame(tick);
        } catch (e) {
          setFatal('Runtime error:\n' + String((e as any)?.stack ?? e));
        }
      };

      three.current.raf = requestAnimationFrame(tick);
      return () => {
        unobs();
        const t = three.current;
        if (t) {
          cancelAnimationFrame(t.raf);
          try { mount.removeChild(t.renderer.domElement); } catch {}
          t.renderer.dispose();
          t.scene.traverse((o: any) => {
            o.geometry?.dispose?.();
            if (Array.isArray(o.material)) o.material.forEach((m: any) => m?.dispose?.());
            else o.material?.dispose?.();
          });
        }
        three.current = null;
      };
    } catch (e) {
      safeFail('Init error:', e);
    }
  }, [awardPoint, difficultyRef, g, placeForServe, serve, setCallRef]);

  const phaseLabel = ui.phase === 'ready' ? 'READY' : ui.phase === 'serving' ? 'SERVE' : ui.phase === 'rally' ? 'RALLY' : 'GAME';
  const serverLabel = ui.score.server === 'player' ? 'YOU' : 'AI';

  return (
    <ErrorBoundary>
      <div
        ref={rootRef}
        className="w-full h-[92vh] relative select-none"
        style={{ background: '#070b1a', touchAction: 'none' }}
        onPointerDown={(e) => {
          onDown(e);
          if (sim.current.phase === 'ready' && sim.current.score.server === 'player') serve();
        }}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
        {(boot || fatal) && (
          <div style={{ position: 'absolute', left: 8, top: 56, right: 8, background: fatal ? 'rgba(180,0,0,0.55)' : 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 12, padding: '8px 10px', borderRadius: 14, pointerEvents: 'none' }}>
            {fatal || boot}
          </div>
        )}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 8, display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 12, padding: '8px 12px', borderRadius: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontWeight: 800 }}>YOU {ui.score.player}</span>
            <span>•</span>
            <span style={{ fontWeight: 800 }}>AI {ui.score.ai}</span>
            <span style={{ opacity: 0.85 }}>SERVER {serverLabel}</span>
            <span style={{ opacity: 0.85 }}>{phaseLabel}</span>
            {ui.call && <span style={{ fontWeight: 800 }}>• {ui.call}</span>}
          </div>
        </div>

        {ui.hint && <div style={{ position: 'absolute', left: 8, top: 92, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 12, padding: '8px 10px', borderRadius: 14 }}>{ui.hint}</div>}

        <div style={{ position: 'absolute', left: 8, bottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} style={{ padding: '6px 8px', borderRadius: 10, fontSize: 12 }}>
            <option value="easy">AI easy</option>
            <option value="medium">AI medium</option>
            <option value="hard">AI hard</option>
          </select>
          <button onClick={reset} style={{ padding: '6px 10px', borderRadius: 10, fontSize: 12 }}>Reset</button>
        </div>

        <div style={{ position: 'absolute', right: 8, bottom: 8, maxWidth: 560, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 12, padding: '8px 10px', borderRadius: 14 }}>
          Drag to move paddle • Tap to serve • Aim with finger X • Swipe faster = more speed
        </div>
      </div>
    </ErrorBoundary>
  );
}
