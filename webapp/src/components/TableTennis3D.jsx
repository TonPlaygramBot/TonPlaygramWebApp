import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { createArenaCarpetMaterial, createArenaWallMaterial } from "../utils/arenaDecor.js";
import { applySRGBColorSpace } from "../utils/colorSpace.js";

const GAME_VARIANTS = [
  {
    id: "pro-arena",
    name: "Pro Arena Broadcast",
    badge: "Broadcast Classic",
    tagline: "ACES-toned championship lighting with balanced bounce and spin.",
    renderer: { exposure: 1.85 },
    scene: { background: 0x0b0e14 },
    lighting: {
      hemisphere: { sky: 0xffffff, ground: 0x1b2233, intensity: 0.95 },
      sun: { color: 0xffffff, intensity: 0.95, position: [-16, 28, 18] },
      rim: { color: 0x99ccff, intensity: 0.35, position: [20, 14, -12] },
      spotlights: [
        { position: [-8, 6, -8], color: 0xffffff, intensity: 0.7, angle: Math.PI / 5, penumbra: 0.3 },
        { position: [8, 6, -8], color: 0xffffff, intensity: 0.7, angle: Math.PI / 5, penumbra: 0.3 },
        { position: [-8, 6, 8], color: 0xffffff, intensity: 0.7, angle: Math.PI / 5, penumbra: 0.3 },
        { position: [8, 6, 8], color: 0xffffff, intensity: 0.7, angle: Math.PI / 5, penumbra: 0.3 },
      ],
    },
    materials: {
      table: { color: 0x1e3a8a, roughness: 0.6 },
      lines: { color: 0xffffff, roughness: 0.35 },
      metal: { color: 0x9aa4b2, roughness: 0.45, metalness: 0.6 },
      wheel: { color: 0x111111, roughness: 0.9 },
      paddles: { player: 0xff4d6d, opponent: 0x49dcb1 },
    },
    carpet: { color: 0xb01224, emissive: 0x2d020a, emissiveIntensity: 0.18, bumpScale: 0.24 },
    floor: { color: 0x0f1222 },
    walls: { color: 0xeeeeee },
    ball: {
      color: 0xfff1cc,
      emissive: 0xffd7a1,
      emissiveIntensity: 0.55,
      glowColor: 0xffd7a1,
      glowIntensity: 0.85,
      glowDistance: 4.2,
      shadowColor: 0x000000,
      shadowOpacity: 0.22,
      roughness: 0.6,
    },
    trail: { color: 0xfff1cc, minOpacity: 0.18, maxOpacity: 0.62, speedFactor: 0.045, count: 18 },
    camera: { dist: 3.46, minDist: 3.18, height: 2.04, minHeight: 1.82, pitch: 0.34, forwardBias: 0.06, yawBase: 0, yawRange: 0.38 },
    physics: {
      drag: 0.48,
      tableRest: 0.84,
      tableFriction: 0.22,
      paddleRest: 1.02,
      paddleAim: 0.58,
      paddleLift: 0.18,
      netRest: 0.37,
      forceScale: 0.82,
      serveTimers: { player: 0.45, opponent: 0.6 }
    },
    ai: { speed: 1, vertical: 1, react: 1 },
  },
  {
    id: "neon",
    name: "Neon Synthwave Run",
    badge: "Neon Velocity",
    tagline: "Futuristic neon rig with extra spin and arcade-grade tempo.",
    renderer: { exposure: 2.1 },
    scene: { background: 0x040018 },
    lighting: {
      hemisphere: { sky: 0x7a9dff, ground: 0x12041f, intensity: 1.05 },
      sun: { color: 0xff5fb7, intensity: 0.95, position: [-12, 24, 16] },
      rim: { color: 0x4bf9ff, intensity: 0.65, position: [18, 12, -14] },
      spotlights: [
        { position: [-8, 6.5, -7], color: 0xff63d1, intensity: 0.92, angle: Math.PI / 4.4, penumbra: 0.55 },
        { position: [8, 6.5, -7], color: 0x55f7ff, intensity: 0.92, angle: Math.PI / 4.6, penumbra: 0.55 },
        { position: [-8, 6.5, 7], color: 0xff63d1, intensity: 0.88, angle: Math.PI / 4.3, penumbra: 0.5 },
        { position: [8, 6.5, 7], color: 0x55f7ff, intensity: 0.88, angle: Math.PI / 4.3, penumbra: 0.5 },
      ],
    },
    materials: {
      table: { color: 0x1b1540, roughness: 0.38, metalness: 0.08 },
      lines: { color: 0x7fffd4, roughness: 0.25 },
      metal: { color: 0x293460, roughness: 0.32, metalness: 0.7 },
      wheel: { color: 0x070b1a, roughness: 0.7 },
      paddles: { player: 0xff5c8a, opponent: 0x4df3ff },
    },
    carpet: { color: 0x1a0835, emissive: 0x531575, emissiveIntensity: 0.35, bumpScale: 0.28 },
    floor: { color: 0x05030d },
    walls: { color: 0x1b1d45 },
    ball: {
      color: 0xfff8f0,
      emissive: 0xff78f3,
      emissiveIntensity: 0.9,
      glowColor: 0xff78f3,
      glowIntensity: 1.35,
      glowDistance: 5.2,
      shadowColor: 0x120416,
      shadowOpacity: 0.28,
      roughness: 0.45,
    },
    trail: { color: 0xff4bf1, minOpacity: 0.22, maxOpacity: 0.82, speedFactor: 0.06, count: 22 },
    camera: { dist: 3.58, minDist: 3.22, height: 2.12, minHeight: 1.9, pitch: 0.36, forwardBias: 0.12, yawBase: 0, yawRange: 0.52 },
    physics: {
      drag: 0.46,
      tableRest: 0.85,
      tableFriction: 0.21,
      paddleRest: 1.06,
      paddleAim: 0.62,
      paddleLift: 0.17,
      netRest: 0.35,
      forceScale: 0.88,
      serveTimers: { player: 0.43, opponent: 0.58 }
    },
    ai: { speed: 1.08, vertical: 1.04, react: 0.94 },
  },
  {
    id: "zen",
    name: "Zen Garden Invitational",
    badge: "Zen Control",
    tagline: "Warm studio palette with softer physics for technical rallies.",
    renderer: { exposure: 1.72 },
    scene: { background: 0x0e1b12 },
    lighting: {
      hemisphere: { sky: 0xfff7e6, ground: 0x1a2c1f, intensity: 0.98 },
      sun: { color: 0xffd08a, intensity: 1.08, position: [-14, 26, 14] },
      rim: { color: 0x90d4a8, intensity: 0.32, position: [16, 12, -10] },
      spotlights: [
        { position: [-7.5, 6.2, -7.5], color: 0xffc28a, intensity: 0.82, angle: Math.PI / 4.8, penumbra: 0.38 },
        { position: [7.5, 6.2, -7.5], color: 0xffd6a3, intensity: 0.82, angle: Math.PI / 4.8, penumbra: 0.38 },
        { position: [-7.5, 6.2, 7.5], color: 0xffc28a, intensity: 0.78, angle: Math.PI / 4.9, penumbra: 0.36 },
        { position: [7.5, 6.2, 7.5], color: 0xffd6a3, intensity: 0.78, angle: Math.PI / 4.9, penumbra: 0.36 },
      ],
    },
    materials: {
      table: { color: 0x126b55, roughness: 0.58 },
      lines: { color: 0xfdf8e1, roughness: 0.3 },
      metal: { color: 0xc89f72, roughness: 0.52, metalness: 0.55 },
      wheel: { color: 0x382f2a, roughness: 0.85 },
      paddles: { player: 0xff8562, opponent: 0x4dbb84 },
    },
    carpet: { color: 0x214234, emissive: 0x11261c, emissiveIntensity: 0.22, bumpScale: 0.22 },
    floor: { color: 0x1b2a20 },
    walls: { color: 0xe4d8c4 },
    ball: {
      color: 0xfff6dd,
      emissive: 0xffc9a1,
      emissiveIntensity: 0.48,
      glowColor: 0xffcfa4,
      glowIntensity: 0.72,
      glowDistance: 3.8,
      shadowColor: 0x1a1309,
      shadowOpacity: 0.24,
      roughness: 0.58,
    },
    trail: { color: 0xfff1c0, minOpacity: 0.16, maxOpacity: 0.54, speedFactor: 0.036, count: 18 },
    camera: { dist: 3.32, minDist: 3.05, height: 1.98, minHeight: 1.78, pitch: 0.32, forwardBias: 0.05, yawBase: 0, yawRange: 0.34 },
    physics: {
      drag: 0.5,
      tableRest: 0.83,
      tableFriction: 0.18,
      paddleRest: 0.98,
      paddleAim: 0.58,
      paddleLift: 0.16,
      netRest: 0.38,
      forceScale: 0.76,
      serveTimers: { player: 0.47, opponent: 0.62 }
    },
    ai: { speed: 0.94, vertical: 0.96, react: 1.05 },
  },
  {
    id: "midnight",
    name: "Midnight Championship",
    badge: "Midnight Finals",
    tagline: "Theatre spotlights with explosive trails for dramatic finals.",
    renderer: { exposure: 1.65 },
    scene: { background: 0x030304 },
    lighting: {
      hemisphere: { sky: 0x6b768f, ground: 0x04050a, intensity: 0.88 },
      sun: { color: 0xffe0c2, intensity: 0.75, position: [-10, 30, 12] },
      rim: { color: 0x4a8bff, intensity: 0.48, position: [24, 18, -16] },
      spotlights: [
        { position: [-7.2, 7, -7.2], color: 0xffa35a, intensity: 0.96, angle: Math.PI / 5.2, penumbra: 0.44 },
        { position: [7.2, 7, -7.2], color: 0xf0f4ff, intensity: 0.9, angle: Math.PI / 5.2, penumbra: 0.44 },
        { position: [-7.2, 7, 7.2], color: 0xffa35a, intensity: 0.92, angle: Math.PI / 5.4, penumbra: 0.42 },
        { position: [7.2, 7, 7.2], color: 0xf0f4ff, intensity: 0.92, angle: Math.PI / 5.4, penumbra: 0.42 },
      ],
    },
    materials: {
      table: { color: 0x0e1b37, roughness: 0.46 },
      lines: { color: 0xffffff, roughness: 0.28 },
      metal: { color: 0x5c6f8f, roughness: 0.35, metalness: 0.7 },
      wheel: { color: 0x0c0f19, roughness: 0.78 },
      paddles: { player: 0xff5f3d, opponent: 0x3fa0ff },
    },
    carpet: { color: 0x1c0c1c, emissive: 0x2f072f, emissiveIntensity: 0.28, bumpScale: 0.27 },
    floor: { color: 0x07070a },
    walls: { color: 0xcfd5e4 },
    ball: {
      color: 0xffe0c4,
      emissive: 0xff9b42,
      emissiveIntensity: 0.82,
      glowColor: 0xff933b,
      glowIntensity: 1.28,
      glowDistance: 5,
      shadowColor: 0x050304,
      shadowOpacity: 0.3,
      roughness: 0.5,
    },
    trail: { color: 0xff8b3d, minOpacity: 0.24, maxOpacity: 0.86, speedFactor: 0.055, count: 20 },
    camera: { dist: 3.7, minDist: 3.32, height: 2.22, minHeight: 2, pitch: 0.35, forwardBias: 0.08, yawBase: 0, yawRange: 0.4 },
    physics: {
      drag: 0.45,
      tableRest: 0.86,
      tableFriction: 0.2,
      paddleRest: 1.05,
      paddleAim: 0.64,
      paddleLift: 0.19,
      netRest: 0.32,
      forceScale: 0.85,
      serveTimers: { player: 0.44, opponent: 0.59 }
    },
    ai: { speed: 1.12, vertical: 1.08, react: 0.92 },
  },
  {
    id: "analytic",
    name: "Analytic Coach Suite",
    badge: "Coach Vision",
    tagline: "Top-down tactical view with extended trails for match analysis.",
    renderer: { exposure: 1.78 },
    scene: { background: 0x0a1018 },
    lighting: {
      hemisphere: { sky: 0xc7d7ff, ground: 0x060b12, intensity: 1.02 },
      sun: { color: 0xf5fbff, intensity: 0.68, position: [-18, 32, 10] },
      rim: { color: 0x7fd9ff, intensity: 0.42, position: [14, 18, -18] },
      spotlights: [
        { position: [-8.5, 7.5, -6.5], color: 0xa3c4ff, intensity: 0.82, angle: Math.PI / 5, penumbra: 0.48 },
        { position: [8.5, 7.5, -6.5], color: 0xb1f0ff, intensity: 0.82, angle: Math.PI / 5, penumbra: 0.48 },
        { position: [-8.5, 7.5, 6.5], color: 0xa3c4ff, intensity: 0.78, angle: Math.PI / 5.2, penumbra: 0.46 },
        { position: [8.5, 7.5, 6.5], color: 0xb1f0ff, intensity: 0.78, angle: Math.PI / 5.2, penumbra: 0.46 },
      ],
    },
    materials: {
      table: { color: 0x1f3d70, roughness: 0.42 },
      lines: { color: 0xf2f7ff, roughness: 0.22 },
      metal: { color: 0x6a7fab, roughness: 0.36, metalness: 0.65 },
      wheel: { color: 0x1a2337, roughness: 0.68 },
      paddles: { player: 0x4d9eff, opponent: 0x8df29b },
    },
    carpet: { color: 0x10223b, emissive: 0x0b1b32, emissiveIntensity: 0.25, bumpScale: 0.26 },
    floor: { color: 0x0b0f19 },
    walls: { color: 0xd3deff },
    ball: {
      color: 0xf5f7ff,
      emissive: 0x64a6ff,
      emissiveIntensity: 0.95,
      glowColor: 0x64a6ff,
      glowIntensity: 1.2,
      glowDistance: 5.6,
      shadowColor: 0x050a16,
      shadowOpacity: 0.26,
      roughness: 0.38,
    },
    trail: { color: 0x6cb8ff, minOpacity: 0.14, maxOpacity: 0.55, speedFactor: 0.034, count: 28 },
    camera: { dist: 3.1, minDist: 2.9, height: 2.62, minHeight: 2.38, pitch: 0.48, forwardBias: 0.03, yawBase: 0, yawRange: 0.24 },
    physics: {
      drag: 0.52,
      tableRest: 0.84,
      tableFriction: 0.18,
      paddleRest: 0.96,
      paddleAim: 0.54,
      paddleLift: 0.15,
      netRest: 0.4,
      forceScale: 0.74,
      serveTimers: { player: 0.49, opponent: 0.64 }
    },
    ai: { speed: 0.9, vertical: 0.92, react: 1.08 },
  },
];

const BROADCAST_PRESETS = [
  {
    id: "center-line",
    name: "Center Line Classic",
    badge: "Host Angle",
    description: "Balanced orbit with gentle follow for broadcast neutral shots.",
    camera: { yawRange: 0.36, pitch: 0.34, height: 2.04, dist: 3.46, forwardBias: 0.06 },
    tracking: { followLerp: 0.2, rallyBlend: 0.55, yawDamping: 0.18, distDamping: 0.1 },
  },
  {
    id: "sideline-slide",
    name: "Sideline Slide",
    badge: "Low Track",
    description: "Lower sideline dolly with wider yaw for dynamic highlight cuts.",
    camera: { yawBase: -0.16, yawRange: 0.56, pitch: 0.28, height: 1.86, dist: 3.32, forwardBias: 0.04 },
    tracking: { followLerp: 0.24, rallyBlend: 0.48, yawDamping: 0.14, distDamping: 0.12 },
  },
  {
    id: "skybox-hawk",
    name: "Skybox Hawk",
    badge: "Aerial View",
    description: "High tactical top cam for coaching-friendly replays.",
    camera: { yawBase: 0, yawRange: 0.22, pitch: 0.46, height: 2.82, dist: 3.22, forwardBias: 0 },
    tracking: { followLerp: 0.16, rallyBlend: 0.68, yawDamping: 0.2, distDamping: 0.14 },
  },
  {
    id: "impact-reel",
    name: "Impact Reel",
    badge: "Punch-In",
    description: "Tighter framing with aggressive yaw swing for power rallies.",
    camera: { yawBase: 0.08, yawRange: 0.72, pitch: 0.32, height: 1.94, dist: 3.04, forwardBias: 0.02 },
    tracking: { followLerp: 0.26, rallyBlend: 0.6, yawDamping: 0.22, distDamping: 0.12 },
  },
  {
    id: "analytic-top",
    name: "Analytic Deck",
    badge: "Coach Cam",
    description: "Stable tripod feel with slow yaw and steady follow for analysis.",
    camera: { yawBase: 0, yawRange: 0.28, pitch: 0.4, height: 2.46, dist: 3.58, forwardBias: 0.05 },
    tracking: { followLerp: 0.14, rallyBlend: 0.42, yawDamping: 0.12, distDamping: 0.08 },
  },
];

const BALL_TECHNIQUES = [
  {
    id: "olympic-pace",
    name: "Olympic Pace",
    badge: "Fast Control",
    description: "Quick rallies with stable arcs and assertive paddle rebound.",
    physics: { drag: 0.44, magnusCoeff: 0.46, spinDecay: 0.9, forceScale: 0.92, tableRest: 0.86, paddleRest: 1.08, paddleAim: 0.64 },
  },
  {
    id: "spin-lab",
    name: "Spin Lab",
    badge: "Heavy Spin",
    description: "Amplified Magnus and softer damping for dramatic curves.",
    physics: { drag: 0.48, magnusCoeff: 0.62, spinDecay: 0.93, forceScale: 0.82, tableFriction: 0.24, paddleLift: 0.22 },
  },
  {
    id: "defense-wall",
    name: "Defense Wall",
    badge: "Chop Play",
    description: "Lower bounce, extra friction for controlled defensive chops.",
    physics: { drag: 0.52, magnusCoeff: 0.38, spinDecay: 0.88, forceScale: 0.76, tableRest: 0.82, tableFriction: 0.28, netRest: 0.34 },
  },
  {
    id: "arcade-rush",
    name: "Arcade Rush",
    badge: "Turbo",
    description: "High-energy arcade tempo with bouncy paddle reactions.",
    physics: { drag: 0.42, magnusCoeff: 0.5, spinDecay: 0.96, forceScale: 0.98, paddleRest: 1.12, paddleLift: 0.2 },
  },
  {
    id: "studio-soft",
    name: "Studio Soft",
    badge: "Warmup",
    description: "Gentle speed for practice with friendlier bounce envelope.",
    physics: { drag: 0.54, magnusCoeff: 0.36, spinDecay: 0.94, forceScale: 0.7, tableRest: 0.8, paddleRest: 0.96, paddleAim: 0.56 },
  },
];

const TOUCH_PRESETS = [
  {
    id: "precision-swipe",
    name: "Precision Swipe",
    badge: "Linear",
    description: "Direct mapping for tournament players with minimal assist.",
    swipe: { minSpeed: 200, maxSpeed: 1650, liftRange: [0.3, 1.08], forwardRange: [0.92, 1.54], lateralScale: 1.4, curveScale: 0.9, chopScale: 1 },
    tracking: { targetLerp: { x: 0.52, z: 0.46 }, cameraBias: 0 },
  },
  {
    id: "assist-glide",
    name: "Assist Glide",
    badge: "Assisted",
    description: "Heavier smoothing with spin guard for consistent rallying.",
    swipe: { minSpeed: 160, maxSpeed: 1500, liftRange: [0.34, 1.02], forwardRange: [0.86, 1.4], lateralScale: 1.2, curveScale: 0.7, chopScale: 0.72 },
    tracking: { targetLerp: { x: 0.62, z: 0.58 }, cameraBias: 0.06 },
  },
  {
    id: "arcade-flick",
    name: "Arcade Flick",
    badge: "Aggro",
    description: "Quicker moves and exaggerated lift for mobile arcade feel.",
    swipe: { minSpeed: 140, maxSpeed: 1900, liftRange: [0.4, 1.2], forwardRange: [0.98, 1.68], lateralScale: 1.8, curveScale: 1.1, chopScale: 1.1 },
    tracking: { targetLerp: { x: 0.48, z: 0.38 }, cameraBias: -0.04 },
  },
  {
    id: "aerial-touch",
    name: "Aerial Touch",
    badge: "Loft",
    description: "Higher arc bias with softer lateral damping for lobs.",
    swipe: { minSpeed: 180, maxSpeed: 1600, liftRange: [0.44, 1.16], forwardRange: [0.84, 1.32], lateralScale: 1.15, curveScale: 0.85, chopScale: 1.2 },
    tracking: { targetLerp: { x: 0.58, z: 0.52 }, cameraBias: 0.02 },
  },
  {
    id: "coach-stable",
    name: "Coach Stable",
    badge: "Stable",
    description: "Extra stability and damped curves for analysis and drills.",
    swipe: { minSpeed: 190, maxSpeed: 1550, liftRange: [0.32, 1], forwardRange: [0.78, 1.28], lateralScale: 1, curveScale: 0.6, chopScale: 0.65 },
    tracking: { targetLerp: { x: 0.66, z: 0.62 }, cameraBias: 0.08 },
  },
];

class Rules {
  constructor() {
    this.score = { player: 0, ai: 0 };
    this.service = { server: "Player", servesSinceSwap: 0 };
    this.stage = "Warmup"; // Warmup | ServeFlying | Rally | PointOver | GameOver
    this.rally = { lastHitter: null, lastSideBounce: null, consecutiveBouncesOnSameSide: 0 };
    this.contact = { touchedNetThisFlight: false };
    this.letServe = false;
  }
  resetRally(){
    this.rally = { lastHitter: null, lastSideBounce: null, consecutiveBouncesOnSameSide: 0 };
    this.contact.touchedNetThisFlight = false;
    this.letServe = false;
  }
  isDeuce(){
    return this.score.player >= 10 && this.score.ai >= 10 && Math.abs(this.score.player - this.score.ai) < 2;
  }
  currentServeSpan(){
    return this.isDeuce() ? 1 : 2;
  }
  awardPoint(side){
    if (this.stage === "GameOver") return;
    if (this.letServe) {
      this.letServe = false;
      this.stage = "ServeFlying";
      this.resetRally();
      return;
    }
    if (side === "Player") this.score.player += 1; else this.score.ai += 1;
    const lead = Math.abs(this.score.player - this.score.ai);
    const maxp = Math.max(this.score.player, this.score.ai);
    if (maxp >= 11 && lead >= 2) {
      this.stage = "GameOver";
      return;
    }
    this.service.servesSinceSwap += 1;
    if (this.service.servesSinceSwap >= this.currentServeSpan()) {
      this.service.server = this.service.server === "Player" ? "AI" : "Player";
      this.service.servesSinceSwap = 0;
    }
    this.stage = "PointOver";
  }
}

const SIMPLE_DIFFICULTY = {
  Easy:   { react: 2.5, aimErr: 0.28, power: 0.8, spin: 0.5 },
  Medium: { react: 4.0, aimErr: 0.13, power: 1.0, spin: 0.9 },
  Hard:   { react: 6.0, aimErr: 0.05, power: 1.2, spin: 1.3 },
};

const simpleClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const simpleLerp = (a, b, t) => a + (b - a) * t;
const simpleRand = (a, b) => Math.random() * (b - a) + a;

function planAIReturn(ballState, difficulty) {
  const preset = SIMPLE_DIFFICULTY[difficulty] || SIMPLE_DIFFICULTY.Medium;
  const halfL = 2.74 / 2;
  const halfW = 1.525 / 2;
  const aimX = simpleClamp(ballState.pos.x + simpleRand(-0.3, 0.3), -halfW * 0.75, halfW * 0.75);
  const aimZ = halfL * simpleLerp(0.18, 0.35, Math.random());
  const target = new THREE.Vector3(aimX, 0.76 + 0.02, aimZ);
  const dir = target.clone().sub(ballState.pos).normalize();
  const impulse = dir.multiplyScalar(3.2 * preset.power);
  impulse.y = 2.4 * preset.power;
  const sideSpin = simpleRand(-1, 1) * 40 * preset.spin;
  const topSpin = 50 * preset.spin;
  ballState.omega.set(0, sideSpin, topSpin);
  return { impulse, target };
}

/**
 * TABLE TENNIS 3D — Mobile Portrait (1:1)
 * --------------------------------------
 * • Full-screen on phones (100dvh). Portrait-only experience; no overflow.
 * • 3D table (official size ratio), white lines, center net with posts.
 * • Controls: drag with one finger to move the racket; ball follows real-ish ping-pong physics.
 * • Camera: fixed angle that keeps the entire table centered on screen.
 * • AI opponent on the far side with adjustable difficulty and reaction delay.
 * • Scoring: to 11, win by 2; service swaps every 2 points, auto-serve & rally logic.
 */

export default function TableTennis3D({ player, ai }){
  const hostRef = useRef(null);
  const raf = useRef(0);
  const audioRef = useRef({ ctx: null, buffers: {} });
  const variant = GAME_VARIANTS[0];
  const broadcastProfile = BROADCAST_PRESETS[0];
  const ballProfile = BALL_TECHNIQUES[0];
  const touchProfile = TOUCH_PRESETS[0];

  const playerLabel = player?.name || 'You';
  const aiLabel = ai?.name || 'AI';
  const initialServer = useMemo(() => (Math.random() < 0.5 ? 'Player' : 'AI'), []);
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [server, setServer] = useState(initialServer);
  const [stage, setStage] = useState('Warmup');
  const [message, setMessage] = useState(`${initialServer === 'Player' ? playerLabel : aiLabel} to serve`);
  const [winner, setWinner] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const rulesRef = useRef(new Rules());
  useEffect(() => {
    rulesRef.current.service.server = initialServer;
  }, [initialServer]);

  const difficulty = useMemo(() => {
    const tag = (ai?.difficulty || ai?.level || 'medium').toString().toLowerCase();
    if (tag.includes('easy')) return 'Easy';
    if (tag.includes('hard') || tag.includes('pro') || tag.includes('legend')) return 'Hard';
    return 'Medium';
  }, [ai?.difficulty, ai?.level]);

  useEffect(()=>{
    const host = hostRef.current; if (!host) return;

    // Procedural, license-free blips (no binary assets) for paddle + table hits
    const ensureAudio = () => {
      if (audioRef.current.ctx) return audioRef.current.ctx;
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      audioRef.current.ctx = new Ctor();
      return audioRef.current.ctx;
    };

    const resumeAudio = () => {
      const ctx = ensureAudio();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    };

    const makeHitBuffer = (freq = 420, duration = 0.14, noisy = false) => {
      const ctx = ensureAudio();
      if (!ctx) return null;
      const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1){
        const t = i / ctx.sampleRate;
        const env = Math.pow(1 - t / duration, 3);
        const osc = noisy ? (Math.random() * 2 - 1) * 0.6 : Math.sin(2 * Math.PI * freq * t);
        data[i] = osc * env;
      }
      return buffer;
    };

    const playSfx = (name, gain = 0.9, rate = 1) => {
      const ctx = ensureAudio();
      const buffer = audioRef.current.buffers[name];
      if (!ctx || !buffer) return;
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      g.gain.value = gain;
      src.connect(g).connect(ctx.destination);
      src.start();
    };

    const ctx = ensureAudio();
    if (ctx && (!audioRef.current.buffers.bounce || !audioRef.current.buffers.paddle)){
      audioRef.current.buffers.bounce = makeHitBuffer(360, 0.18, true);
      audioRef.current.buffers.paddle = makeHitBuffer(920, 0.16, false);
    }

    const rendererSettings = variant.renderer ?? {};
    const sceneSettings = variant.scene ?? {};
    const lightingSettings = variant.lighting ?? {};
    const broadcastSettings = broadcastProfile ?? {};
    const trackingSettings = broadcastSettings.tracking ?? {};
    const hemiSettings = lightingSettings.hemisphere ?? {};
    const sunSettings = lightingSettings.sun ?? {};
    const rimSettings = lightingSettings.rim ?? {};
    const spotlightSpecs = (lightingSettings.spotlights && lightingSettings.spotlights.length)
      ? lightingSettings.spotlights
      : [
          { position: [-8, 6, -8], color: 0xffffff, intensity: 0.7, angle: Math.PI / 5, penumbra: 0.3 },
          { position: [8, 6, -8], color: 0xffffff, intensity: 0.7, angle: Math.PI / 5, penumbra: 0.3 },
          { position: [-8, 6, 8], color: 0xffffff, intensity: 0.7, angle: Math.PI / 5, penumbra: 0.3 },
          { position: [8, 6, 8], color: 0xffffff, intensity: 0.7, angle: Math.PI / 5, penumbra: 0.3 },
        ];
    const materialsSettings = variant.materials ?? {};
    const tableSettings = materialsSettings.table ?? {};
    const lineSettings = materialsSettings.lines ?? {};
    const metalSettings = materialsSettings.metal ?? {};
    const wheelSettings = materialsSettings.wheel ?? {};
    const paddleSettings = materialsSettings.paddles ?? {};
    const carpetSettings = variant.carpet ?? {};
    const floorSettings = variant.floor ?? {};
    const wallSettings = variant.walls ?? {};
    const ballSettings = variant.ball ?? {};
    const trailSettings = variant.trail ?? {};
    const cameraSettings = { ...(variant.camera ?? {}), ...(broadcastSettings.camera ?? {}) };
    const physicsSettings = { ...(variant.physics ?? {}), ...(ballProfile.physics ?? {}) };
    const aiSettings = variant.ai ?? {};
    const serveTimers = physicsSettings.serveTimers ?? { player: 0.45, opponent: 0.6 };
    const TRAIL_COUNT = trailSettings.count ?? 18;
    const minTrailOpacity = trailSettings.minOpacity ?? 0.18;
    const maxTrailOpacity = trailSettings.maxOpacity ?? 0.62;
    const trailSpeedFactor = trailSettings.speedFactor ?? 0.045;
    // Prevent overscroll on mobile
    const prevOver = document.documentElement.style.overscrollBehavior;
    document.documentElement.style.overscrollBehavior = 'none';

    // ---------- Renderer ----------
    const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(2.5, window.devicePixelRatio||1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = rendererSettings.exposure ?? 1.85;
    // Disable real-time shadow mapping to avoid dark artifacts on the
    // arena walls and table surface. Shadow maps from the multiple
    // spotlights were causing the entire scene to appear black in some
    // devices/browsers. We render a fake ball shadow manually so real
    // shadows are unnecessary here.
    renderer.shadowMap.enabled = false;
    // ensure canvas CSS size matches the host container
    const setSize = () => renderer.setSize(host.clientWidth, host.clientHeight);
    setSize();
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    // ---------- Scene & Lights ----------
    const scene = new THREE.Scene(); scene.background = new THREE.Color(sceneSettings.background ?? 0x0b0e14);
    const hemi = new THREE.HemisphereLight(
      hemiSettings.sky ?? 0xffffff,
      hemiSettings.ground ?? 0x1b2233,
      hemiSettings.intensity ?? 0.95
    );
    scene.add(hemi);
    // Directional key light. Shadow casting is disabled because shadow
    // maps are turned off above; keeping it false prevents accidental
    // blackening of surfaces.
    const sun = new THREE.DirectionalLight(sunSettings.color ?? 0xffffff, sunSettings.intensity ?? 0.95);
    sun.position.set(
      ...(sunSettings.position ?? [-16, 28, 18])
    );
    sun.castShadow = false;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(rimSettings.color ?? 0x99ccff, rimSettings.intensity ?? 0.35);
    rim.position.set(...(rimSettings.position ?? [20, 14, -12]));
    scene.add(rim);

    // arena spotlights
    spotlightSpecs.forEach(spec => {
      const s = new THREE.SpotLight(spec.color ?? 0xffffff, spec.intensity ?? 0.7);
      s.position.set(spec.position?.[0] ?? 0, spec.position?.[1] ?? 6, spec.position?.[2] ?? 0);
      s.angle = spec.angle ?? Math.PI / 5;
      s.penumbra = spec.penumbra ?? 0.3;
      s.castShadow = false;
      const target = spec.target ?? [0, 1, 0];
      s.target.position.set(target[0], target[1], target[2]);
      scene.add(s);
      scene.add(s.target);
    });

    // ---------- Camera ----------
    const camera = new THREE.PerspectiveCamera(60, host.clientWidth/host.clientHeight, 0.05, 500);
    scene.add(camera);
    const camRig = {
      dist: cameraSettings.dist ?? 3.46,
      minDist: cameraSettings.minDist ?? 3.18,
      height: cameraSettings.height ?? 2.04,
      minHeight: cameraSettings.minHeight ?? 1.82,
      pitch: cameraSettings.pitch ?? 0.34,
      forwardBias: (cameraSettings.forwardBias ?? 0.06) + (trackingSettings.cameraBias ?? 0),
      yawBase: cameraSettings.yawBase ?? 0,
      yawRange: cameraSettings.yawRange ?? 0.38,
      curYaw: cameraSettings.yawBase ?? 0,
      curDist: cameraSettings.dist ?? 3.46,
      curHeight: cameraSettings.height ?? 2.04,
      yawUser: 0,
      pitchUser: 0,
      followLerp: trackingSettings.followLerp ?? 0.28,
      rallyBlend: trackingSettings.rallyBlend ?? 0.6,
      yawDamping: trackingSettings.yawDamping ?? 0.2,
      distDamping: trackingSettings.distDamping ?? 0.12,
    };
    camera.position.set(0, camRig.height * S, camRig.dist * S);
    camera.lookAt(new THREE.Vector3(0, T.H * S, 0));
    const applyCam = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
    };

    // ---------- Table dimensions (official footprint, slightly taller surface) ----------
    const T = { L: 2.74, W: 1.525, H: 0.84, topT: 0.03, NET_H: 0.1525 };

    // Enlarge the entire playfield (table, paddles, ball) for a more dramatic presentation
    const S = 3 * 1.2;
    const tableG = new THREE.Group();
    tableG.scale.set(S, S, S);
    scene.add(tableG);

    const tableMat = new THREE.MeshStandardMaterial({
      color: tableSettings.color ?? 0x1e3a8a,
      roughness: tableSettings.roughness ?? 0.6,
      metalness: tableSettings.metalness ?? 0,
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: lineSettings.color ?? 0xffffff,
      roughness: lineSettings.roughness ?? 0.35,
      metalness: lineSettings.metalness ?? 0,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: metalSettings.color ?? 0x9aa4b2,
      roughness: metalSettings.roughness ?? 0.45,
      metalness: metalSettings.metalness ?? 0.6,
    });
    const wheelMat = new THREE.MeshStandardMaterial({
      color: wheelSettings.color ?? 0x111111,
      roughness: wheelSettings.roughness ?? 0.9,
      metalness: wheelSettings.metalness ?? 0,
    });
    const paddleWoodTex = makePaddleWoodTexture();
    paddleWoodTex.anisotropy = 8;
    applySRGBColorSpace(paddleWoodTex);
    const paddleWoodMat = new THREE.MeshPhysicalMaterial({
      map: paddleWoodTex,
      color: 0xffffff,
      roughness: 0.65,
      metalness: 0.05,
      clearcoat: 0.06,
      clearcoatRoughness: 0.5,
    });

    // Table top
    const top = new THREE.Mesh(new THREE.BoxGeometry(T.W, T.topT, T.L), tableMat);
    top.position.set(0, T.H - T.topT / 2, 0);
    top.castShadow = true;
    tableG.add(top);

    // Table border apron
    const apronDepth = 0.025;
    const apronGeo = new THREE.BoxGeometry(T.W + 0.04, apronDepth, 0.02);
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x10204d, roughness: 0.8 });
    const apronFront = new THREE.Mesh(apronGeo, apronMat);
    apronFront.position.set(0, T.H - T.topT - apronDepth / 2, T.L / 2 + 0.01);
    const apronBack = apronFront.clone(); apronBack.position.z = -T.L / 2 - 0.01;
    tableG.add(apronFront, apronBack);

    const sideApronGeo = new THREE.BoxGeometry(0.02, apronDepth, T.L + 0.04);
    const apronLeft = new THREE.Mesh(sideApronGeo, apronMat);
    apronLeft.position.set(-T.W / 2 - 0.01, T.H - T.topT - apronDepth / 2, 0);
    const apronRight = apronLeft.clone(); apronRight.position.x = T.W / 2 + 0.01;
    tableG.add(apronLeft, apronRight);

    // White lines
    const borderT = 0.018;
    const lineH = 0.0025;
    const lineY = T.H + lineH / 2;
    const mkLine = (w, h, d, x, y, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), whiteMat);
      mesh.position.set(x, y, z);
      tableG.add(mesh);
    };
    mkLine(borderT, lineH, T.L, -T.W / 2 + borderT / 2, lineY, 0);
    mkLine(borderT, lineH, T.L, T.W / 2 - borderT / 2, lineY, 0);
    mkLine(T.W, lineH, borderT, 0, lineY, T.L / 2 - borderT / 2);
    mkLine(T.W, lineH, borderT, 0, lineY, -T.L / 2 + borderT / 2);
    mkLine(borderT, lineH, T.L - borderT * 2, 0, lineY, 0);

    // Net & posts
    const netGroup = new THREE.Group();
    tableG.add(netGroup);
    const netAlpha = makeHexNetAlpha(512, 256, 9);
    const netWeave = makeWeaveTex(256, 256);
    const netMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      alphaMap: netAlpha,
      map: netWeave,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const postR = 0.012;
    const netWidth = T.W + postR * 1.2;
    const netPlane = new THREE.Mesh(new THREE.PlaneGeometry(netWidth, T.NET_H), netMat);
    netPlane.position.set(0, T.H + T.NET_H / 2, 0);
    netGroup.add(netPlane);

    const bandT = 0.014;
    const bandTop = new THREE.Mesh(new THREE.BoxGeometry(netWidth, bandT, 0.004), whiteMat);
    bandTop.position.set(0, T.H + T.NET_H - bandT / 2, 0);
    const bandBottom = bandTop.clone();
    bandBottom.position.set(0, T.H + bandT / 2, 0);
    netGroup.add(bandTop, bandBottom);

    const postH = T.NET_H + 0.08;
    const postGeo = new THREE.CylinderGeometry(postR, postR, postH, 28);
    const postRight = new THREE.Mesh(postGeo, steelMat);
    postRight.position.set(T.W / 2 + postR * 0.6, T.H + postH / 2, 0);
    const postLeft = postRight.clone();
    postLeft.position.x = -T.W / 2 - postR * 0.6;
    tableG.add(postRight, postLeft);

    const clampGeo = new THREE.BoxGeometry(0.06, 0.025, 0.05);
    const clampRight = new THREE.Mesh(clampGeo, steelMat);
    clampRight.position.set(T.W / 2 + 0.03, T.H + 0.03, 0);
    const clampLeft = clampRight.clone();
    clampLeft.position.x = -T.W / 2 - 0.03;
    tableG.add(clampRight, clampLeft);

    addTableLegs(tableG, T, steelMat, wheelMat);

    // arena floor & carpet (match Chess Battle Royal aesthetics)
    const floorSize = 30;
    const carpetSize = 24;
    const baseFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(floorSize, floorSize),
      new THREE.MeshStandardMaterial({
        color: floorSettings.color ?? 0x0f1222,
        roughness: floorSettings.roughness ?? 0.95,
        metalness: floorSettings.metalness ?? 0.05,
      })
    );
    baseFloor.rotation.x = -Math.PI / 2;
    baseFloor.position.y = 0;
    baseFloor.receiveShadow = true;
    scene.add(baseFloor);

    const carpetMat = createArenaCarpetMaterial();
    if (carpetSettings.color !== undefined) {
      carpetMat.color.setHex(carpetSettings.color);
    }
    if (carpetSettings.bumpScale !== undefined) {
      carpetMat.bumpScale = carpetSettings.bumpScale;
    }
    if (carpetSettings.emissive !== undefined) {
      carpetMat.emissive.setHex(carpetSettings.emissive);
    }
    if (carpetSettings.emissiveIntensity !== undefined) {
      carpetMat.emissiveIntensity = carpetSettings.emissiveIntensity;
    }
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(carpetSize, carpetSize), carpetMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.01;
    carpet.receiveShadow = true;
    scene.add(carpet);

    // Arena collision extents (local table space, compensate for scale)
    const arenaBounds = {
      halfX: floorSize * 0.5 / S - 0.3,
      halfZ: floorSize * 0.5 / S - 0.3,
      floorY: 0,
    };

    // walls (reuse Chess Battle Royal material)
    const wallMat = createArenaWallMaterial();
    if (wallSettings.color !== undefined) {
      wallMat.color.setHex(wallSettings.color);
    }
    if (wallSettings.roughness !== undefined) {
      wallMat.roughness = wallSettings.roughness;
    }
    if (wallSettings.metalness !== undefined) {
      wallMat.metalness = wallSettings.metalness;
    }
    const wallHeight = 6;
    const wallThickness = 0.2;
    const wallOffset = floorSize / 2;
    const wallGeoH = new THREE.BoxGeometry(floorSize, wallHeight, wallThickness);
    const wallGeoV = new THREE.BoxGeometry(wallThickness, wallHeight, floorSize);

    const wallBack = new THREE.Mesh(wallGeoH, wallMat);
    wallBack.position.set(0, wallHeight / 2, -wallOffset);
    scene.add(wallBack);

    const wallFront = new THREE.Mesh(wallGeoH, wallMat);
    wallFront.position.set(0, wallHeight / 2, wallOffset);
    scene.add(wallFront);

    const wallLeft = new THREE.Mesh(wallGeoV, wallMat);
    wallLeft.position.set(-wallOffset, wallHeight / 2, 0);
    scene.add(wallLeft);

    const wallRight = new THREE.Mesh(wallGeoV, wallMat);
    wallRight.position.set(wallOffset, wallHeight / 2, 0);
    scene.add(wallRight);

    // ---------- Rackets (paddles) ----------
    const PADDLE_SCALE = 1.18;
    const BALL_R = 0.02;
    const TABLE_TOP = T.H + BALL_R;
    const NET_TOP = TABLE_TOP + T.NET_H;
    const BASE_HEAD_RADIUS = 0.4049601584672928;
    const BASE_HEAD_CENTER_Y = 0.38700000643730165;
    const BASE_HEAD_CENTER_Z = 0.02005380392074585;

    const lerpAngle = (a, b, t) => {
      const delta = THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;
      return a + delta * t;
    };

    function buildCurvedPaddle(frontHex, backHex, woodMat){
      const bladeShape = new THREE.Shape();
      const bladeR = 0.45;
      const cutAngle = Math.PI / 7;
      const startAngle = -Math.PI / 2 + cutAngle;
      const endAngle = Math.PI + Math.PI / 2 - cutAngle;
      bladeShape.absarc(0, 0, bladeR, startAngle, endAngle, false);

      const HANDLE_DEPTH = 0.12;
      const BLADE_DEPTH_EACH = HANDLE_DEPTH * 0.5;
      const midY = 0.49;

      const frontMat = new THREE.MeshStandardMaterial({ color: frontHex, roughness: 0.4, metalness: 0.05 });
      const backMat = new THREE.MeshStandardMaterial({ color: backHex, roughness: 0.4, metalness: 0.05 });

      const frontGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: BLADE_DEPTH_EACH, bevelEnabled: false, curveSegments: 64 });
      frontGeo.rotateX(Math.PI / 2);
      frontGeo.translate(0, midY - BLADE_DEPTH_EACH, 0);
      const frontBlade = new THREE.Mesh(frontGeo, frontMat);

      const backGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: BLADE_DEPTH_EACH, bevelEnabled: false, curveSegments: 64 });
      backGeo.rotateX(Math.PI / 2);
      backGeo.translate(0, midY, 0);
      const backBlade = new THREE.Mesh(backGeo, backMat);

      const stemW = 0.14;
      const stemH = 0.45;
      const triOut = 0.14;
      const forkDepth = 0.09;

      const s = new THREE.Shape();
      s.moveTo(-(stemW / 2 + triOut), 0);
      s.quadraticCurveTo(0, 0.05, stemW / 2 + triOut, 0);
      s.bezierCurveTo(
        stemW / 2 + triOut * 0.8,
        -forkDepth * 0.25,
        stemW / 2 + triOut * 0.5,
        -forkDepth * 0.6,
        stemW / 2,
        -forkDepth
      );
      s.lineTo(stemW * 0.6, -stemH * 0.8);
      s.lineTo(-stemW * 0.6, -stemH * 0.8);
      s.lineTo(-stemW / 2, -forkDepth);
      s.bezierCurveTo(
        -(stemW / 2 + triOut * 0.5),
        -forkDepth * 0.6,
        -(stemW / 2 + triOut * 0.8),
        -forkDepth * 0.25,
        -(stemW / 2 + triOut),
        0
      );
      s.closePath();

      const handleGeo = new THREE.ExtrudeGeometry(s, {
        depth: HANDLE_DEPTH,
        bevelEnabled: true,
        bevelSize: 0.008,
        bevelThickness: 0.008,
        curveSegments: 64,
        steps: 1,
      });
      handleGeo.rotateX(Math.PI / 2);
      const handle = new THREE.Mesh(handleGeo, woodMat);

      const thetaA = startAngle;
      const thetaB = endAngle;
      const ax = bladeR * Math.cos(thetaA);
      const az = bladeR * Math.sin(thetaA);
      const bx = bladeR * Math.cos(thetaB);
      const bz = bladeR * Math.sin(thetaB);
      const mx = (ax + bx) * 0.5;
      const mz = (az + bz) * 0.5;
      const vx = bx - ax;
      const vz = bz - az;
      const alpha = Math.atan2(vz, vx);
      let nx = mx;
      let nz = mz;
      const nlen = Math.hypot(nx, nz) || 1;
      nx /= nlen;
      nz /= nlen;

      handle.position.set(mx + nx * 0.001, midY, mz + nz * 0.001);
      handle.rotation.y = alpha;
      handle.scale.z = -1;

      const group = new THREE.Group();
      group.add(frontBlade);
      group.add(backBlade);
      group.add(handle);
      group.scale.setScalar(0.9);
      return group;
    }

    function makePaddle(color, orientation = 1){
      const g = new THREE.Group();
      const headRadius = 0.092 * PADDLE_SCALE;
      const headYOffset = T.H + 0.072 * PADDLE_SCALE;

      const headAnchor = new THREE.Object3D();
      headAnchor.position.set(0, headYOffset, orientation === 1 ? -0.018 : 0.018);
      headAnchor.visible = false;
      g.add(headAnchor);

      const frontColor = new THREE.Color(color);
      const backColor = frontColor.clone();
      backColor.offsetHSL(-0.05, -0.18, -0.18);

      const visualWrapper = new THREE.Group();
      const fancyPaddle = buildCurvedPaddle(frontColor.getHex(), backColor.getHex(), paddleWoodMat);
      const uniformScale = headRadius / BASE_HEAD_RADIUS;
      fancyPaddle.scale.setScalar(uniformScale);
      fancyPaddle.position.set(
        0,
        headYOffset - BASE_HEAD_CENTER_Y * uniformScale,
        -BASE_HEAD_CENTER_Z * uniformScale
      );
      fancyPaddle.children.forEach(child => { child.castShadow = true; });

      const wrist = new THREE.Group();
      const baseTilt = THREE.MathUtils.degToRad(orientation === 1 ? -18 : -22);
      const baseRoll = THREE.MathUtils.degToRad(orientation === 1 ? 12 : -12);
      wrist.rotation.set(baseTilt, 0, baseRoll);
      wrist.add(fancyPaddle);
      visualWrapper.add(wrist);
      visualWrapper.rotation.y = orientation === 1 ? Math.PI : 0;
      g.add(visualWrapper);

      g.userData = {
        headRadius,
        headAnchor,
        visualWrapper,
        baseYaw: visualWrapper.rotation.y,
        orientationSign: orientation,
        wrist,
        baseTilt,
        baseRoll,
      };
      return g;
    }

    const player = makePaddle(paddleSettings.player ?? 0xff4d6d, 1); tableG.add(player);
    const opp    = makePaddle(paddleSettings.opponent ?? 0x49dcb1, -1); tableG.add(opp);
    const playerBaseZ = T.L/2 - 0.325;
    const oppBaseZ = -T.L/2 + 0.325;
    player.position.z =  playerBaseZ; player.position.x = 0;
    opp.position.z    = oppBaseZ; opp.position.x    = 0;

    // ---------- Ball ----------
    const ballMaterial = new THREE.MeshStandardMaterial({
      color: ballSettings.color ?? 0xfff1cc,
      roughness: ballSettings.roughness ?? 0.6,
      metalness: ballSettings.metalness ?? 0,
    });
    if (ballSettings.emissive !== undefined) {
      ballMaterial.emissive.setHex(ballSettings.emissive);
    }
    if (ballSettings.emissiveIntensity !== undefined) {
      ballMaterial.emissiveIntensity = ballSettings.emissiveIntensity;
    }
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 42, 32),
      ballMaterial
    );
    ball.castShadow = true;
    const ballGlow = new THREE.PointLight(
      ballSettings.glowColor ?? ballSettings.emissive ?? ballSettings.color ?? 0xffd7a1,
      ballSettings.glowIntensity ?? 0.85,
      ballSettings.glowDistance ?? 4.2
    );
    if (ballSettings.glowDecay !== undefined) {
      ballGlow.decay = ballSettings.glowDecay;
    }
    ball.add(ballGlow);
    tableG.add(ball);
    const ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(BALL_R * (ballSettings.shadowScale ?? 1.6), 24),
      new THREE.MeshBasicMaterial({
        color: ballSettings.shadowColor ?? 0x000000,
        transparent: true,
        opacity: ballSettings.shadowOpacity ?? 0.22,
      })
    );
    ballShadow.rotation.x = -Math.PI / 2;
    ballShadow.position.y = T.H + 0.005;
    tableG.add(ballShadow);

    const trailPositions = new Float32Array(TRAIL_COUNT * 3);
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trailMaterial = new THREE.LineBasicMaterial({
      color: trailSettings.color ?? 0xfff1cc,
      transparent: true,
      opacity: minTrailOpacity,
    });
    const ballTrail = new THREE.Line(trailGeometry, trailMaterial);
    ballTrail.frustumCulled = false;
    tableG.add(ballTrail);

    // ---------- Physics & Rules (ported) ----------
    const halfL = T.L / 2;
    const halfW = T.W / 2;
    const PADDLE_RADIUS = 0.085;
    const BALL_RADIUS = BALL_R;
    const WORLD_Y_FLOOR = -0.1;
    const FIXED_DT = 1 / 120;
    const MAX_ACCUM_DT = 0.2;

    const rules = rulesRef.current;
    rules.service.server = server;

    const ballState = { pos: new THREE.Vector3(0, T.H + 0.3, halfL * 0.35), vel: new THREE.Vector3(), omega: new THREE.Vector3() };
    const playerState = { pos: new THREE.Vector3(0, T.H + 0.13, halfL * 0.30) };
    const aiState = { pos: new THREE.Vector3(0, T.H + 0.13, -halfL * 0.40) };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(T.H + 0.12) * S);

    const swipe = { pos: playerState.pos.clone(), t: performance.now() };

    const trailBuf = [];
    const accRef = { value: 0 };
    const lastTime = { value: performance.now() };

    const syncHUD = () => {
      setScore({ ...rules.score });
      setServer(rules.service.server);
      setStage(rules.stage);
      if (rules.stage === 'GameOver') {
        setWinner(rules.score.player > rules.score.ai ? 'Player' : 'AI');
        setMessage(`${rules.score.player > rules.score.ai ? playerLabel : aiLabel} wins — tap reset`);
      } else if (rules.stage === 'ServeFlying') {
        setMessage(`${rules.service.server === 'Player' ? playerLabel : aiLabel} to serve`);
        setWinner(null);
      } else {
        setMessage('Swipe up to serve and hit');
        setWinner(null);
      }
    };

    const updateTrail = () => {
      for (let i = TRAIL_COUNT - 1; i > 0; i -= 1) {
        const src = (i - 1) * 3;
        const dst = i * 3;
        trailPositions[dst] = trailPositions[src];
        trailPositions[dst + 1] = trailPositions[src + 1];
        trailPositions[dst + 2] = trailPositions[src + 2];
      }
      trailPositions[0] = ballState.pos.x;
      trailPositions[1] = ballState.pos.y;
      trailPositions[2] = ballState.pos.z;
      trailGeometry.attributes.position.needsUpdate = true;
      const velocityMag = ballState.vel.length();
      trailMaterial.opacity = THREE.MathUtils.clamp(
        minTrailOpacity + velocityMag * trailSpeedFactor,
        minTrailOpacity,
        maxTrailOpacity,
      );
    };

    const applyAirDrag = (v, dt) => { v.multiplyScalar(1 / (1 + 0.15 * dt)); };
    const applyMagnus = (v, omega, dt) => { const c = omega.clone().cross(v).multiplyScalar(0.0007 * dt); v.add(c); };
    const reflectTable = (state) => {
      state.vel.y *= -0.90;
      state.vel.x *= 0.88;
      state.vel.z *= 0.88;
      state.omega.multiplyScalar(0.85);
    };
    const collideWithNet = (state) => {
      state.vel.z *= -0.35;
      state.vel.multiplyScalar(0.94);
      state.omega.multiplyScalar(0.9);
    };
    const boundsOut = (p) => {
      const outX = Math.abs(p.x) > halfW + 0.06;
      const outZ = Math.abs(p.z) > halfL + 0.06;
      const floor = p.y < WORLD_Y_FLOOR;
      return outX || outZ || floor;
    };

    const lastSideZ = (z) => (z > 0 ? 'Player' : 'AI');

    const onBounceAt = (pos) => {
      const side = lastSideZ(pos.z);
      if (rules.stage === 'ServeFlying') {
        if (rules.rally.lastSideBounce === null) {
          const must = rules.service.server;
          if (side !== must) { rules.awardPoint(must === 'Player' ? 'AI' : 'Player'); syncHUD(); return; }
        } else {
          const mustOpp = rules.service.server === 'Player' ? 'AI' : 'Player';
          if (side !== mustOpp) { rules.awardPoint(rules.service.server === 'Player' ? 'AI' : 'Player'); syncHUD(); return; }
          if (rules.contact.touchedNetThisFlight) rules.letServe = true;
        }
      }
      if (rules.rally.lastSideBounce === side) rules.rally.consecutiveBouncesOnSameSide += 1; else rules.rally.consecutiveBouncesOnSameSide = 1;
      rules.rally.lastSideBounce = side;
      if (rules.stage === 'Rally' && rules.rally.consecutiveBouncesOnSameSide >= 2) { rules.awardPoint(side === 'Player' ? 'AI' : 'Player'); syncHUD(); }
    };

    const resetForServe = (serverSide) => {
      rules.stage = 'ServeFlying';
      rules.resetRally();
      rules.service.server = serverSide;
      const z = serverSide === 'Player' ? halfL * 0.35 : -halfL * 0.35;
      ballState.pos.set(0, T.H + 0.32, z);
      ballState.vel.set(simpleRand(-0.4, 0.4), 2.2, serverSide === 'Player' ? -2.9 : 2.9);
      ballState.omega.set(0, 0, 0);
      setServer(serverSide);
      setStage(rules.stage);
      setWinner(null);
      setMessage(`${serverSide === 'Player' ? playerLabel : aiLabel} to serve`);
      updateTrail();
    };

    const performPaddleHits = () => {
      const entries = [ { grp: playerState, side: 'Player' }, { grp: aiState, side: 'AI' } ];
      for (const { grp, side } of entries) {
        const d = ballState.pos.clone().sub(grp.pos);
        if (d.length() >= PADDLE_RADIUS + BALL_RADIUS) continue;
        let swipeV = new THREE.Vector3();
        if (side === 'Player') {
          const now = performance.now();
          const dtMs = Math.max(1, now - (swipe.t || now));
          swipeV = grp.pos.clone().sub(swipe.pos).multiplyScalar(1000 / dtMs);
          swipe.pos.copy(grp.pos);
          swipe.t = now;
        } else {
          const deltaX = simpleClamp(ballState.pos.x - grp.pos.x, -1, 1);
          swipeV.set(deltaX, 0, 0);
        }
        const dir = d.normalize();
        const preset = SIMPLE_DIFFICULTY[difficulty] || SIMPLE_DIFFICULTY.Medium;
        const basePower = side === 'Player' ? 1.8 : 2.2 * preset.power;
        const impulse = dir.multiplyScalar(basePower).addScaledVector(swipeV, side === 'Player' ? 0.02 : 0.01);
        ballState.vel.add(impulse);
        const top = simpleClamp(swipeV.z, -6, 6) * (side === 'Player' ? 8 : 10) * (side === 'AI' ? preset.spin : 1);
        const sideSpin = simpleClamp(-swipeV.x, -6, 6) * 6 * (side === 'AI' ? preset.spin : 1);
        ballState.omega.add(new THREE.Vector3(0, sideSpin, top));
        rules.rally.lastHitter = side;
      }
    };

    const physicsStep = (dt) => {
      if (rules.stage === 'Warmup') { resetForServe(rules.service.server); return; }
      ballState.vel.y += -9.81 * dt;
      applyAirDrag(ballState.vel, dt);
      applyMagnus(ballState.vel, ballState.omega, dt);
      const nextPos = ballState.pos.clone().addScaledVector(ballState.vel, dt);
      const onTop = nextPos.y - BALL_RADIUS <= T.H && Math.abs(nextPos.x) <= halfW && Math.abs(nextPos.z) <= halfL && ballState.vel.y < 0;
      if (onTop) {
        nextPos.y = T.H + BALL_RADIUS;
        reflectTable(ballState);
        onBounceAt(nextPos);
        if (rules.stage === 'ServeFlying' && rules.rally.lastSideBounce !== null) {
          if (!rules.letServe) rules.stage = 'Rally';
          setStage(rules.stage);
        }
      }
      const nearZ = Math.abs(nextPos.z) <= 0.012 * 0.5 + BALL_RADIUS * 0.6;
      const low = nextPos.y <= T.H + T.NET_H + BALL_RADIUS * 0.3;
      if (nearZ && low) { collideWithNet(ballState); rules.contact.touchedNetThisFlight = true; }
      performPaddleHits();
      if (boundsOut(nextPos)) {
        const winnerSide = ballState.pos.z > 0 ? 'AI' : 'Player';
        rules.awardPoint(winnerSide);
        syncHUD();
        if (rules.stage !== 'GameOver') resetForServe(rules.service.server);
        return;
      }
      ballState.pos.copy(nextPos);
      if (trailSettings) {
        trailBuf.push(ballState.pos.clone());
        if (trailBuf.length > 40) trailBuf.shift();
      }
    };

    const aiStep = (dt) => {
      const preset = SIMPLE_DIFFICULTY[difficulty] || SIMPLE_DIFFICULTY.Medium;
      const s = Math.min(1, dt * preset.react);
      const targetX = simpleClamp(ballState.pos.x, -halfW + PADDLE_RADIUS, halfW - PADDLE_RADIUS);
      const targetZ = -halfL * 0.40;
      aiState.pos.x += (targetX - aiState.pos.x) * s;
      aiState.pos.z += (targetZ - aiState.pos.z) * s;
      const d = ballState.pos.clone().sub(aiState.pos).length();
      if (d < PADDLE_RADIUS + BALL_RADIUS + 0.02) {
        const plan = planAIReturn(ballState, difficulty);
        ballState.vel.add(plan.impulse);
        rules.rally.lastHitter = 'AI';
      }
    };

    const pointerToPlane = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(tablePlane, hit)) {
        return hit.multiplyScalar(1 / S);
      }
      return new THREE.Vector3(0, T.H + 0.12, halfL * 0.3);
    };

    const clampPaddlePos = (p) => {
      const x = simpleClamp(p.x, -halfW + PADDLE_RADIUS, halfW - PADDLE_RADIUS);
      const z = simpleClamp(p.z, 0.06, halfL - 0.06);
      return new THREE.Vector3(x, T.H + 0.13, z);
    };

    const onPointerDown = (e) => {
      swipe.pos.copy(playerState.pos);
      swipe.t = performance.now();
      const px = e.touches ? e.touches[0].clientX : e.clientX;
      const py = e.touches ? e.touches[0].clientY : e.clientY;
      const hit = clampPaddlePos(pointerToPlane(px, py));
      playerState.pos.copy(hit);
    };

    const onPointerMove = (e) => {
      const px = e.touches ? e.touches[0].clientX : e.clientX;
      const py = e.touches ? e.touches[0].clientY : e.clientY;
      const hit = clampPaddlePos(pointerToPlane(px, py));
      playerState.pos.copy(hit);
    };

    const onPointerUp = () => { swipe.pos.copy(playerState.pos); swipe.t = performance.now(); };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    const updateMeshes = () => {
      player.position.copy(playerState.pos);
      opp.position.copy(aiState.pos);
      ball.position.copy(ballState.pos);
      ballShadow.position.set(ballState.pos.x, T.H + 0.005, ballState.pos.z);
      const shadowScale = simpleClamp(1 - (ballState.pos.y - T.H) * 2.5, 0.2, 1.1);
      ballShadow.scale.setScalar(shadowScale * 1.6);
    };

    const frame = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime.value) / 1000, MAX_ACCUM_DT);
      lastTime.value = now;
      accRef.value = Math.min(accRef.value + dt, MAX_ACCUM_DT);
      while (accRef.value >= FIXED_DT) {
        physicsStep(FIXED_DT);
        aiStep(FIXED_DT);
        accRef.value -= FIXED_DT;
      }
      updateMeshes();
      updateTrail();
      renderer.render(scene, camera);
      raf.current = requestAnimationFrame(frame);
    };

    resetForServe(rules.service.server);
    frame();

    const onResize = () => { setSize(); applyCam(); };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      document.documentElement.style.overscrollBehavior = prevOver;
      try { host.removeChild(renderer.domElement); } catch {}
      paddleWoodTex.dispose();
      paddleWoodMat.dispose();
      trailGeometry.dispose();
      trailMaterial.dispose();
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiLabel, difficulty, playerLabel, resetKey]);
  const resetAll = () => {
    const nextServer = Math.random() < 0.5 ? 'Player' : 'AI';
    rulesRef.current = new Rules();
    rulesRef.current.service.server = nextServer;
    setScore({ player: 0, ai: 0 });
    setStage('Warmup');
    setServer(nextServer);
    setWinner(null);
    setMessage(`${nextServer === 'Player' ? playerLabel : aiLabel} to serve`);
    setResetKey(k => k + 1);
  };

  return (
    <div ref={hostRef} className="w-[100vw] h-[100dvh] bg-black relative overflow-hidden touch-none select-none">
      {/* HUD */}
      <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 text-white text-center min-w-[240px]">
        <div className="inline-flex flex-col gap-[2px] rounded-2xl px-4 py-3 bg-[rgba(7,10,18,0.7)] border border-[rgba(255,215,0,0.25)] shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="text-[9px] uppercase tracking-[0.26em] text-amber-200/80">{variant.badge} · Race to 11 · Win by 2</div>
          <div className="text-sm font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">{playerLabel} {score.player} : {score.ai} {aiLabel}</div>
          <div className="text-[10px] sm:text-[11px]">
            {stage === 'GameOver' ? `Winner: ${winner === 'Player' ? playerLabel : aiLabel}` : `Serve: ${server === 'Player' ? playerLabel : aiLabel}`}
          </div>
          <div className="text-[10px] sm:text-[11px] opacity-90">{message}</div>
          <div className="text-[9px] sm:text-[10px] opacity-70 leading-tight max-w-[260px]">{variant.tagline}</div>
        </div>
      </div>
      <div className="pointer-events-none absolute top-2 right-2 z-20 flex flex-col items-end gap-1">
        <div className="px-3 py-1 rounded-full border border-[rgba(255,215,0,0.25)] bg-[rgba(7,10,18,0.7)] text-white/80 text-[10px] uppercase tracking-[0.22em] shadow-lg">
          {variant.name}
        </div>
        <div className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-[10px] uppercase tracking-[0.16em] shadow">
          {broadcastProfile.badge} · {ballProfile.badge} · {touchProfile.badge}
        </div>
      </div>
      {stage !== 'GameOver' && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
          <button
            onClick={resetAll}
            className="text-white text-[11px] bg-[rgba(7,10,18,0.78)] border border-[rgba(255,215,0,0.25)] hover:bg-[rgba(12,18,30,0.92)] rounded-full px-3 py-1 shadow"
          >
            Reset
          </button>
        </div>
      )}
      {stage === 'GameOver' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-white text-sm sm:text-base font-semibold">{winner === 'Player' ? playerLabel : aiLabel} takes the game!</p>
          <button onClick={resetAll} className="text-white text-sm bg-rose-500/80 hover:bg-rose-500 rounded-full px-5 py-2 shadow-lg">Play Again</button>
        </div>
      )}
    </div>
  );
}

function addTableLegs(tableG, T, steelMat, wheelMat) {
  const tubeR = 0.02;
  const wheelRadius = 0.035;
  const wheelThickness = 0.02;
  const legClearance = 0.004;
  const legH = T.H - T.topT - legClearance - wheelRadius;
  const offsetZ = T.L * 0.36;
  const offsetX = T.W * 0.42;

  const makeFrame = (zSign) => {
    const g = new THREE.Group();
    const uprightGeo = new THREE.CylinderGeometry(tubeR, tubeR, legH, 26);
    const upLeft = new THREE.Mesh(uprightGeo, steelMat);
    const upRight = new THREE.Mesh(uprightGeo, steelMat);
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, offsetX * 2, 26), steelMat);
    upLeft.position.set(-offsetX, wheelRadius + legH / 2, zSign * offsetZ);
    upRight.position.set(offsetX, wheelRadius + legH / 2, zSign * offsetZ);
    cross.rotation.z = Math.PI / 2;
    cross.position.set(0, wheelRadius + 0.11, zSign * offsetZ);
    g.add(upLeft, upRight, cross);

    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 24);
    const wheelLeft = new THREE.Mesh(wheelGeo, wheelMat);
    const wheelRight = new THREE.Mesh(wheelGeo, wheelMat);
    wheelLeft.rotation.x = Math.PI / 2;
    wheelRight.rotation.x = Math.PI / 2;
    wheelLeft.position.set(-offsetX, wheelRadius, zSign * offsetZ);
    wheelRight.position.set(offsetX, wheelRadius, zSign * offsetZ);
    g.add(wheelLeft, wheelRight);
    return g;
  };

  tableG.add(makeFrame(-1), makeFrame(1));
}

function makePaddleWoodTexture(w = 1024, h = 2048) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#f4e9c8');
  gradient.addColorStop(1, '#e8d3a1');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = '#c9ad7a';
  for (let i = 0; i < 64; i++) {
    const y = (i + 2) * (h / 80);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const yy = y + Math.sin(x * 0.012 + i * 0.55) * 8;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = '#bfa371';
  for (let x = 0; x < w; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  return new THREE.CanvasTexture(canvas);
}

function makeHexNetAlpha(w, h, hexR) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  const dx = hexR * 1.732;
  const dy = hexR * 1.5;

  const drawHex = (cx, cy, r) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  };

  for (let y = 0; y < h + dy; y += dy) {
    for (let x = 0; x < w + dx; x += dx) {
      const offset = Math.floor(y / dy) % 2 ? dx / 2 : 0;
      drawHex(x + offset, y, hexR);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 2);
  tex.anisotropy = 8;
  return tex;
}

function makeWeaveTex(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f7f7f7';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
  for (let x = 0; x < w; x += 2) ctx.fillRect(x, 0, 1, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = 8;
  return tex;
}

