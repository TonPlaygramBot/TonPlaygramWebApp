import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_HDRI_VARIANT_MAP,
} from "../../config/poolRoyaleInventoryConfig.js";
import { getSpeechSupport, onSpeechSupportChange, speakCommentaryLines } from '../../utils/textToSpeech.js';
import useOnlineRoomSync from '../../hooks/useOnlineRoomSync.js';

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

type Gesture = { active: boolean; x: number; y: number; lastX: number; lastY: number; vx: number; vy: number; lastT: number; speed: number };

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

const TIME_SCALE = 0.68;

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
  magnus: 0.00104,
  spinDamp: 0.992,
  tableTangentialDamp: 0.9,
  tableSpinTransfer: 0.00082,
  paddleRest: 0.83,
  paddleFriction: 0.18,
  paddleSpinTransfer: 0.0074,
  paddleSwingTransfer: 0.34,
  maxSpeed: U(10.4),
} as const;

const POWER = {
  serveSpeedBase: U(3.15),
  serveSpeedMax: U(4.1),
  serveUpMin: U(1.05),
  hitSpeedBase: U(2.7),
  hitSpeedMax: U(7.8),
  targetZPad: U(0.45),
  swipeXToSpin: 0.00062,
  swipeYToSpin: 0.00046,
  edgeSpinK: 0.010,
} as const;

const AI = {
  lerp: { easy: 0.13, medium: 0.2, hard: 0.28 },
  react: { easy: 0.16, medium: 0.28, hard: 0.44 },
  jitter: { easy: U(0.08), medium: U(0.04), hard: U(0.018) },
  hitChance: { easy: 0.93, medium: 0.985, hard: 1 },
  serveDelayMs: { easy: 900, medium: 750, hard: 620 },
  sideBias: { easy: 0.66, medium: 0.84, hard: 0.96 },
  aimStrength: { easy: 0.66, medium: 0.92, hard: 1.08 },
  spinStrength: { easy: 0.66, medium: 0.92, hard: 1.16 },
  hitPowerScale: { easy: 0.84, medium: 0.96, hard: 1.08 },
  recoveryBias: { easy: 0.2, medium: 0.34, hard: 0.48 },
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
  lookDownOffset: U(0.08),
} as const;

const TOUCH = {
  velocitySmooth: 0.45,
  maxVelocity: 0.0042,
  maxJumpNorm: 0.26,
  driftDamp: 0.84,
};

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

type PaddleOption = {
  id: string;
  label: string;
  source: string;
  thumbnail: string;
  frontHex: number;
  backHex: number;
  edgeHex?: number;
};

type CommentaryPreset = {
  id: string;
  label: string;
  language: string;
  description: string;
  voiceHints: string[];
};

type BallSoundPreset = {
  id: string;
  label: string;
  description: string;
  source: string;
  sourceUrl: string;
  license: string;
  oscType: OscillatorType;
  startFreq: number;
  endFreq: number;
  duration: number;
  toneGain: number;
  noiseGain: number;
};

const TABLE_TENNIS_PADDLE_OPTIONS: PaddleOption[] = Object.freeze([
  {
    id: "stiga-carbon",
    label: "Stiga Carbon",
    source: "Wikimedia Commons",
    thumbnail: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Table_tennis_bat_and_ball.jpg/640px-Table_tennis_bat_and_ball.jpg",
    frontHex: 0xe11d48,
    backHex: 0x111827,
  },
  {
    id: "yinhe-pro",
    label: "Yinhe Pro Grip",
    source: "Pixabay",
    thumbnail: "https://cdn.pixabay.com/photo/2016/11/29/09/16/table-tennis-1867164_1280.jpg",
    frontHex: 0xdc2626,
    backHex: 0x1f2937,
  },
  {
    id: "butterfly-viscaria",
    label: "Butterfly Viscaria",
    source: "Pexels",
    thumbnail: "https://images.pexels.com/photos/6203521/pexels-photo-6203521.jpeg?auto=compress&cs=tinysrgb&w=1200",
    frontHex: 0xb91c1c,
    backHex: 0x0f172a,
  },
  {
    id: "donic-legend",
    label: "Donic Legend",
    source: "Unsplash",
    thumbnail: "https://images.unsplash.com/photo-1626272739289-42444ea0f97d?auto=format&fit=crop&w=1200&q=80",
    frontHex: 0xf43f5e,
    backHex: 0x1e293b,
  },
  {
    id: "joola-rally",
    label: "JOOLA Rally",
    source: "Openverse",
    thumbnail: "https://live.staticflickr.com/65535/51570422543_220f63f0af_k.jpg",
    frontHex: 0xef4444,
    backHex: 0x020617,
  },
  {
    id: "victas-japan",
    label: "Victas Japan",
    source: "Wikimedia Commons",
    thumbnail: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Table_tennis_racket_and_ball.jpg/640px-Table_tennis_racket_and_ball.jpg",
    frontHex: 0xfb7185,
    backHex: 0x111827,
  },
  {
    id: "andro-kinetic",
    label: "Andro Kinetic",
    source: "Pexels",
    thumbnail: "https://images.pexels.com/photos/11175838/pexels-photo-11175838.jpeg?auto=compress&cs=tinysrgb&w=1200",
    frontHex: 0xbe123c,
    backHex: 0x0f172a,
  },
  {
    id: "nittaku-acoustic",
    label: "Nittaku Acoustic",
    source: "Pixabay",
    thumbnail: "https://cdn.pixabay.com/photo/2016/03/27/20/57/sports-1284271_1280.jpg",
    frontHex: 0xb91c1c,
    backHex: 0x030712,
  },
  {
    id: "tibhar-evolution",
    label: "Tibhar Evolution",
    source: "Unsplash",
    thumbnail: "https://images.unsplash.com/photo-1609710228159-0fa9bd7c0827?auto=format&fit=crop&w=1200&q=80",
    frontHex: 0xf87171,
    backHex: 0x111827,
  },
  {
    id: "dhs-hurricane",
    label: "DHS Hurricane",
    source: "Flickr CC",
    thumbnail: "https://live.staticflickr.com/65535/53292882895_8f5c054be8_b.jpg",
    frontHex: 0xdc2626,
    backHex: 0x020617,
  },
]);

const TABLE_TENNIS_COMMENTARY_PRESETS: CommentaryPreset[] = Object.freeze([
  { id: "english", label: "English", language: "en", description: "English commentary with crisp rally calls", voiceHints: ["en-US", "en-GB", "English"] },
  { id: "hindi", label: "हिन्दी", language: "hi", description: "Hindi commentary with lively pacing", voiceHints: ["hi-IN", "Hindi"] },
  { id: "russian", label: "Русский", language: "ru", description: "Russian commentary with steady cadence", voiceHints: ["ru-RU", "Russian"] },
  { id: "spanish", label: "Español", language: "es", description: "Spanish commentary with energetic rhythm", voiceHints: ["es-ES", "es-MX", "Spanish"] },
  { id: "french", label: "Français", language: "fr", description: "French commentary with polished tone", voiceHints: ["fr-FR", "French"] },
  { id: "shqip", label: "Shqip", language: "sq-AL", description: "Shqip commentary with native cadence", voiceHints: ["sq-AL", "Albanian", "Shqip"] },
  { id: "italian", label: "Italiano", language: "it-IT", description: "Italian commentary with tactical phrasing", voiceHints: ["it-IT", "Italian"] },
]);

const TABLE_TENNIS_BALL_SOUND_PRESETS: BallSoundPreset[] = Object.freeze([
  {
    id: "classic-pop",
    label: "Classic Pop",
    description: "Rounded pop with light felt noise",
    source: "Freesound ping-pong CC0 references",
    sourceUrl: "https://freesound.org/search/?q=table+tennis+bounce&f=license:%22Creative+Commons+0%22",
    license: "CC0",
    oscType: "triangle",
    startFreq: 880,
    endFreq: 460,
    duration: 0.045,
    toneGain: 0.05,
    noiseGain: 0.014,
  },
  {
    id: "arena-click",
    label: "Arena Click",
    description: "Sharper click for fast rally feedback",
    source: "Pixabay ping pong free SFX",
    sourceUrl: "https://pixabay.com/sound-effects/search/ping%20pong/",
    license: "Pixabay License",
    oscType: "square",
    startFreq: 1160,
    endFreq: 620,
    duration: 0.038,
    toneGain: 0.036,
    noiseGain: 0.012,
  },
  {
    id: "wood-hall",
    label: "Wood Hall",
    description: "Warm tone tuned for hall ambience",
    source: "Openverse table tennis SFX references",
    sourceUrl: "https://openverse.org/search/audio?q=table%20tennis",
    license: "CC BY / CC0",
    oscType: "sine",
    startFreq: 760,
    endFreq: 310,
    duration: 0.052,
    toneGain: 0.054,
    noiseGain: 0.01,
  },
  {
    id: "carbon-smack",
    label: "Carbon Smack",
    description: "Short carbon-blade style smack",
    source: "ZapSplat free ping-pong SFX",
    sourceUrl: "https://www.zapsplat.com/sound-effect-category/table-tennis/",
    license: "ZapSplat Standard Free",
    oscType: "sawtooth",
    startFreq: 980,
    endFreq: 340,
    duration: 0.042,
    toneGain: 0.04,
    noiseGain: 0.016,
  },
  {
    id: "pro-echo",
    label: "Pro Echo",
    description: "Bright attack with tiny tail",
    source: "Mixkit free sports SFX",
    sourceUrl: "https://mixkit.co/free-sound-effects/sports/",
    license: "Mixkit Free License",
    oscType: "triangle",
    startFreq: 1020,
    endFreq: 390,
    duration: 0.049,
    toneGain: 0.048,
    noiseGain: 0.013,
  },
]);

const DEFAULT_PADDLE_ID = TABLE_TENNIS_PADDLE_OPTIONS[0]?.id || "stiga-carbon";
const DEFAULT_COMMENTARY_PRESET_ID = TABLE_TENNIS_COMMENTARY_PRESETS[0]?.id || "english";
const DEFAULT_BALL_SOUND_PRESET_ID = TABLE_TENNIS_BALL_SOUND_PRESETS[0]?.id || "classic-pop";

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
  return Math.max(Math.hypot(sx, sy), g.speed * 1180);
}

function serveSpeedFromSwipe(g: Gesture) {
  const t = clamp(swipeMag(g) / 2.6, 0, 1);
  return lerp(POWER.serveSpeedBase, POWER.serveSpeedMax, t);
}

function hitSpeedFromSwipe(g: Gesture) {
  const t = clamp(swipeMag(g) / 2.2, 0, 1);
  return lerp(POWER.hitSpeedBase, POWER.hitSpeedMax, t);
}


function commentaryForCall(call: Call, winner: Side | null, locale: string) {
  const lang = String(locale || "en").toLowerCase();
  const isSq = lang.includes("sq");
  const isHi = lang.startsWith("hi");
  const isRu = lang.startsWith("ru");
  const isEs = lang.startsWith("es");
  const isFr = lang.startsWith("fr");
  const isIt = lang.startsWith("it");

  if (call === "SERVE") {
    if (isSq) return "Shërbimi fillon tani";
    if (isHi) return "सर्विस शुरू";
    if (isRu) return "Подача началась";
    if (isEs) return "Servicio en juego";
    if (isFr) return "Service en cours";
    if (isIt) return "Servizio in corso";
    return "Serve is on";
  }

  if (winner) {
    if (isSq) return winner === "player" ? "Pikë për ty" : "Pikë për kundërshtarin";
    if (isHi) return winner === "player" ? "आपके लिए अंक" : "प्रतिद्वंदी के लिए अंक";
    if (isRu) return winner === "player" ? "Очко вам" : "Очко сопернику";
    if (isEs) return winner === "player" ? "Punto para ti" : "Punto para el rival";
    if (isFr) return winner === "player" ? "Point pour vous" : "Point pour l'adversaire";
    if (isIt) return winner === "player" ? "Punto per te" : "Punto per l'avversario";
    return winner === "player" ? "Point for you" : "Point for opponent";
  }

  if (call === "NET") return isFr ? "Filet" : isEs ? "Red" : isRu ? "Сетка" : isHi ? "नेट" : isIt ? "Rete" : isSq ? "Rrjetë" : "Net touch";
  if (call === "OUT") return isFr ? "Dehors" : isEs ? "Fuera" : isRu ? "Аут" : isHi ? "बाहर" : isIt ? "Fuori" : isSq ? "Jashtë" : "Out";
  if (call === "DOUBLE") return isFr ? "Double rebond" : isEs ? "Doble bote" : isRu ? "Двойной отскок" : isHi ? "डबल बाउंस" : isIt ? "Doppio rimbalzo" : isSq ? "Dy kërcime" : "Double bounce";
  if (call === "FAULT" || call === "MISS") return isFr ? "Faute" : isEs ? "Falta" : isRu ? "Ошибка" : isHi ? "फॉल्ट" : isIt ? "Fallo" : isSq ? "Gabim" : "Fault";
  return "";
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

function predictBallAtZ(ball: BallState, targetZ: number, maxSimSeconds = 1.3) {
  const p = ball.p.clone();
  const v = ball.v.clone();
  const dt = 1 / 120;
  const maxSteps = Math.floor(maxSimSeconds / dt);
  let previousZ = p.z;
  for (let i = 0; i < maxSteps; i += 1) {
    v.y += PHYS.g * dt;
    v.multiplyScalar(PHYS.airDrag);
    p.addScaledVector(v, dt);

    const topY = TABLE.H + TABLE.THICK / 2;
    const inX = Math.abs(p.x) <= TABLE.W / 2;
    const inZ = Math.abs(p.z) <= TABLE.L / 2;
    if (p.y - BALL.R <= topY && v.y < 0 && inX && inZ) {
      p.y = topY + BALL.R;
      v.y = -v.y * PHYS.tableRest;
      v.x *= PHYS.tableTangentialDamp;
      v.z *= PHYS.tableTangentialDamp;
    }

    if ((previousZ - targetZ) * (p.z - targetZ) <= 0) {
      return { x: p.x, y: p.y, t: (i + 1) * dt };
    }
    previousZ = p.z;
  }

  return { x: p.x, y: p.y, t: maxSimSeconds };
}

function useTouch(rootRef: React.RefObject<HTMLDivElement>) {
  const g = useRef<Gesture>({ active: false, x: 0.5, y: 0.72, lastX: 0.5, lastY: 0.72, vx: 0, vy: 0, lastT: 0, speed: 0 });

  const update = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const nx = clamp((clientX - r.left) / r.width, 0, 1);
      const ny = clamp((clientY - r.top) / r.height, 0, 1);
      const t = performance.now();
      const dt = Math.max(1, t - g.current.lastT);
      const rawDx = nx - g.current.lastX;
      const rawDy = ny - g.current.lastY;
      const jump = Math.hypot(rawDx, rawDy);
      const jumpBlend = jump > TOUCH.maxJumpNorm ? TOUCH.maxJumpNorm / jump : 1;
      const dx = rawDx * jumpBlend;
      const dy = rawDy * jumpBlend;
      const vx = clamp(dx / dt, -TOUCH.maxVelocity, TOUCH.maxVelocity);
      const vy = clamp(dy / dt, -TOUCH.maxVelocity, TOUCH.maxVelocity);
      g.current.vx = lerp(g.current.vx, vx, TOUCH.velocitySmooth);
      g.current.vy = lerp(g.current.vy, vy, TOUCH.velocitySmooth);
      g.current.speed = lerp(g.current.speed, Math.hypot(g.current.vx, g.current.vy), 0.42);
      g.current.lastX = g.current.lastX + dx;
      g.current.lastY = g.current.lastY + dy;
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
    g.current.vx *= TOUCH.driftDamp;
    g.current.vy *= TOUCH.driftDamp;
    g.current.speed *= TOUCH.driftDamp;
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

function makeRubberTex(baseHex: number, accentHex: number, w = 512, h = 512) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = `#${baseHex.toString(16).padStart(6, "0")}`;
  ctx.fillRect(0, 0, w, h);
  const accent = `#${accentHex.toString(16).padStart(6, "0")}`;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  for (let y = 2; y < h; y += 8) {
    for (let x = (y / 8) % 2 ? 2 : 6; x < w; x += 8) {
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.4, 2.6);
  return tex;
}

function buildCurvedPaddle(frontHex: number, backHex: number, woodMat: THREE.Material, edgeHex = 0x222222) {
  const group = new THREE.Group();

  const headRadius = BASE_HEAD_RADIUS;
  const sh = new THREE.Shape();
  sh.absellipse(0, 0, headRadius, headRadius * 0.92, 0, Math.PI * 2, false, 0);

  const frontTex = makeRubberTex(frontHex, 0x111111);
  const backTex = makeRubberTex(backHex, 0x3a3a3a);
  const headFrontMat = new THREE.MeshStandardMaterial({ color: frontHex, roughness: 0.88, metalness: 0.03, map: frontTex || undefined, normalScale: new THREE.Vector2(0.4, 0.4) });
  const headBackMat = new THREE.MeshStandardMaterial({ color: backHex, roughness: 0.9, metalness: 0.02, map: backTex || undefined, normalScale: new THREE.Vector2(0.35, 0.35) });
  const edgeMat = new THREE.MeshStandardMaterial({ color: edgeHex, roughness: 0.75, metalness: 0.25 });

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
  const hw = 0.095;
  const hh = 0.27;
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
  const onlineSearch = typeof window !== 'undefined' ? window.location.search : '';
  useOnlineRoomSync(onlineSearch, 'Table Tennis Player');

  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>("high");
  const [frameRateId, setFrameRateId] = useState<FrameRateId>("fhd90");
  const [environmentHdriId, setEnvironmentHdriId] = useState<string>(POOL_ROYALE_DEFAULT_HDRI_ID);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [selectedPaddleId, setSelectedPaddleId] = useState<string>(DEFAULT_PADDLE_ID);
  const [commentaryPresetId, setCommentaryPresetId] = useState<string>(DEFAULT_COMMENTARY_PRESET_ID);
  const [ballSoundPresetId, setBallSoundPresetId] = useState<string>(DEFAULT_BALL_SOUND_PRESET_ID);
  const [commentaryMuted, setCommentaryMuted] = useState(false);
  const [commentarySupported, setCommentarySupported] = useState<boolean>(() => getSpeechSupport());
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
  const selectedPaddleOption = useMemo(
    () => TABLE_TENNIS_PADDLE_OPTIONS.find((option) => option.id === selectedPaddleId) || TABLE_TENNIS_PADDLE_OPTIONS[0],
    [selectedPaddleId]
  );
  const activeCommentaryPreset = useMemo(
    () => TABLE_TENNIS_COMMENTARY_PRESETS.find((preset) => preset.id === commentaryPresetId) || TABLE_TENNIS_COMMENTARY_PRESETS[0],
    [commentaryPresetId]
  );
  const activeBallSoundPreset = useMemo(
    () => TABLE_TENNIS_BALL_SOUND_PRESETS.find((preset) => preset.id === ballSoundPresetId) || TABLE_TENNIS_BALL_SOUND_PRESETS[0],
    [ballSoundPresetId]
  );
  useEffect(() => {
    graphicsQualityRef.current = graphicsQuality;
  }, [graphicsQuality]);
  useEffect(() => {
    frameRateRef.current = FRAME_RATE_MAP[frameRateId] ?? FRAME_RATE_OPTIONS[0];
  }, [frameRateId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("table-tennis-paddle-id", selectedPaddleId);
  }, [selectedPaddleId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("table-tennis-commentary-preset", commentaryPresetId);
  }, [commentaryPresetId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("table-tennis-ball-sound-preset", ballSoundPresetId);
  }, [ballSoundPresetId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("table-tennis-commentary-muted", commentaryMuted ? "1" : "0");
  }, [commentaryMuted]);

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

    const savedPaddle = window.localStorage.getItem("table-tennis-paddle-id");
    if (savedPaddle && TABLE_TENNIS_PADDLE_OPTIONS.some((option) => option.id === savedPaddle)) {
      setSelectedPaddleId(savedPaddle);
    }

    const savedPreset = window.localStorage.getItem("table-tennis-commentary-preset");
    if (savedPreset && TABLE_TENNIS_COMMENTARY_PRESETS.some((preset) => preset.id === savedPreset)) {
      setCommentaryPresetId(savedPreset);
    }
    const savedMute = window.localStorage.getItem("table-tennis-commentary-muted");
    if (savedMute === "1") setCommentaryMuted(true);

    const savedBallSound = window.localStorage.getItem("table-tennis-ball-sound-preset");
    if (savedBallSound && TABLE_TENNIS_BALL_SOUND_PRESETS.some((preset) => preset.id === savedBallSound)) {
      setBallSoundPresetId(savedBallSound);
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
  const commentaryLastAtRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

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

  const getAudioCtx = useCallback(() => {
    if (typeof window === "undefined") return null;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    if (!audioCtxRef.current) audioCtxRef.current = new AC();
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const playImpactFx = useCallback((type: "paddle" | "table") => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const makeNoise = (duration: number, gain: number) => {
      const bufferSize = Math.max(128, Math.floor(ctx.sampleRate * duration));
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const ch = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) ch[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(gain, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      src.connect(noiseGain).connect(ctx.destination);
      src.start(now);
      src.stop(now + duration + 0.01);
    };

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const tablePreset = activeBallSoundPreset || TABLE_TENNIS_BALL_SOUND_PRESETS[0];
    const startFreq = type === "paddle" ? 340 : tablePreset.startFreq;
    const endFreq = type === "paddle" ? 180 : tablePreset.endFreq;
    const duration = type === "paddle" ? 0.07 : tablePreset.duration;
    const startGain = type === "paddle" ? 0.09 : tablePreset.toneGain;
    const midGain = type === "paddle" ? 0.055 : tablePreset.toneGain * 0.56;

    osc.type = type === "paddle" ? "triangle" : tablePreset.oscType;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    oscGain.gain.setValueAtTime(startGain, now);
    oscGain.gain.exponentialRampToValueAtTime(midGain, now + duration * 0.4);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(oscGain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);

    makeNoise(type === "paddle" ? 0.03 : Math.max(0.012, duration * 0.55), type === "paddle" ? 0.02 : tablePreset.noiseGain);
  }, [activeBallSoundPreset, getAudioCtx]);

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
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!ui.call) return;
    if (ui.call === "NET") showAnnouncement("NET");
    else if (ui.call === "OUT") showAnnouncement("OUT");
    else if (ui.call === "FAULT" || ui.call === "DOUBLE" || ui.call === "MISS") showAnnouncement("FOUL");
  }, [showAnnouncement, ui.call]);

  const speakCommentary = useCallback(async (text: string) => {
    if (!text || commentaryMuted || !commentarySupported || typeof window === "undefined") return;
    const now = performance.now();
    if (now - commentaryLastAtRef.current < 260) return;
    commentaryLastAtRef.current = now;
    try {
      await speakCommentaryLines([{ speaker: 'TableTennisHost', text }], {
        voiceHints: { TableTennisHost: activeCommentaryPreset?.voiceHints || ['en-US'] }
      });
    } catch {
      setCommentarySupported(false);
    }
  }, [activeCommentaryPreset?.voiceHints, commentaryMuted, commentarySupported]);

  useEffect(() => {
    setCommentarySupported(getSpeechSupport());
    return onSpeechSupportChange((supported) => setCommentarySupported(Boolean(supported)));
  }, []);

  useEffect(() => {
    if (commentaryMuted || typeof window === "undefined") return;
    void speakCommentary(commentaryForCall(ui.call, null, activeCommentaryPreset?.language || "en"));
  }, [activeCommentaryPreset?.language, commentaryMuted, speakCommentary, ui.call]);

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
      speakCommentary(commentaryForCall(call, winner, activeCommentaryPreset?.language || "en"));

      s.call = call;

      if (isGameOver(s.score)) {
        s.phase = "gameOver";
        s.hint = winner === "player" ? "You win!" : "AI wins";
        return;
      }

      s.score.server = nextServer(s.score);
      placeForServe(s.score.server);
    },
    [activeCommentaryPreset?.language, placeForServe, showAnnouncement, speakCommentary]
  );

  const serve = useCallback(() => {
    const s = sim.current;
    const b = s.ball;
    if (s.phase !== "ready") return;
    if (s.score.server !== "player") return;

    s.phase = "serving";
    s.call = "SERVE";
    s.hint = "";
    speakCommentary(commentaryForCall("SERVE", null, activeCommentaryPreset?.language || "en"));

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
  }, [activeCommentaryPreset?.language, g, speakCommentary]);

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
      table.position.y = -U(0.065);
      scene.add(table);

      const playerPaddle = new THREE.Group();
      const pFancy = buildCurvedPaddle(
        selectedPaddleOption.frontHex,
        selectedPaddleOption.backHex,
        materials.woodMat,
        selectedPaddleOption.edgeHex
      );
      const pWrist = new THREE.Group();
      pWrist.rotation.set(THREE.MathUtils.degToRad(-18), 0, THREE.MathUtils.degToRad(12));
      pWrist.add(pFancy);
      playerPaddle.add(pWrist);
      playerPaddle.position.set(0, PADDLE.y, TABLE.L * 0.25);
      table.add(playerPaddle);

      const aiPaddle = new THREE.Group();
      const aFancy = buildCurvedPaddle(0x49dcb1, 0x333333, materials.woodMat, 0x111827);
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
            const controlY = clamp((g.current.y - 0.48) / 0.52, 0, 1);
            const px = lerp(-TABLE.W / 2 + U(0.14), TABLE.W / 2 - U(0.14), g.current.x);
            const pz = lerp(U(0.08), TABLE.L / 2 - U(0.16), controlY);
            t.paddleP.position.x = lerp(t.paddleP.position.x, px, 0.30);
            t.paddleP.position.z = lerp(t.paddleP.position.z, pz, 0.30);
            t.paddleP.position.y = PADDLE.y;
            const playerSwing = clamp((g.current.vy * -800) + g.current.speed * 1400, -0.32, 0.56);
            t.paddleP.rotation.x = lerp(t.paddleP.rotation.x, THREE.MathUtils.degToRad(-6) + playerSwing * 0.16, 0.22);
            t.paddleP.rotation.z = lerp(t.paddleP.rotation.z, clamp(g.current.vx * 22, -0.3, 0.3), 0.25);
          }

          {
            const aiLaneZ = -TABLE.L / 2 + U(0.18);
            const prediction = predictBallAtZ(b, aiLaneZ, 1.4 + AI.react[diff]);
            const fallbackPredX = b.p.x + b.v.x * (AI.react[diff] * 0.82);
            const attackBias = clamp((Math.abs(b.p.z) / TABLE.L) * AI.recoveryBias[diff], 0, AI.recoveryBias[diff]);
            const interceptionBias = clamp((Math.abs(b.v.z) / U(8.5)) * 0.28, 0, 0.28);
            const wantXRaw = b.p.z < 0 ? lerp(fallbackPredX, prediction.x, 0.76 + attackBias + interceptionBias) : prediction.x * 0.24;
            const jitter = (Math.random() * 2 - 1) * AI.jitter[diff] * (b.p.z < 0 ? 0.3 : 0.7);
            const ax = clamp(wantXRaw + jitter, -TABLE.W / 2 + U(0.18), TABLE.W / 2 - U(0.18));
            t.paddleA.position.x = lerp(t.paddleA.position.x, ax, AI.lerp[diff] + 0.04);
            t.paddleA.position.z = lerp(t.paddleA.position.z, aiLaneZ, AI.lerp[diff] * 0.94);
            t.paddleA.position.y = PADDLE.y;
            const aiSwing = clamp((Math.abs(b.v.z) / U(8)) * 0.42, 0.06, 0.42);
            t.paddleA.rotation.x = lerp(t.paddleA.rotation.x, THREE.MathUtils.degToRad(-8) + aiSwing * 0.12, 0.16);
            t.paddleA.rotation.z = lerp(t.paddleA.rotation.z, clamp((ax - t.paddleA.position.x) * 0.3, -0.18, 0.18), 0.2);
          }

          {
            const targetX = t.paddleP.position.x * 0.20 + b.p.x * 0.06;
            const targetY = CAM.yBase + b.p.y * 0.08;
            const targetZ = CAM.zBase + b.p.z * 0.06;
            t.camera.position.x = lerp(t.camera.position.x, targetX, CAM.follow);
            t.camera.position.y = lerp(t.camera.position.y, targetY, CAM.follow);
            t.camera.position.z = lerp(t.camera.position.z, targetZ, CAM.follow);
            t.camera.lookAt(b.p.x * 0.10, TABLE.H + U(0.22) + b.p.y * 0.03 - CAM.lookDownOffset, -TABLE.L * 0.06);
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
              const contactVx = b.v.x;
              const contactVz = b.v.z;
              const impactV = Math.abs(b.v.y);
              const bounceRest = clamp(PHYS.tableRest - impactV * 0.0024, 0.72, 0.88);
              b.v.y = -b.v.y * bounceRest;
              b.v.x = contactVx * PHYS.tableTangentialDamp + b.spin.y * PHYS.tableSpinTransfer;
              b.v.z = contactVz * PHYS.tableTangentialDamp - b.spin.x * PHYS.tableSpinTransfer;
              b.spin.x *= 0.985;
              b.spin.y *= 0.985;
              playImpactFx("table");

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

            playImpactFx("paddle");

            if (who === "player") {
              const targetX = lerp(-TABLE.W / 2 + U(0.18), TABLE.W / 2 - U(0.18), g.current.x);
              const targetZ = -TABLE.L / 2 + POWER.targetZPad;
              tmpTarget.set(targetX, TABLE.H + U(0.14), targetZ);

              const speed = hitSpeedFromSwipe(g.current);
              tmpDir.subVectors(tmpTarget, b.p);
              if (tmpDir.lengthSq() > 1e-9) {
                tmpDir.normalize();
                const paddleVel = new THREE.Vector3(g.current.vx * 1400, g.current.speed * 520, g.current.vy * 980);
                const desired = tmpDir.multiplyScalar(speed);
                b.v.lerp(desired, 0.72);
                b.v.addScaledVector(paddleVel, PHYS.paddleSwingTransfer);
                b.v.z = -Math.abs(b.v.z) * PHYS.paddleRest;
                b.v.y = Math.max(b.v.y, U(1.12));
                b.v.x += g.current.vx * 1200 * PHYS.paddleFriction;
              }

              const edge = clamp(dx / (PADDLE.bladeW * 0.5), -1, 1);
              const edgeSpin = edge * POWER.edgeSpinK;
              b.spin.x += (-g.current.vy * 1100) * POWER.swipeYToSpin;
              b.spin.y += (g.current.vx * 1100) * POWER.swipeXToSpin + edgeSpin;
              b.spin.z += (g.current.vx * 520 + g.current.vy * 300) * PHYS.paddleSpinTransfer;
            } else {
              const lane = pickAiSideTarget(diff);
              const wide = Math.random() < AI.sideBias[diff];
              const targetLane = wide ? lane : lane * 0.52;
              const targetX = clamp((TABLE.W * 0.5) * targetLane, -TABLE.W / 2 + U(0.18), TABLE.W / 2 - U(0.18));
              const targetZ = TABLE.L / 2 - POWER.targetZPad;
              tmpTarget.set(targetX, TABLE.H + U(0.14), targetZ);

              const base =
                lerp(POWER.hitSpeedBase, POWER.hitSpeedMax * 0.82, AI.aimStrength[diff]) *
                AI.hitPowerScale[diff] *
                pickAiPowerFactor(diff);
              tmpDir.subVectors(tmpTarget, b.p);
              if (tmpDir.lengthSq() > 1e-9) {
                tmpDir.normalize();
                const aiPaddleVel = new THREE.Vector3((targetX - pad.position.x) * 5.6, 0.38, (targetZ - pad.position.z) * 2.6);
                b.v.lerp(tmpDir.multiplyScalar(base), 0.78);
                b.v.addScaledVector(aiPaddleVel, PHYS.paddleSwingTransfer * AI.aimStrength[diff]);
                b.v.z = Math.abs(b.v.z) * PHYS.paddleRest;
                b.v.y = Math.max(b.v.y, U(1.05));
                const aiIntent = Math.sign(targetX - b.p.x || 1);
                b.v.x += aiIntent * U(0.11) * AI.aimStrength[diff];
              }

              const edge = clamp(dx / (PADDLE.bladeW * 0.5), -1, 1);
              const edgeSpin = edge * POWER.edgeSpinK * AI.spinStrength[diff];
              b.spin.x += (Math.random() * 2 - 1) * U(0.10) * AI.spinStrength[diff];
              b.spin.y += (Math.random() * 2 - 1) * U(0.14) * AI.spinStrength[diff] + edgeSpin;
              b.spin.z += (Math.random() * 2 - 1) * U(0.05) * AI.spinStrength[diff];
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
  }, [awardPoint, difficultyRef, g, placeForServe, selectedPaddleOption, serve, setCallRef]);


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
        style={{ background: "#070b1a", touchAction: "none", paddingTop: "3.5vh" }}
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
            <div className="mt-2 w-[22rem] max-w-[92vw] rounded-2xl border border-emerald-400/40 bg-black/85 p-4 text-xs text-white shadow-[0_24px_48px_rgba(0,0,0,0.6)] backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] uppercase tracking-[0.45em] text-emerald-200/70">Table Setup</span>
                <button
                  type="button"
                  onClick={() => setShowTableMenu(false)}
                  className="rounded-full p-1 text-white/70 transition-colors duration-150 hover:text-white"
                  aria-label="Close setup"
                >
                  ✕
                </button>
              </div>
              <div className="mt-4 max-h-[58vh] space-y-4 overflow-y-auto pr-1">
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Ball sound style</h3>
                  <p className="mt-1 text-[0.68rem] text-white/60">Choose one of 5 free/open sound references for table-ball bounce feel.</p>
                  <div className="mt-2 grid gap-2">
                    {TABLE_TENNIS_BALL_SOUND_PRESETS.map((preset) => {
                      const active = preset.id === ballSoundPresetId;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setBallSoundPresetId(preset.id)}
                          aria-pressed={active}
                          className={`w-full rounded-2xl border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                            active
                              ? 'border-emerald-300 bg-emerald-300/15 shadow-[0_0_12px_rgba(16,185,129,0.35)] text-white'
                              : 'border-white/10 bg-white/5 hover:border-white/20 text-white/80'
                          }`}
                        >
                          <span className="text-[11px] font-semibold uppercase tracking-[0.26em]">{preset.label}</span>
                          <span className="mt-1 block text-[10px] text-white/70">{preset.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Paddles</h3>
                  <p className="mt-1 text-[0.68rem] text-white/60">10 realistic open-source paddle thumbnails from free media libraries.</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {TABLE_TENNIS_PADDLE_OPTIONS.map((option) => {
                      const active = option.id === selectedPaddleId;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedPaddleId(option.id)}
                          aria-pressed={active}
                          className={`w-full rounded-2xl border px-2 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                            active
                              ? "border-emerald-300 bg-emerald-300/15 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                              : "border-white/10 bg-white/5 hover:border-white/20 text-white/80"
                          }`}
                        >
                          <span className="block h-16 overflow-hidden rounded-xl border border-white/15 bg-black/20">
                            <img src={option.thumbnail} alt={option.label} className="h-full w-full object-cover" loading="lazy" />
                          </span>
                          <span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-white">{option.label}</span>
                          <span className="mt-1 block text-[9px] uppercase tracking-[0.2em] text-white/60">{option.source}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Commentary language</h3>
                  <div className="mt-2 grid gap-2">
                    {TABLE_TENNIS_COMMENTARY_PRESETS.map((preset) => {
                      const active = preset.id === commentaryPresetId;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setCommentaryPresetId(preset.id)}
                          aria-pressed={active}
                          disabled={!commentarySupported}
                          className={`w-full rounded-2xl border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                            active
                              ? 'border-emerald-300 bg-emerald-300/15 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                              : 'border-white/10 bg-white/5 hover:border-white/20 text-white/80'
                          } ${commentarySupported ? '' : 'cursor-not-allowed opacity-60'}`}
                        >
                          <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white">{preset.label}</span>
                          <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-white/60">{preset.description}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCommentaryMuted((prev) => !prev)}
                    aria-pressed={commentaryMuted}
                    disabled={!commentarySupported}
                    className={`mt-2 flex w-full items-center justify-between gap-3 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] transition-all duration-200 ${
                      commentaryMuted
                        ? 'bg-emerald-400 text-black shadow-[0_0_18px_rgba(16,185,129,0.65)]'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                    } ${commentarySupported ? '' : 'cursor-not-allowed opacity-60'}`}
                  >
                    <span>Mute commentary</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] tracking-[0.3em] ${commentaryMuted ? 'border-black/30 text-black/70' : 'border-white/30 text-white/70'}`}>
                      {commentaryMuted ? 'On' : 'Off'}
                    </span>
                  </button>
                  {!commentarySupported && <p className="mt-2 text-[0.65rem] text-white/60">Voice commentary requires browser speech support.</p>}
                </div>

                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Sound FX</h3>
                  <p className="mt-1 text-[0.68rem] text-white/60">Ball/table and paddle hits are fully procedural via WebAudio (no binary audio files added to git).</p>
                  <div className="mt-2 space-y-1 rounded-xl border border-white/15 bg-white/5 p-2">
                    {TABLE_TENNIS_BALL_SOUND_PRESETS.map((preset) => (
                      <a
                        key={preset.id}
                        href={preset.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border border-white/10 px-2 py-1 text-[10px] text-emerald-100/85 transition hover:border-emerald-300/60 hover:bg-emerald-400/10"
                      >
                        <span className="font-semibold uppercase tracking-[0.18em]">{preset.label}</span>
                        <span className="ml-2 text-white/70">{preset.source}</span>
                        <span className="ml-2 text-white/50">{preset.license}</span>
                      </a>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Graphics</h3>
                  <div className="mt-2 grid gap-2">
                    {(["low", "medium", "high"] as GraphicsQuality[]).map((quality) => {
                      const active = graphicsQuality === quality;
                      return (
                        <button
                          key={quality}
                          type="button"
                          onClick={() => setGraphicsQuality(quality)}
                          aria-pressed={active}
                          className={`w-full rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] transition-all duration-200 ${
                            active
                              ? 'border-emerald-300 bg-emerald-300 text-black shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                              : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/20'
                          }`}
                        >
                          {quality}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">FPS profile</h3>
                  <div className="mt-2 grid gap-2">
                    {FRAME_RATE_OPTIONS.map((option) => {
                      const active = option.id === frameRateId;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setFrameRateId(option.id)}
                          aria-pressed={active}
                          className={`w-full rounded-2xl border px-4 py-2 text-left transition-all duration-200 ${
                            active
                              ? 'border-emerald-300 bg-emerald-300/90 text-black shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                              : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/20'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.28em]">{option.label}</span>
                            <span className="text-xs font-semibold tracking-wide">{option.fps} FPS</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Venue HDRI</span>
                  <select
                    value={environmentHdriId}
                    onChange={(e) => setEnvironmentHdriId(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white"
                  >
                    {POOL_ROYALE_HDRI_VARIANTS.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.name}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={reset}
                  className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-white"
                >
                  Reset match
                </button>
              </div>
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
