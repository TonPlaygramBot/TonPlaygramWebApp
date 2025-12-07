import React, { useEffect, useRef, useState } from "react";

class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  clone() {
    return new Vec3(this.x, this.y, this.z);
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  addScaled(v, s) {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }
  scale(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  cross(v) {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }
  len() {
    return Math.hypot(this.x, this.y, this.z);
  }
  norm() {
    const l = this.len() || 1;
    this.x /= l;
    this.y /= l;
    this.z /= l;
    return this;
  }
}

class Mat4 {
  constructor() {
    this.m = new Float32Array(16);
    this.identity();
  }
  identity() {
    const m = this.m;
    m[0] = 1;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;
    m[4] = 0;
    m[5] = 1;
    m[6] = 0;
    m[7] = 0;
    m[8] = 0;
    m[9] = 0;
    m[10] = 1;
    m[11] = 0;
    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;
    return this;
  }
  copy(a) {
    this.m.set(a.m);
    return this;
  }
  multiply(a, b) {
    const A = a.m;
    const B = b.m;
    const M = this.m; // M=A*B
    const a00 = A[0],
      a01 = A[1],
      a02 = A[2],
      a03 = A[3],
      a10 = A[4],
      a11 = A[5],
      a12 = A[6],
      a13 = A[7],
      a20 = A[8],
      a21 = A[9],
      a22 = A[10],
      a23 = A[11],
      a30 = A[12],
      a31 = A[13],
      a32 = A[14],
      a33 = A[15];
    const b00 = B[0],
      b01 = B[1],
      b02 = B[2],
      b03 = B[3],
      b10 = B[4],
      b11 = B[5],
      b12 = B[6],
      b13 = B[7],
      b20 = B[8],
      b21 = B[9],
      b22 = B[10],
      b23 = B[11],
      b30 = B[12],
      b31 = B[13],
      b32 = B[14],
      b33 = B[15];
    M[0] = a00 * b00 + a10 * b01 + a20 * b02 + a30 * b03;
    M[1] = a01 * b00 + a11 * b01 + a21 * b02 + a31 * b03;
    M[2] = a02 * b00 + a12 * b01 + a22 * b02 + a32 * b03;
    M[3] = a03 * b00 + a13 * b01 + a23 * b02 + a33 * b03;
    M[4] = a00 * b10 + a10 * b11 + a20 * b12 + a30 * b13;
    M[5] = a01 * b10 + a11 * b11 + a21 * b12 + a31 * b13;
    M[6] = a02 * b10 + a12 * b11 + a22 * b12 + a32 * b13;
    M[7] = a03 * b10 + a13 * b11 + a23 * b12 + a33 * b13;
    M[8] = a00 * b20 + a10 * b21 + a20 * b22 + a30 * b23;
    M[9] = a01 * b20 + a11 * b21 + a21 * b22 + a31 * b23;
    M[10] = a02 * b20 + a12 * b21 + a22 * b22 + a32 * b23;
    M[11] = a03 * b20 + a13 * b21 + a23 * b22 + a33 * b23;
    M[12] = a00 * b30 + a10 * b31 + a20 * b32 + a30 * b33;
    M[13] = a01 * b30 + a11 * b31 + a21 * b32 + a31 * b33;
    M[14] = a02 * b30 + a12 * b31 + a22 * b32 + a32 * b33;
    M[15] = a03 * b30 + a13 * b31 + a23 * b32 + a33 * b33;
    return this;
  }
  perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan((fov * Math.PI) / 180 / 2);
    const nf = 1 / (near - far);
    const m = this.m;
    m[0] = f / aspect;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;
    m[4] = 0;
    m[5] = f;
    m[6] = 0;
    m[7] = 0;
    m[8] = 0;
    m[9] = 0;
    m[10] = (far + near) * nf;
    m[11] = -1;
    m[12] = 0;
    m[13] = 0;
    m[14] = (2 * far * near) * nf;
    m[15] = 0;
    return this;
  }
  lookAt(eye, target, up) {
    const z = new Vec3(eye.x - target.x, eye.y - target.y, eye.z - target.z);
    z.norm();
    const x = up.clone().cross(z).norm();
    const y = z.clone().cross(x).norm();
    const m = this.m;
    m[0] = x.x;
    m[1] = y.x;
    m[2] = z.x;
    m[3] = 0;
    m[4] = x.y;
    m[5] = y.y;
    m[6] = z.y;
    m[7] = 0;
    m[8] = x.z;
    m[9] = y.z;
    m[10] = z.z;
    m[11] = 0;
    m[12] = -x.dot(eye);
    m[13] = -y.dot(eye);
    m[14] = -z.dot(eye);
    m[15] = 1;
    return this;
  }
  invert() {
    const m = this.m;
    const inv = new Float32Array(16);
    inv[0] =
      m[5] * m[10] * m[15] -
      m[5] * m[11] * m[14] -
      m[9] * m[6] * m[15] +
      m[9] * m[7] * m[14] +
      m[13] * m[6] * m[11] -
      m[13] * m[7] * m[10];
    inv[4] =
      -m[4] * m[10] * m[15] +
      m[4] * m[11] * m[14] +
      m[8] * m[6] * m[15] -
      m[8] * m[7] * m[14] -
      m[12] * m[6] * m[11] +
      m[12] * m[7] * m[10];
    inv[8] =
      m[4] * m[9] * m[15] -
      m[4] * m[11] * m[13] -
      m[8] * m[5] * m[15] +
      m[8] * m[7] * m[13] +
      m[12] * m[5] * m[11] -
      m[12] * m[7] * m[9];
    inv[12] =
      -m[4] * m[9] * m[14] +
      m[4] * m[10] * m[13] +
      m[8] * m[5] * m[14] -
      m[8] * m[6] * m[13] -
      m[12] * m[5] * m[10] +
      m[12] * m[6] * m[9];
    inv[1] =
      -m[1] * m[10] * m[15] +
      m[1] * m[11] * m[14] +
      m[9] * m[2] * m[15] -
      m[9] * m[3] * m[14] -
      m[13] * m[2] * m[11] +
      m[13] * m[3] * m[10];
    inv[5] =
      m[0] * m[10] * m[15] -
      m[0] * m[11] * m[14] -
      m[8] * m[2] * m[15] +
      m[8] * m[3] * m[14] +
      m[12] * m[2] * m[11] -
      m[12] * m[3] * m[10];
    inv[9] =
      -m[0] * m[9] * m[15] +
      m[0] * m[11] * m[13] +
      m[8] * m[1] * m[15] -
      m[8] * m[3] * m[13] -
      m[12] * m[1] * m[11] +
      m[12] * m[3] * m[9];
    inv[13] =
      m[0] * m[9] * m[14] -
      m[0] * m[10] * m[13] -
      m[8] * m[1] * m[14] +
      m[8] * m[2] * m[13] +
      m[12] * m[1] * m[10] -
      m[12] * m[2] * m[9];
    inv[2] =
      m[1] * m[6] * m[15] -
      m[1] * m[7] * m[14] -
      m[5] * m[2] * m[15] +
      m[5] * m[3] * m[14] +
      m[13] * m[2] * m[7] -
      m[13] * m[3] * m[6];
    inv[6] =
      -m[0] * m[6] * m[15] +
      m[0] * m[7] * m[14] +
      m[4] * m[2] * m[15] -
      m[4] * m[3] * m[14] -
      m[12] * m[2] * m[7] +
      m[12] * m[3] * m[6];
    inv[10] =
      m[0] * m[5] * m[15] -
      m[0] * m[7] * m[13] -
      m[4] * m[1] * m[15] +
      m[4] * m[3] * m[13] +
      m[12] * m[1] * m[7] -
      m[12] * m[3] * m[5];
    inv[14] =
      -m[0] * m[5] * m[14] +
      m[0] * m[6] * m[13] +
      m[4] * m[1] * m[14] -
      m[4] * m[2] * m[13] -
      m[12] * m[1] * m[6] +
      m[12] * m[2] * m[5];
    inv[3] =
      -m[1] * m[6] * m[11] +
      m[1] * m[7] * m[10] +
      m[5] * m[2] * m[11] -
      m[5] * m[3] * m[10] -
      m[9] * m[2] * m[7] +
      m[9] * m[3] * m[6];
    inv[7] =
      m[0] * m[6] * m[11] -
      m[0] * m[7] * m[10] -
      m[4] * m[2] * m[11] +
      m[4] * m[3] * m[10] +
      m[8] * m[2] * m[7] -
      m[8] * m[3] * m[6];
    inv[11] =
      -m[0] * m[5] * m[11] +
      m[0] * m[7] * m[9] +
      m[4] * m[1] * m[11] -
      m[4] * m[3] * m[9] -
      m[8] * m[1] * m[7] +
      m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    det = det || 1;
    for (let i = 0; i < 16; i++) inv[i] /= det;
    this.m = inv;
    return this;
  }
  transformPoint(v) {
    const m = this.m;
    const x = v.x,
      y = v.y,
      z = v.z;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    const iw = w ? 1 / w : 1;
    return new Vec3(
      (m[0] * x + m[4] * y + m[8] * z + m[12]) * iw,
      (m[1] * x + m[5] * y + m[9] * z + m[13]) * iw,
      (m[2] * x + m[6] * y + m[10] * z + m[14]) * iw
    );
  }
}

function intersectRayPlane(ro, rd, planePoint, planeNormal) {
  const denom = planeNormal.dot(rd);
  if (Math.abs(denom) < 1e-6) return null;
  const t = planePoint.clone().sub(ro).dot(planeNormal) / denom;
  if (t < 0) return null;
  return ro.clone().addScaled(rd, t);
}

const TABLE_LENGTH = 2.74;
const TABLE_WIDTH = 1.525;
const TABLE_HEIGHT = 0.76;
const NET_HEIGHT = 0.1525;
const LINE_THICKNESS = 0.01;

const BALL_DIAMETER = 0.04;
const BALL_RADIUS = BALL_DIAMETER / 2;
const BALL_MASS = 0.0027;

const PADDLE_RADIUS = 0.085;
const PADDLE_THICK = 0.02;

const GRAVITY = -9.81;
const AIR_DRAG_K = 0.15;
const MAGNUS_K = 0.0007;

const TABLE_RESTITUTION = 0.9;
const TABLE_TANGENTIAL_DAMP = 0.88;
const NET_THICKNESS = 0.012;

const WORLD_Y_FLOOR = -0.1;

const POINTS_TO_WIN = 11;
const SERVE_ALTERNATION = 2;

const halfL = TABLE_LENGTH / 2;
const halfW = TABLE_WIDTH / 2;

const FIXED_DT = 1 / 120;
const MAX_ACCUM_DT = 0.2;

const CAM_DEFAULT = new Vec3(0, 2.2, 3.8);
const CAM_SIDE = new Vec3(3.2, 1.7, 0);
const CAM_TOP = new Vec3(0, 5.2, 0.01);
const CAM_TARGET = new Vec3(0, TABLE_HEIGHT + 0.05, 0);

const DIFFICULTY = {
  Easy: { react: 2.5, aimErr: 0.28, power: 0.8, spin: 0.5 },
  Medium: { react: 4, aimErr: 0.13, power: 1, spin: 0.9 },
  Hard: { react: 6, aimErr: 0.05, power: 1.2, spin: 1.3 },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => Math.random() * (b - a) + a;

function projectToScreen(PV, pt, w, h) {
  const p = PV.transformPoint(pt);
  const x = (p.x * 0.5 + 0.5) * w;
  const y = (-p.y * 0.5 + 0.5) * h;
  return { x, y, w: p.z };
}

function ndcToRay(invPV, nx, ny) {
  const pNear = invPV.transformPoint(new Vec3(nx, ny, -1));
  const pFar = invPV.transformPoint(new Vec3(nx, ny, 1));
  const dir = pFar.clone().sub(pNear).norm();
  return { ro: pNear, rd: dir };
}

class Rules {
  constructor() {
    this.score = { player: 0, ai: 0 };
    this.service = { server: "Player", servesSinceSwap: 0 };
    this.stage = "Warmup";
    this.rally = { lastHitter: null, lastSideBounce: null, consecutiveBouncesOnSameSide: 0 };
    this.contact = { touchedNetThisFlight: false };
    this.letServe = false;
  }
  resetRally() {
    this.rally = { lastHitter: null, lastSideBounce: null, consecutiveBouncesOnSameSide: 0 };
    this.contact.touchedNetThisFlight = false;
    this.letServe = false;
  }
  isDeuce() {
    return this.score.player >= 10 && this.score.ai >= 10 && Math.abs(this.score.player - this.score.ai) < 2;
  }
  currentServeSpan() {
    return this.isDeuce() ? 1 : SERVE_ALTERNATION;
  }
  awardPoint(side) {
    if (this.stage === "GameOver") return;
    if (this.letServe) {
      this.letServe = false;
      this.stage = "ServeFlying";
      this.resetRally();
      return;
    }
    if (side === "Player") this.score.player++;
    else this.score.ai++;
    const lead = Math.abs(this.score.player - this.score.ai);
    const maxp = Math.max(this.score.player, this.score.ai);
    if (maxp >= POINTS_TO_WIN && lead >= 2) {
      this.stage = "GameOver";
      return;
    }
    this.service.servesSinceSwap++;
    if (this.service.servesSinceSwap >= this.currentServeSpan()) {
      this.service.server = this.service.server === "Player" ? "AI" : "Player";
      this.service.servesSinceSwap = 0;
    }
    this.stage = "PointOver";
  }
}

function planAIReturn(ballState, difficulty) {
  const preset = DIFFICULTY[difficulty];
  const aimX = clamp(ballState.pos.x + rand(-0.3, 0.3), -halfW * 0.75, halfW * 0.75);
  const aimZ = halfL * lerp(0.18, 0.35, Math.random());
  const target = new Vec3(aimX, TABLE_HEIGHT + 0.02, aimZ);
  const dir = target.clone().sub(ballState.pos).norm();
  const impulse = dir.scale(3.2 * preset.power);
  impulse.y = 2.4 * preset.power;
  const sideSpin = rand(-1, 1) * 40 * preset.spin;
  const topSpin = 50 * preset.spin;
  ballState.omega.set(0, sideSpin, topSpin);
  return { impulse, target };
}

export default function TableTennisClassic() {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);

  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [server, setServer] = useState("Player");
  const [stage, setStage] = useState("Warmup");
  const [difficulty, setDifficulty] = useState("Medium");
  const [cameraMode, setCameraMode] = useState("Default");
  const [trail, setTrail] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fps, setFps] = useState(0);

  const rulesRef = useRef(new Rules());
  const ball = useRef({ pos: new Vec3(0, TABLE_HEIGHT + 0.3, halfL * 0.35), vel: new Vec3(), omega: new Vec3() });
  const player = useRef({ pos: new Vec3(0, TABLE_HEIGHT + 0.13, halfL * 0.3) });
  const ai = useRef({ pos: new Vec3(0, TABLE_HEIGHT + 0.13, -halfL * 0.4) });

  const camPos = useRef(CAM_DEFAULT.clone());
  const PV = useRef(new Mat4());
  const invPV = useRef(new Mat4());

  const pointer = useRef({ active: false, x: 0, y: 0 });
  const swipe = useRef({ pos: player.current.pos.clone(), t: 0 });
  const trailBuf = useRef([]);
  const rafRef = useRef(0);
  const accRef = useRef(0);
  const lastTime = useRef(typeof performance !== "undefined" ? performance.now() : 0);

  function updateProjection() {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
    const w = cvs.clientWidth * dpr;
    const h = cvs.clientHeight * dpr;
    if (cvs.width !== w || cvs.height !== h) {
      cvs.width = w;
      cvs.height = h;
    }
    const aspect = w / h;
    const P = new Mat4().perspective(55, aspect, 0.01, 100);
    const mode = cameraMode;
    const target = CAM_TARGET;
    const desired = mode === "Default" ? CAM_DEFAULT : mode === "Side" ? CAM_SIDE : CAM_TOP;
    camPos.current.x = lerp(camPos.current.x, desired.x, 0.1);
    camPos.current.y = lerp(camPos.current.y, desired.y, 0.1);
    camPos.current.z = lerp(camPos.current.z, desired.z, 0.1);
    const V = new Mat4().lookAt(camPos.current, target, new Vec3(0, 1, 0));
    PV.current.multiply(P, V);
    invPV.current.copy(PV.current).invert();
  }

  function pointerToPlane(px, py) {
    const cvs = canvasRef.current;
    const rect = cvs.getBoundingClientRect();
    const nx = ((px - rect.left) / rect.width) * 2 - 1;
    const ny = -(((py - rect.top) / rect.height) * 2 - 1);
    const { ro, rd } = ndcToRay(invPV.current, nx, ny);
    const hit = intersectRayPlane(ro, rd, new Vec3(0, TABLE_HEIGHT + 0.12, 0), new Vec3(0, 1, 0));
    return hit || new Vec3(0, TABLE_HEIGHT + 0.12, halfL * 0.3);
  }

  function applyAirDrag(v, dt) {
    const k = AIR_DRAG_K;
    v.scale(1 / (1 + k * dt));
  }
  function applyMagnus(v, omega, dt) {
    const c = omega.clone().cross(v);
    v.addScaled(c, MAGNUS_K * dt);
  }
  function reflectTable(state) {
    state.vel.y *= -TABLE_RESTITUTION;
    state.vel.x *= TABLE_TANGENTIAL_DAMP;
    state.vel.z *= TABLE_TANGENTIAL_DAMP;
    state.omega.scale(0.85);
  }
  function collideWithNet(state) {
    state.vel.z *= -0.35;
    state.vel.scale(0.94);
    state.omega.scale(0.9);
  }
  function boundsOut(p) {
    const outX = Math.abs(p.x) > halfW + 0.06;
    const outZ = Math.abs(p.z) > halfL + 0.06;
    const floor = p.y < WORLD_Y_FLOOR;
    return outX || outZ || floor;
  }

  const lastSideZ = (z) => (z > 0 ? "Player" : "AI");

  function onBounceAt(pos) {
    const rules = rulesRef.current;
    const side = lastSideZ(pos.z);
    if (rules.stage === "ServeFlying") {
      if (rules.rally.lastSideBounce === null) {
        const must = rules.service.server;
        if (side !== must) {
          rules.awardPoint(must === "Player" ? "AI" : "Player");
          syncHUD();
          return;
        }
      } else {
        const mustOpp = rules.service.server === "Player" ? "AI" : "Player";
        if (side !== mustOpp) {
          rules.awardPoint(rules.service.server === "Player" ? "AI" : "Player");
          syncHUD();
          return;
        }
        if (rules.contact.touchedNetThisFlight) rules.letServe = true;
      }
    }
    if (rules.rally.lastSideBounce === side) rules.rally.consecutiveBouncesOnSameSide += 1;
    else rules.rally.consecutiveBouncesOnSameSide = 1;
    rules.rally.lastSideBounce = side;
    if (rules.stage === "Rally" && rules.rally.consecutiveBouncesOnSameSide >= 2) {
      rules.awardPoint(side === "Player" ? "AI" : "Player");
      syncHUD();
    }
  }

  function resetForServe(serverSide) {
    const rules = rulesRef.current;
    rules.stage = "ServeFlying";
    rules.resetRally();
    const z = serverSide === "Player" ? halfL * 0.35 : -halfL * 0.35;
    ball.current.pos.set(0, TABLE_HEIGHT + 0.32, z);
    ball.current.vel.set(rand(-0.4, 0.4), 2.2, serverSide === "Player" ? -2.9 : 2.9);
    ball.current.omega.set(0, 0, 0);
    setServer(serverSide);
    setStage(rules.stage);
  }

  function hardReset() {
    const rules = rulesRef.current;
    rules.score = { player: 0, ai: 0 };
    rules.service = { server: "Player", servesSinceSwap: 0 };
    resetForServe("Player");
    syncHUD();
  }

  function syncHUD() {
    const rules = rulesRef.current;
    setScore({ ...rules.score });
    setServer(rules.service.server);
    setStage(rules.stage);
  }

  function performPaddleHits() {
    const rules = rulesRef.current;
    const entries = [
      { grp: player.current, side: "Player" },
      { grp: ai.current, side: "AI" },
    ];
    for (const { grp, side } of entries) {
      const d = ball.current.pos.clone().sub(grp.pos);
      if (d.len() >= PADDLE_RADIUS + BALL_RADIUS) continue;
      let swipeV = new Vec3();
      if (side === "Player") {
        const now = typeof performance !== "undefined" ? performance.now() : 0;
        const dtMs = Math.max(1, now - (swipe.current.t || now));
        swipeV = grp.pos.clone().sub(swipe.current.pos).scale(1000 / dtMs);
        swipe.current.pos.copy(grp.pos);
        swipe.current.t = now;
      } else {
        const deltaX = clamp(ball.current.pos.x - grp.pos.x, -1, 1);
        swipeV.set(deltaX, 0, 0);
      }
      const dir = d.norm();
      const basePower = side === "Player" ? 1.8 : 2.2 * DIFFICULTY[difficulty].power;
      const impulse = dir.scale(basePower).addScaled(swipeV, side === "Player" ? 0.02 : 0.01);
      ball.current.vel.add(impulse);
      const top =
        clamp(swipeV.z, -6, 6) * (side === "Player" ? 8 : 10) * (side === "AI" ? DIFFICULTY[difficulty].spin : 1);
      const sideSpin = clamp(-swipeV.x, -6, 6) * 6 * (side === "AI" ? DIFFICULTY[difficulty].spin : 1);
      ball.current.omega.add(new Vec3(0, sideSpin, top));
      rules.rally.lastHitter = side;
    }
  }

  function physicsStep(dt) {
    const rules = rulesRef.current;
    if (rules.stage === "Warmup") {
      resetForServe(rules.service.server);
      return;
    }
    ball.current.vel.y += GRAVITY * dt;
    applyAirDrag(ball.current.vel, dt);
    applyMagnus(ball.current.vel, ball.current.omega, dt);
    const nextPos = ball.current.pos.clone().addScaled(ball.current.vel, dt);
    const onTop =
      nextPos.y - BALL_RADIUS <= TABLE_HEIGHT &&
      Math.abs(nextPos.x) <= halfW &&
      Math.abs(nextPos.z) <= halfL &&
      ball.current.vel.y < 0;
    if (onTop) {
      nextPos.y = TABLE_HEIGHT + BALL_RADIUS;
      reflectTable(ball.current);
      onBounceAt(nextPos);
      if (rules.stage === "ServeFlying" && rules.rally.lastSideBounce !== null) {
        if (!rules.letServe) rules.stage = "Rally";
        setStage(rules.stage);
      }
    }
    const nearZ = Math.abs(nextPos.z) <= NET_THICKNESS * 0.5 + BALL_RADIUS * 0.6;
    const low = nextPos.y <= TABLE_HEIGHT + NET_HEIGHT + BALL_RADIUS * 0.3;
    if (nearZ && low) {
      collideWithNet(ball.current);
      rules.contact.touchedNetThisFlight = true;
    }
    performPaddleHits();
    if (boundsOut(nextPos)) {
      const winner = ball.current.pos.z > 0 ? "AI" : "Player";
      rules.awardPoint(winner);
      syncHUD();
      if (rules.stage !== "GameOver") resetForServe(rules.service.server);
      return;
    }
    ball.current.pos.copy(nextPos);
    if (trail) {
      trailBuf.current.push(ball.current.pos.clone());
      if (trailBuf.current.length > 40) trailBuf.current.shift();
    }
  }

  function aiStep(dt) {
    const preset = DIFFICULTY[difficulty];
    const s = Math.min(1, dt * preset.react);
    const targetX = clamp(ball.current.pos.x, -halfW + PADDLE_RADIUS, halfW - PADDLE_RADIUS);
    const targetZ = -halfL * 0.4;
    ai.current.pos.x += (targetX - ai.current.pos.x) * s;
    ai.current.pos.z += (targetZ - ai.current.pos.z) * s;
    const d = ball.current.pos.clone().sub(ai.current.pos).len();
    if (d < PADDLE_RADIUS + BALL_RADIUS + 0.02) {
      const plan = planAIReturn(ball.current, difficulty);
      ball.current.vel.add(plan.impulse);
      rulesRef.current.rally.lastHitter = "AI";
    }
  }

  function draw() {
    const cvs = canvasRef.current;
    const ctx = cvs.getContext("2d");
    const W = cvs.width;
    const H = cvs.height;
    ctx.clearRect(0, 0, W, H);
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "#08101a");
    grd.addColorStop(1, "#0d1e31");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    updateProjection();
    const c1 = new Vec3(-halfW, TABLE_HEIGHT, -halfL);
    const c2 = new Vec3(halfW, TABLE_HEIGHT, -halfL);
    const c3 = new Vec3(halfW, TABLE_HEIGHT, halfL);
    const c4 = new Vec3(-halfW, TABLE_HEIGHT, halfL);
    const p1 = projectToScreen(PV.current, c1, W, H);
    const p2 = projectToScreen(PV.current, c2, W, H);
    const p3 = projectToScreen(PV.current, c3, W, H);
    const p4 = projectToScreen(PV.current, c4, W, H);
    ctx.fillStyle = "#0a2d57";
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();

    function drawStrip(a, b, th) {
      const dir = new Vec3(b.x - a.x, b.y - a.y, 0);
      const len = Math.hypot(dir.x, dir.y) || 1;
      const nx = -(dir.y / len) * th,
        ny = (dir.x / len) * th;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(a.x - nx, a.y - ny);
      ctx.lineTo(b.x - nx, b.y - ny);
      ctx.lineTo(b.x + nx, b.y + ny);
      ctx.lineTo(a.x + nx, a.y + ny);
      ctx.closePath();
      ctx.fill();
    }
    drawStrip(p1, p2, 2);
    drawStrip(p2, p3, 2);
    drawStrip(p3, p4, 2);
    drawStrip(p4, p1, 2);
    const mid1 = projectToScreen(PV.current, new Vec3(0, TABLE_HEIGHT, -halfL), W, H);
    const mid2 = projectToScreen(PV.current, new Vec3(0, TABLE_HEIGHT, halfL), W, H);
    drawStrip(mid1, mid2, 1.5);
    const n1 = projectToScreen(PV.current, new Vec3(-halfW, TABLE_HEIGHT, 0), W, H);
    const n2 = projectToScreen(PV.current, new Vec3(halfW, TABLE_HEIGHT, 0), W, H);
    const n3 = projectToScreen(PV.current, new Vec3(halfW, TABLE_HEIGHT + NET_HEIGHT, 0), W, H);
    const n4 = projectToScreen(PV.current, new Vec3(-halfW, TABLE_HEIGHT + NET_HEIGHT, 0), W, H);
    ctx.fillStyle = "rgba(20,20,20,0.85)";
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(n2.x, n2.y);
    ctx.lineTo(n3.x, n3.y);
    ctx.lineTo(n4.x, n4.y);
    ctx.closePath();
    ctx.fill();

    function drawDisc(center, radius, color) {
      const c = projectToScreen(PV.current, center, W, H);
      const right = projectToScreen(PV.current, center.clone().add(new Vec3(radius, 0, 0)), W, H);
      const r = Math.hypot(right.x - c.x, right.y - c.y);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(2, r), 0, Math.PI * 2);
      ctx.fill();
    }

    function drawShadow(worldPos, rad) {
      const drop = worldPos.clone();
      drop.y = TABLE_HEIGHT + 0.001;
      const s = projectToScreen(PV.current, drop, W, H);
      const right = projectToScreen(PV.current, drop.clone().add(new Vec3(rad, 0, 0)), W, H);
      const rr = Math.hypot(right.x - s.x, right.y - s.y) * 1.2;
      const alpha = clamp(1 - (worldPos.y - TABLE_HEIGHT) * 2.5, 0, 0.8);
      ctx.fillStyle = `rgba(0,0,0,${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, rr, rr * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    drawShadow(ai.current.pos, PADDLE_RADIUS);
    drawShadow(ball.current.pos, BALL_RADIUS);
    drawShadow(player.current.pos, PADDLE_RADIUS);
    drawDisc(ai.current.pos, PADDLE_RADIUS, "#cfcfcf");
    (function () {
      const c = projectToScreen(PV.current, ball.current.pos, W, H);
      const right = projectToScreen(PV.current, ball.current.pos.clone().add(new Vec3(BALL_RADIUS, 0, 0)), W, H);
      const r = Math.max(2, Math.hypot(right.x - c.x, right.y - c.y));
      const g = ctx.createRadialGradient(c.x - r * 0.4, c.y - r * 0.4, r * 0.2, c.x, c.y, r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, "#dddddd");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (trail) {
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        for (let i = Math.max(0, trailBuf.current.length - 20); i < trailBuf.current.length; i++) {
          const tp = projectToScreen(PV.current, trailBuf.current[i], W, H);
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    })();
    drawDisc(player.current.pos, PADDLE_RADIUS, "#f0b90b");
    drawHUD(ctx, W, H);
  }

  function drawHUD(ctx, W, H) {
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(10, 10, 210, 70);
    ctx.fillStyle = "#fff";
    ctx.fillText(`Server: ${server === "Player" ? "You" : "AI"}`, 18, 30);
    ctx.fillText(`Score: ${score.player} – ${score.ai}`, 18, 50);
    ctx.fillText(`FPS: ${fps.toFixed(0)}`, 18, 70);
    ctx.fillText(`Stage: ${stage}`, 18, 90);
  }

  function frame() {
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    const dt = Math.min((now - lastTime.current) / 1000, MAX_ACCUM_DT);
    lastTime.current = now;
    accRef.current = Math.min(accRef.current + dt, MAX_ACCUM_DT);
    setFps((p) => (p ? p * 0.8 + 1 / dt * 0.2 : 1 / dt));
    if (!paused) {
      while (accRef.current >= FIXED_DT) {
        physicsStep(FIXED_DT);
        aiStep(FIXED_DT);
        accRef.current -= FIXED_DT;
      }
    }
    draw();
    rafRef.current = requestAnimationFrame(frame);
  }

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return undefined;
    const onPointerDown = (e) => {
      pointer.current.active = true;
      pointer.current.x = e.clientX;
      pointer.current.y = e.clientY;
    };
    const onPointerMove = (e) => {
      if (!pointer.current.active && e.type === "mousemove") return;
      pointer.current.x = e.touches ? e.touches[0].clientX : e.clientX;
      pointer.current.y = e.touches ? e.touches[0].clientY : e.clientY;
      const hit = pointerToPlane(pointer.current.x, pointer.current.y);
      const x = clamp(hit.x, -halfW + PADDLE_RADIUS, halfW - PADDLE_RADIUS);
      const z = clamp(hit.z, 0.06, halfL - 0.06);
      player.current.pos.set(x, TABLE_HEIGHT + 0.13, z);
    };
    const onPointerUp = () => {
      pointer.current.active = false;
    };
    const onResize = () => updateProjection();

    cvs.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    cvs.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("touchend", onPointerUp);
    window.addEventListener("resize", onResize);

    updateProjection();
    lastTime.current = typeof performance !== "undefined" ? performance.now() : 0;
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      cvs.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      cvs.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("touchend", onPointerUp);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, cameraMode, difficulty, trail]);

  function serveNow() {
    resetForServe(rulesRef.current.service.server);
  }

  return (
    <div ref={rootRef} style={{ height: "100dvh", width: "100%", position: "relative", background: "#000" }}>
      <canvas ref={canvasRef} style={{ height: "100%", width: "100%", touchAction: "none", display: "block" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", gap: 8, padding: 8, justifyContent: "space-between" }}>
          <div style={{ pointerEvents: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => hardReset()} style={btn()}>
              Reset
            </button>
            <button onClick={() => serveNow()} style={btn()}>
              Serve
            </button>
            <button onClick={() => setPaused((p) => !p)} style={btn()}>
              {paused ? "Resume" : "Pause"}
            </button>
          </div>
          <div style={{ pointerEvents: "auto", display: "flex", gap: 8 }}>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={sel()}>
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
            <select value={cameraMode} onChange={(e) => setCameraMode(e.target.value)} style={sel()}>
              <option>Default</option>
              <option>Side</option>
              <option>Top</option>
            </select>
            <button onClick={() => setTrail((t) => !t)} style={btn()}>
              {trail ? "Hide" : "Show"} trail
            </button>
          </div>
        </div>
        <div style={{ marginTop: "auto", padding: 8, textAlign: "center", color: "#fff", opacity: 0.65, fontSize: 12 }}>
          Drag to move paddle (near half). Swipe to add spin. First to 11, win by 2.
        </div>
      </div>
    </div>
  );

  function btn() {
    return { background: "#fff", color: "#000", border: "0", borderRadius: 12, padding: "8px 12px", fontWeight: 600, cursor: "pointer" };
  }
  function sel() {
    return { background: "rgba(0,0,0,0.6)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 12, padding: "8px 12px" };
  }
}

export { TableTennisClassic };
