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
  const menuRef = useRef(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const [broadcastIndex, setBroadcastIndex] = useState(0);
  const [ballIndex, setBallIndex] = useState(0);
  const [controlIndex, setControlIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const variant = GAME_VARIANTS[variantIndex] || GAME_VARIANTS[0];
  const broadcastProfile = BROADCAST_PRESETS[broadcastIndex] || BROADCAST_PRESETS[0];
  const ballProfile = BALL_TECHNIQUES[ballIndex] || BALL_TECHNIQUES[0];
  const touchProfile = TOUCH_PRESETS[controlIndex] || TOUCH_PRESETS[0];

  const playerLabel = player?.name || 'You';
  const aiLabel = ai?.name || 'AI';
  const initialServer = useMemo(() => (Math.random() < 0.5 ? 'P' : 'O'), []);
  const createUiState = (serving = initialServer) => ({
    pScore: 0,
    oScore: 0,
    serving,
    msg: `${serving === 'P' ? playerLabel : aiLabel} to serve`,
    gameOver: false,
    winner: null,
  });

  const [ui, setUi] = useState(() => createUiState());
  const [resetKey, setResetKey] = useState(0);
  const uiRef = useRef(ui);
  useEffect(() => { uiRef.current = ui; }, [ui]);

  const applyConfiguration = ({ nextVariant = variantIndex, nextBroadcast = broadcastIndex, nextBall = ballIndex, nextControl = controlIndex, closeMenu = true } = {}) => {
    setVariantIndex(nextVariant);
    setBroadcastIndex(nextBroadcast);
    setBallIndex(nextBall);
    setControlIndex(nextControl);
    if (closeMenu) setMenuOpen(false);
    const nextServer = Math.random() < 0.5 ? 'P' : 'O';
    setUi(createUiState(nextServer));
    setResetKey(k => k + 1);
  };

  const handleVariantSelect = (index) => applyConfiguration({ nextVariant: index, closeMenu: false });
  const handleBroadcastSelect = (index) => applyConfiguration({ nextBroadcast: index, closeMenu: false });
  const handleBallSelect = (index) => applyConfiguration({ nextBall: index, closeMenu: false });
  const handleControlSelect = (index) => applyConfiguration({ nextControl: index, closeMenu: false });
  const confirmMenuSelection = () => applyConfiguration({ closeMenu: true });

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [menuOpen]);

  const difficulty = useMemo(() => {
    const tag = (ai?.difficulty || ai?.level || 'pro').toString().toLowerCase();
    const presets = {
      easy:   { speed: 3.1, vertical: 2.3, react: 0.055 },
      medium: { speed: 3.6, vertical: 2.7, react: 0.042 },
      normal: { speed: 3.6, vertical: 2.7, react: 0.042 },
      pro:    { speed: 4.1, vertical: 3.1, react: 0.028 },
      hard:   { speed: 4.1, vertical: 3.1, react: 0.028 },
      legend: { speed: 4.5, vertical: 3.4, react: 0.022 },
    };
    return presets[tag] || presets.pro;
  }, [ai?.difficulty, ai?.level]);

  useEffect(()=>{
    const host = hostRef.current; if (!host) return;
    const timers = [];

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
    const baseShadowFactor = (ballSettings.shadowOpacity ?? 0.22) / 0.22;

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
      followLerp: trackingSettings.followLerp ?? 0.2,
      rallyBlend: trackingSettings.rallyBlend ?? 0.55,
      yawDamping: trackingSettings.yawDamping ?? 0.18,
      distDamping: trackingSettings.distDamping ?? 0.1,
    };
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

    const playerTarget = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
    player.userData.target = playerTarget;

    const playerPrev = new THREE.Vector3().copy(player.position);
    const oppPrev = new THREE.Vector3().copy(opp.position);
    const playerVel = new THREE.Vector3();
    const oppVel = new THREE.Vector3();
    const prevBall = new THREE.Vector3();
    const headWorld = new THREE.Vector3();

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

    // ---------- Physics State ----------
    const Srv = { side: ui.serving };
    const Sx = {
      v: new THREE.Vector3(0, 0, 0),
      w: new THREE.Vector3(0, 0, 0),
      mass: 0.0027,
      paddleMass: 0.16,
      magnusCoeff: physicsSettings.magnusCoeff ?? 0.4,
      spinDecay: physicsSettings.spinDecay ?? 0.91,
      gravity: new THREE.Vector3(0, physicsSettings.gravity ?? -9.81, 0),
      drag: physicsSettings.drag ?? 0.48,
      tableRest: physicsSettings.tableRest ?? 0.84,
      tableFriction: physicsSettings.tableFriction ?? 0.2,
      paddleRest: physicsSettings.paddleRest ?? 1.04,
      paddleAim: physicsSettings.paddleAim ?? 0.62,
      paddleLift: physicsSettings.paddleLift ?? 0.18,
      netRest: physicsSettings.netRest ?? 0.36,
      forceScale: physicsSettings.forceScale ?? 0.86,
      spinTransfer: physicsSettings.spinTransfer ?? 0.34,
      state: 'serve',
      lastTouch: null,
      bounces: { P: 0, O: 0 },
      serveProgress: 'awaitServeHit',
      serveTimer: serveTimers.player,
      tmpN: new THREE.Vector3(),
      simPos: new THREE.Vector3(),
      simVel: new THREE.Vector3(),
      tmpV0: new THREE.Vector3(),
      tmpV1: new THREE.Vector3(),
    };
    let playerSwing = null;

    function resetServe(){
      Sx.v.set(0,0,0);
      Sx.w.set(0,0,0);
      Sx.state='serve';
      Sx.lastTouch=null;
      Sx.bounces.P = 0;
      Sx.bounces.O = 0;
      Sx.serveProgress = 'awaitServeHit';
      Sx.serveTimer = Srv.side === 'P' ? serveTimers.player : serveTimers.opponent;
      const side = Srv.side;
      if (side==='P'){
        ball.position.set(player.position.x, TABLE_TOP + 0.12, playerBaseZ - 0.09);
      } else {
        ball.position.set(opp.position.x, TABLE_TOP + 0.12, oppBaseZ + 0.09);
      }
      playerTarget.set(player.position.x, player.position.y, player.position.z);
      ballShadow.position.set(ball.position.x, T.H + 0.005, ball.position.z);
      ballShadow.scale.set(1, 1, 1);
      for (let i = 0; i < TRAIL_COUNT; i++){
        const idx = i * 3;
        trailPositions[idx] = ball.position.x;
        trailPositions[idx + 1] = ball.position.y;
        trailPositions[idx + 2] = ball.position.z;
      }
      trailGeometry.attributes.position.needsUpdate = true;
      trailMaterial.opacity = minTrailOpacity;
      setUi(prev => ({
        ...prev,
        msg: `${side === 'P' ? playerLabel : aiLabel} to serve`,
        gameOver: false,
        winner: null,
      }));
    }

    // ---------- Input: Swipe-to-hit (Battle Royal style) ----------
    const bounds = {
      x: T.W/2 - 0.06,
      zNear: playerBaseZ + 0.08,
      zFar: 0.06,
    };
    const swipeProfile = touchProfile.swipe ?? {};
    const trackingProfile = touchProfile.tracking ?? {};
    const targetLerpX = trackingProfile.targetLerp?.x ?? 0.5;
    const targetLerpZ = trackingProfile.targetLerp?.z ?? 0.4;
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    let usingTouch = false;
    let touching = false;
    let sx = 0;
    let sy = 0;
    let lx = 0;
    let ly = 0;
    let st = 0;
    const gesture = {
      mode: 'idle',
      startSpan: 0,
      startYaw: 0,
      startPitch: 0,
      startDist: camRig.dist,
      startHeight: camRig.height,
      startAngle: 0,
      startCenter: new THREE.Vector2(),
    };

    function clampX(x) { return THREE.MathUtils.clamp(x, -bounds.x, bounds.x); }
    function clampZ(z) { return THREE.MathUtils.clamp(z, bounds.zFar, bounds.zNear); }
    function screenToTable(clientX, clientY) {
      const rect = el.getBoundingClientRect();
      const nx = (clientX - rect.left) / rect.width;
      const nz = 1 - (clientY - rect.top) / rect.height;
      const x = clampX((nx - 0.5) * (bounds.x * 2));
      const z = clampZ(bounds.zFar + nz * (bounds.zNear - bounds.zFar));
      return { x, z, rect };
    }

    const MIN_SWIPE_SPEED = swipeProfile.minSpeed ?? 180;
    const MAX_SWIPE_SPEED = swipeProfile.maxSpeed ?? 1700;

    function swipeToShot(distX, distY, swipeTime, towardsEnemy = true, rect) {
      const swipeT = Math.max(swipeTime, 0.06);
      const swipeLength = Math.hypot(distX, distY);
      const speed = swipeLength / swipeT;
      const clampedSpeed = THREE.MathUtils.clamp(speed, MIN_SWIPE_SPEED, MAX_SWIPE_SPEED);
      const normalized = (clampedSpeed - MIN_SWIPE_SPEED) / (MAX_SWIPE_SPEED - MIN_SWIPE_SPEED);
      const forward = towardsEnemy ? -1 : 1;
      const lateralScale = swipeProfile.lateralScale ?? 1.65;
      const liftRange = swipeProfile.liftRange ?? [0.32, 1.08];
      const forwardRange = swipeProfile.forwardRange ?? [0.88, 1.52];
      const curveScale = swipeProfile.curveScale ?? 1;
      const chopScale = swipeProfile.chopScale ?? 1;
      const lateral = THREE.MathUtils.clamp(distX / (rect?.width || 1), -lateralScale, lateralScale) * forward;
      const lift = THREE.MathUtils.mapLinear(normalized, 0, 1, liftRange[0], liftRange[1]);
      const forwardPower = THREE.MathUtils.mapLinear(normalized, 0, 1, forwardRange[0], forwardRange[1]) * forward;
      const curve = THREE.MathUtils.clamp((distX / 28) * curveScale, -9, 9);
      const chop = THREE.MathUtils.clamp(((distY - Math.abs(distX) * 0.35) / 240) * chopScale, -0.6, 0.9);
      const topspin = THREE.MathUtils.lerp(12, 34, normalized + chop * 0.25);
      return {
        lateral,
        lift,
        forward: forwardPower,
        normalized,
        curve,
        swipeSpeed: clampedSpeed,
        chop,
        topspin,
      };
    }

    function shotToSwing(shot) {
      const dir = new THREE.Vector3(shot.lateral, shot.lift + shot.chop * 0.12, shot.forward);
      const speed = dir.length();
      const normal = dir.normalize();
      const sideCurve = shot.curve ?? 0;
      const topspin = shot.topspin ?? THREE.MathUtils.lerp(12, 30, shot.normalized);
      const curveAim = normal.clone();
      curveAim.x += THREE.MathUtils.clamp(sideCurve * 0.01, -0.32, 0.32);
      return {
        normal,
        speed,
        ttl: 0.34,
        extraSpin: new THREE.Vector3(sideCurve * 0.26, sideCurve * 0.72 - shot.chop * 6, topspin * Math.sign(shot.forward || -1)),
        friction: 0.2,
        restitution: 1.08,
        reach: BALL_R + 0.34,
        force: Math.min(1.15, shot.normalized * (1 + (shot.swipeSpeed || 0) / (MAX_SWIPE_SPEED * 6))),
        power: shot.normalized,
        aimDirection: curveAim.normalize(),
        liftBoost: shot.chop > 0 ? shot.chop * 0.3 : 0
      };
    }

    function onDown(e) {
      if (usingTouch && e.pointerType === 'touch') return;
      touching = true;
      const target = screenToTable(e.clientX, e.clientY);
      playerTarget.x = target.x;
      playerTarget.z = target.z;
      sx = lx = e.clientX;
      sy = ly = e.clientY;
      st = performance.now();
      player.userData.swing = -0.35;
      player.userData.swingLR = 0;
    }
    function onMove(e) {
      if (!touching) return;
      if (usingTouch && e.pointerType === 'touch') return;
      lx = e.clientX;
      ly = e.clientY;
      const target = screenToTable(e.clientX, e.clientY);
      playerTarget.x += (target.x - playerTarget.x) * targetLerpX;
      playerTarget.z += (target.z - playerTarget.z) * targetLerpZ;
    }
    function onUp(evt, { fromTouch = false } = {}) {
      if (!touching) return;
      if (!fromTouch && usingTouch && evt?.pointerType === 'touch') return;
      touching = false;
      const endX = evt?.clientX ?? lx;
      const endY = evt?.clientY ?? ly;
      const distX = endX - sx;
      const distY = sy - endY;
      if (distY < 24) return;
      const duration = Math.max((performance.now() - st) / 1000, 0.12);
      const onPlayerSide = ball.position.z > 0 && Math.abs(ball.position.z - (playerBaseZ - 0.2)) < 1.6;
      if (onPlayerSide && ball.position.y <= 2.2) {
        const shot = swipeToShot(distX, distY, duration, true, screenToTable(endX, endY).rect);
        playerSwing = shotToSwing(shot);
        player.userData.swing = 0.62 + 0.9 * (playerSwing.force || 0.5);
        player.userData.swingLR = THREE.MathUtils.clamp(playerSwing.normal.x * 2.2, -1, 1);
      }
    }

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);

    function startCameraGesture(touches){
      if (touches.length < 2) return;
      const a = touches[0];
      const b = touches[1];
      const dx = b.clientX - a.clientX;
      const dy = b.clientY - a.clientY;
      gesture.mode = 'camera';
      gesture.startSpan = Math.hypot(dx, dy) || 1;
      gesture.startYaw = camRig.yawUser;
      gesture.startPitch = camRig.pitchUser;
      gesture.startDist = camRig.dist;
      gesture.startHeight = camRig.height;
      gesture.startAngle = Math.atan2(dy, dx);
      gesture.startCenter.set((a.clientX + b.clientX) * 0.5, (a.clientY + b.clientY) * 0.5);
    }

    function onTouchStart(e) {
      usingTouch = true;
      if (e.touches.length === 1){
        gesture.mode = 'paddle';
        const t = e.touches[0];
        if (t) onDown({ clientX: t.clientX, clientY: t.clientY });
      } else if (e.touches.length >= 2){
        touching = false;
        gesture.mode = 'camera';
        startCameraGesture(e.touches);
      }
    }
    function onTouchMove(e) {
      if (gesture.mode === 'camera' && e.touches.length >= 2){
        const a = e.touches[0];
        const b = e.touches[1];
        const dx = b.clientX - a.clientX;
        const dy = b.clientY - a.clientY;
        const span = Math.hypot(dx, dy) || 1;
        const scale = THREE.MathUtils.clamp(span / gesture.startSpan, 0.65, 1.65);
        camRig.dist = THREE.MathUtils.clamp(gesture.startDist / scale, camRig.minDist, gesture.startDist + 1.2);
        camRig.height = THREE.MathUtils.clamp(gesture.startHeight / scale, camRig.minHeight, gesture.startHeight + 1.2);
        const angle = Math.atan2(dy, dx);
        camRig.yawUser = THREE.MathUtils.clamp(gesture.startYaw + (angle - gesture.startAngle) * 0.8, -0.72, 0.72);
        const cx = (a.clientX + b.clientX) * 0.5;
        const cy = (a.clientY + b.clientY) * 0.5;
        const deltaY = (cy - gesture.startCenter.y) / (el.getBoundingClientRect().height || 1);
        camRig.pitchUser = THREE.MathUtils.clamp(gesture.startPitch + deltaY * -0.9, -0.14, 0.24);
        return;
      }
      if (e.touches.length === 1){
        const t = e.touches[0];
        if (t) onMove({ clientX: t.clientX, clientY: t.clientY });
      }
    }
    function onTouchEnd(e) {
      if (gesture.mode === 'camera' && e.touches.length >= 1){
        startCameraGesture(e.touches);
        return;
      }
      const t = e.changedTouches[0];
      if (!t) {
        usingTouch = false;
        gesture.mode = 'idle';
        return;
      }
      if (gesture.mode === 'paddle'){
        onUp({ clientX: t.clientX, clientY: t.clientY, pointerType: 'touch' }, { fromTouch: true });
      }
      usingTouch = e.touches.length > 0;
      if (e.touches.length === 0){
        gesture.mode = 'idle';
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    const camPos = new THREE.Vector3();
    const camFollow = new THREE.Vector3(player.position.x, 0, player.position.z);
    const followTarget = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const focusVector = new THREE.Vector3();
    const backVec = new THREE.Vector3();
    function updateCamera(immediate = false, lockCenter = false){
      if (lockCenter){
        followTarget.set(0, 0, 0);
      } else {
        const lateral = THREE.MathUtils.clamp(player.position.x, -bounds.x, bounds.x);
        const depth = THREE.MathUtils.clamp(player.position.z, bounds.zFar, bounds.zNear);
        const rallyBlend = THREE.MathUtils.clamp(camRig.rallyBlend + Sx.v.length() * 0.14 + (Sx.state === 'rally' ? 0.18 : 0), 0, 0.9);
        focusVector.set(
          THREE.MathUtils.clamp(ball.position.x, -bounds.x, bounds.x),
          0,
          THREE.MathUtils.clamp(ball.position.z, bounds.zFar, bounds.zNear)
        );
        followTarget.set(
          THREE.MathUtils.lerp(lateral * 1.08, focusVector.x, rallyBlend),
          0,
          THREE.MathUtils.lerp(depth, focusVector.z, rallyBlend)
        );
      }

      if (immediate){
        camFollow.copy(followTarget);
        camRig.curDist = camRig.dist;
        camRig.curHeight = camRig.height;
      } else {
        camFollow.lerp(followTarget, camRig.followLerp);
      }

      const lateralInfluence = THREE.MathUtils.clamp(camFollow.x / (bounds.x * 1.12), -1, 1);
      const yawTarget = camRig.yawBase + camRig.yawUser + camRig.yawRange * lateralInfluence;
      if (immediate){
        camRig.curYaw = yawTarget;
      } else {
        camRig.curYaw += (yawTarget - camRig.curYaw) * camRig.yawDamping;
      }

      const heightBoost = Math.max(0, (ball.position.y - TABLE_TOP) * 0.22);
      const distTarget = THREE.MathUtils.clamp(
        camRig.dist - Math.abs(lateralInfluence) * 0.26 - heightBoost * 0.12,
        camRig.minDist,
        camRig.dist + 0.6
      );
      const heightTarget = THREE.MathUtils.clamp(
        camRig.height - Math.abs(lateralInfluence) * 0.08 + heightBoost * 0.28 + camRig.pitchUser * 0.9,
        camRig.minHeight,
        camRig.height + 0.9
      );
      if (immediate){
        camRig.curDist = distTarget;
        camRig.curHeight = heightTarget;
      } else {
        camRig.curDist += (distTarget - camRig.curDist) * camRig.distDamping;
        camRig.curHeight += (heightTarget - camRig.curHeight) * camRig.distDamping;
      }

      lookTarget.set(
        camFollow.x * S,
        (T.H - 0.04) * S,
        (camFollow.z - camRig.forwardBias) * S
      );

      backVec.set(Math.sin(camRig.curYaw), 0, Math.cos(camRig.curYaw)).multiplyScalar(camRig.curDist);
      camPos.copy(lookTarget).add(backVec);
      camPos.y = camRig.curHeight + ((camRig.pitch + camRig.pitchUser) * 5.1);

      camera.position.copy(camPos);
      camera.lookAt(lookTarget);
    }

    // ensure table fits view similar to Air Hockey
    const corners = [
      new THREE.Vector3(-T.W/2 * S, T.H * S, -T.L/2 * S),
      new THREE.Vector3(T.W/2 * S, T.H * S, -T.L/2 * S),
      new THREE.Vector3(-T.W/2 * S, T.H * S, T.L/2 * S),
      new THREE.Vector3(T.W/2 * S, T.H * S, T.L/2 * S)
    ];
    const toNDC = v => v.clone().project(camera);
    const ensureFit = () => {
      const savedFollow = camFollow.clone();
      for (let i = 0; i < 20; i++) {
        updateCamera(true, true);
        const over = corners.some(c => {
          const p = toNDC(c);
          return Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
        });
        if (!over) break;
        camRig.dist += 0.18;
        camRig.height += 0.06;
      }
      camRig.dist = Math.max(camRig.minDist, camRig.dist - 0.4);
      camRig.height = Math.max(camRig.minHeight, camRig.height - 0.18);
      camRig.curDist = camRig.dist;
      camRig.curHeight = camRig.height;
      camRig.curYaw = camRig.yawBase;
      camFollow.copy(savedFollow);
      updateCamera(true);
    };

    // ---------- AI ----------
    const aiSpeedBase = difficulty.speed * (aiSettings.speed ?? 1);
    const aiVerticalBase = difficulty.vertical * (aiSettings.vertical ?? 1);
    const aiReactBase = difficulty.react * (aiSettings.react ?? 1);
    const AI = {
      baseSpeed: aiSpeedBase,
      baseVertical: aiVerticalBase,
      baseReact: aiReactBase,
      speed: aiSpeedBase,
      vertical: aiVerticalBase,
      react: aiReactBase,
      targetX: 0,
      targetZ: oppBaseZ,
      timer: 0,
      prediction: null,
    };

    function solveShot(from, to, gravityY, flightTime){
      const t = Math.max(0.18, flightTime);
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const dy = to.y - from.y;
      const vx = dx / t;
      const vz = dz / t;
      const vy = (dy - 0.5 * gravityY * t * t) / t;
      return new THREE.Vector3(vx, vy, vz);
    }

    function ensureNetClear(from, velocity, gravityY, netTop, margin = BALL_R){
      const vz = velocity.z;
      const dzToNet = -from.z;
      if (Math.abs(vz) < 1e-5) return velocity;
      const tNet = dzToNet / vz;
      if (tNet <= 0) return velocity;
      const yNet = from.y + velocity.y * tNet + 0.5 * gravityY * tNet * tNet;
      const need = netTop + margin;
      if (yNet < need){
        velocity.y += (need - yNet) / Math.max(0.15, tNet);
      }
      return velocity;
    }

    function predictBallForSide(targetZ, direction){
      Sx.simPos.copy(ball.position);
      Sx.simVel.copy(Sx.v);
      let time = 0;
      const step = 1/240;
      for (let i = 0; i < 960; i++){
        time += step;
        Sx.simVel.addScaledVector(Sx.gravity, step);
        const simSpeed = Sx.simVel.length();
        if (simSpeed > 1e-4){
          const drag = 0.5 * Sx.drag * BALL_R * simSpeed * step;
          Sx.simVel.addScaledVector(Sx.simVel, -drag);
        }
        Sx.simPos.addScaledVector(Sx.simVel, step);

        if (Sx.simPos.y <= TABLE_TOP && Sx.simVel.y < 0){
          Sx.simPos.y = TABLE_TOP;
          Sx.simVel.y = -Sx.simVel.y * Sx.tableRest;
          const damp = 1 - Sx.tableFriction * 0.5;
          Sx.simVel.x *= damp;
          Sx.simVel.z *= damp;
        }

        if (Math.abs(Sx.simPos.z) < 0.01 && Sx.simPos.y < NET_TOP){
          Sx.simVel.z *= -Sx.netRest;
          Sx.simVel.x *= 0.94;
          Sx.simVel.y *= 0.7;
        }

        if ((direction > 0 && Sx.simPos.z >= targetZ) || (direction < 0 && Sx.simPos.z <= targetZ)){
          return { pos: Sx.simPos.clone(), vel: Sx.simVel.clone(), time };
        }

        if (Sx.simPos.y < 0.01) break;
      }
      return null;
    }

    function stepAI(dt){
      const scoreboard = uiRef.current;
      const diff = scoreboard.oScore - scoreboard.pScore;
      const pressure = THREE.MathUtils.clamp(diff / 6, -0.8, 0.8);
      const targetSpeed = AI.baseSpeed + pressure * 1.1;
      const targetVertical = AI.baseVertical + pressure * 0.7;
      const targetReact = AI.baseReact - pressure * 0.012;
      AI.speed += (targetSpeed - AI.speed) * 0.18;
      AI.vertical += (targetVertical - AI.vertical) * 0.18;
      AI.react += (targetReact - AI.react) * 0.22;
      AI.react = THREE.MathUtils.clamp(AI.react, 0.018, 0.08);

      AI.timer -= dt;
      const baseZ = oppBaseZ - 0.015;
      if (AI.timer <= 0){
        AI.timer = AI.react + (Sx.state === 'serve' ? 0.015 : 0);
        AI.prediction = null;
        const movingTowardAI = Sx.v.z < -0.02;
        if (movingTowardAI && (Sx.state === 'rally' || (Sx.state === 'serve' && Srv.side === 'P' && Sx.serveProgress !== 'awaitServeHit'))){
          AI.prediction = predictBallForSide(baseZ + 0.04, -1);
        }
        if (AI.prediction){
          const anticipation = THREE.MathUtils.clamp(1 - AI.prediction.time * 0.55, 0, 1);
          const safeX = THREE.MathUtils.clamp(
            AI.prediction.pos.x + AI.prediction.vel.x * 0.12,
            -T.W/2 + 0.07,
            T.W/2 - 0.07
          );
          const centerBlend = THREE.MathUtils.lerp(safeX, 0, 0.18 + (1 - anticipation) * 0.2);
          AI.targetX = THREE.MathUtils.clamp(
            centerBlend + (Math.random() - 0.5) * (0.09 + anticipation * 0.06),
            -bounds.x,
            bounds.x
          );
          const reach = THREE.MathUtils.clamp((AI.prediction.pos.y - TABLE_TOP) * 0.3, -0.16, 0.2);
          const rallyBias = anticipation * 0.05;
          AI.targetZ = THREE.MathUtils.clamp(baseZ + reach - rallyBias, baseZ - 0.24, baseZ + 0.22);
        } else {
          const calm = 0.12 + (Sx.state === 'serve' ? 0.18 : 0.08);
          AI.targetX = THREE.MathUtils.lerp(AI.targetX, 0, calm);
          AI.targetZ = THREE.MathUtils.lerp(AI.targetZ, baseZ - 0.05, calm * 0.8);
        }
      }

      opp.position.x += THREE.MathUtils.clamp(AI.targetX - opp.position.x, -AI.speed * dt, AI.speed * dt);
      opp.position.z += THREE.MathUtils.clamp(AI.targetZ - opp.position.z, -AI.vertical * dt, AI.vertical * dt);

      if (!AI.prediction && Sx.v.z > 0.06){
        opp.position.x = THREE.MathUtils.lerp(opp.position.x, 0, 0.16);
        opp.position.z = THREE.MathUtils.lerp(opp.position.z, baseZ - 0.04, 0.16);
      }
    }

    // ---------- Collisions ----------
    function bounceTable(prev){
      if (Sx.state === 'dead') return false;
      if (prev.y > TABLE_TOP && ball.position.y <= TABLE_TOP){
        const x = ball.position.x;
        const z = ball.position.z;
        const inBounds = Math.abs(x) <= T.W/2 + BALL_R && Math.abs(z) <= T.L/2 + BALL_R;
        if (!inBounds){
          const side = z >= 0 ? 'P' : 'O';
          pointTo(side === 'P' ? 'O' : 'P');
          return true;
        }

        const n = Sx.tmpN.set(0, 1, 0);
        const vDot = Sx.v.dot(n);
        Sx.v.addScaledVector(n, -(1 + Sx.tableRest) * vDot);
        const tangent = Sx.tmpV0.copy(Sx.v).addScaledVector(n, -Sx.v.dot(n));
        const tangentDamp = Math.max(0, 1 - Sx.tableFriction * 0.8);
        tangent.multiplyScalar(tangentDamp);
        Sx.v.addScaledVector(n, -Sx.v.dot(n)).add(tangent);
        const spinSlip = Sx.tmpV1.copy(Sx.w).cross(n).multiplyScalar(BALL_R * 0.12);
        Sx.v.add(spinSlip);
        Sx.w.multiplyScalar(0.72);
        ball.position.y = TABLE_TOP;

        const side = z >= 0 ? 'P' : 'O';
        const other = side === 'P' ? 'O' : 'P';
        Sx.bounces[side] = (Sx.bounces[side] || 0) + 1;

        if (Sx.state === 'serve'){
          if (Sx.serveProgress === 'awaitServerBounce'){
            if (side === Srv.side){
              Sx.serveProgress = 'awaitReceiverBounce';
            } else {
              pointTo(other);
              return true;
            }
          } else if (Sx.serveProgress === 'awaitReceiverBounce'){
            if (side !== Srv.side){
              Sx.state = 'rally';
              Sx.serveProgress = 'live';
              Sx.bounces[other] = 0;
            } else {
              pointTo(other);
              return true;
            }
          }
        } else if (Sx.state === 'rally'){
          if (Sx.lastTouch === side){
            pointTo(other);
            return true;
          } else {
            Sx.bounces[other] = 0;
          }
        }
      }
      return false;
    }

    function hitPaddle(paddle, who, paddleVel){
      if (Sx.state === 'dead') return false;
      if (Sx.state === 'serve' && who !== Srv.side && Sx.serveProgress !== 'live') return false;
      const { headAnchor, headRadius = (0.092 * PADDLE_SCALE) } = paddle.userData || {};
      if (!headAnchor) return false;
      headAnchor.getWorldPosition(headWorld);
      headWorld.divideScalar(S);
      const worldHeadX = headWorld.x;
      const worldHeadY = headWorld.y;
      const worldHeadZ = headWorld.z;
      const dx = ball.position.x - worldHeadX;
      const dy = ball.position.y - worldHeadY;
      const dz = ball.position.z - worldHeadZ;
      const detection = (headRadius + BALL_R) * 1.35;
      if ((dx * dx + dy * dy + dz * dz) < detection * detection){
        const attackSign = who === 'P' ? -1 : 1;
        const n = Sx.tmpN.set(dx, dy, dz);
        if (n.lengthSq() < 1e-6) n.set(0, 1, attackSign * 0.1);
        n.normalize();

        const contact = new THREE.Vector3(
          worldHeadX + n.x * (headRadius + BALL_R * 0.12),
          Math.max(worldHeadY + n.y * (headRadius + BALL_R * 0.12), T.H + BALL_R),
          worldHeadZ + n.z * (headRadius + BALL_R * 0.12)
        );
        ball.position.copy(contact);

        const relVel = Sx.tmpV0.copy(Sx.v);
        if (paddleVel) relVel.sub(paddleVel);
        const closing = relVel.dot(n);
        if (closing >= 0) return false;

        const invBall = 1 / Sx.mass;
        const invPaddle = 1 / Sx.paddleMass;
        const j = -(1 + Sx.paddleRest) * closing / (invBall + invPaddle);
        const impulse = Sx.tmpV1.copy(n).multiplyScalar(j * invBall);
        Sx.v.add(impulse);

        // frictional component to add tangential velocity and spin
        const tangent = relVel.addScaledVector(n, -closing);
        const tanMag = tangent.length();
        if (tanMag > 1e-5){
          tangent.multiplyScalar(1 / tanMag);
          const maxSlip = Math.abs(j) * 0.35;
          const slipImpulse = Math.min(maxSlip, tanMag);
          const tangentBoost = tangent.multiplyScalar(-slipImpulse * invBall);
          Sx.v.add(tangentBoost);
          const spinDir = Sx.tmpV0.copy(tangent).cross(n).normalize();
          Sx.w.addScaledVector(spinDir, slipImpulse * 18 * (Sx.spinTransfer ?? 1));
        }

        // encourage purposeful shots while preserving physical impulse
        const paddleActor = who === 'P' ? player : opp;
        const aimBias = THREE.MathUtils.clamp(
          paddleActor.position.x * Sx.paddleAim,
          -T.W / 2 + 0.12,
          T.W / 2 - 0.12
        );
        Sx.v.x = THREE.MathUtils.clamp(Sx.v.x + aimBias * 0.6, -4.2, 4.2);
        const liftBonus = (paddleVel?.y || 0) * 0.18;
        Sx.v.y = Math.max(Sx.v.y, Sx.paddleLift + Math.abs(closing) * 1.1 + liftBonus);
        const forward = Math.max(0.9, Math.abs(Sx.v.z));
        Sx.v.z = attackSign * THREE.MathUtils.clamp(forward, 0.9, 4.8);

        if (who === 'P' && playerSwing){
          const swing = playerSwing;
          const aim = swing.aimDirection?.clone() || swing.normal.clone();
          const power = THREE.MathUtils.clamp(swing.power ?? swing.force ?? 0.6, 0.15, 1.2);
          const speed = THREE.MathUtils.lerp(3.2, 6.6, power) * Sx.forceScale;
          Sx.v.copy(aim.multiplyScalar(speed));
          Sx.v.y = Math.max(Sx.v.y, 1.35 + (swing.liftBoost || 0));
          if (swing.extraSpin){
            Sx.w.addScaledVector(swing.extraSpin, 0.08 * (Sx.spinTransfer ?? 1));
          }
          playerSwing = null;
        }
        const brush = Sx.tmpV0.set(paddleVel?.x || 0, paddleVel?.y || 0, paddleVel?.z || 0).cross(n).multiplyScalar(Sx.spinTransfer * 6.5);
        Sx.w.add(brush);
        ensureNetClear(contact, Sx.v, Sx.gravity.y, NET_TOP, BALL_R * 0.9);

        if (Sx.state === 'serve' && who === Srv.side && Sx.serveProgress === 'awaitServeHit'){
          Sx.serveProgress = 'awaitServerBounce';
          Sx.lastTouch = who;
        } else {
          Sx.state = 'rally';
          Sx.lastTouch = who;
          Sx.bounces.P = 0;
          Sx.bounces.O = 0;
        }
        return true;
      }
      return false;
    }

    function hitNet(prev){
      const prevZ = prev.z;
      const currZ = ball.position.z;
      const crossed = (prevZ > 0 && currZ <= 0) || (prevZ < 0 && currZ >= 0);
      if (!crossed) return;
      const denom = currZ - prevZ || 1e-6;
      const t = THREE.MathUtils.clamp((0 - prevZ) / denom, 0, 1);
      const yAtNet = THREE.MathUtils.lerp(prev.y, ball.position.y, t);
      const xAtNet = THREE.MathUtils.lerp(prev.x, ball.position.x, t);
      if (Math.abs(xAtNet) <= T.W / 2 + BALL_R * 0.5 && yAtNet < NET_TOP + BALL_R * 0.35){
        const push = BALL_R * 0.6;
        const sign = prevZ > 0 ? 1 : -1;
        ball.position.z = sign * push;
        ball.position.x = THREE.MathUtils.lerp(prev.x, ball.position.x, t);
        ball.position.y = Math.max(yAtNet, TABLE_TOP);
        Sx.v.z *= -Sx.netRest;
        Sx.v.x *= 0.9;
        Sx.v.y *= 0.7;
      }
    }

    // ---------- Scoring & Rules ----------
    function pointTo(winner){
      if (Sx.state === 'dead') return;
      const state = uiRef.current;
      const newP = state.pScore + (winner === 'P' ? 1 : 0);
      const newO = state.oScore + (winner === 'O' ? 1 : 0);
      const total = newP + newO;
      const deuce = newP >= 10 && newO >= 10;
      const shouldSwap = deuce ? true : (total % 2 === 0);
      const currentServer = state.serving;
      const nextServing = shouldSwap ? (currentServer === 'P' ? 'O' : 'P') : currentServer;
      const gameOver = (newP >= 11 || newO >= 11) && Math.abs(newP - newO) >= 2;
      const leader = newP === newO ? null : (newP > newO ? 'P' : 'O');
      let statusMsg = 'Swipe up to serve and hit';
      if (gameOver){
        const winnerLabel = winner === 'P' ? playerLabel : aiLabel;
        statusMsg = `${winnerLabel} wins — Tap Reset`;
      } else if (deuce && Math.abs(newP - newO) === 1){
        const edgeLabel = leader === 'P' ? playerLabel : aiLabel;
        statusMsg = `${edgeLabel} has game point`;
      }

      setUi({
        pScore: newP,
        oScore: newO,
        serving: nextServing,
        msg: statusMsg,
        gameOver,
        winner: gameOver ? winner : null,
      });

      Sx.state = 'dead';
      Sx.v.set(0,0,0);
      Sx.w.set(0,0,0);
      Sx.lastTouch = null;
      Sx.bounces.P = 0;
      Sx.bounces.O = 0;
      Srv.side = nextServing;

      timers.forEach(clearTimeout);
      timers.length = 0;

      if (!gameOver){
        timers.push(setTimeout(()=>{
          if (uiRef.current.gameOver) return;
          resetServe();
        }, 520));
      }
    }

    function checkFaults(){
      if (Sx.state === 'dead') return true;
      const x = ball.position.x;
      const z = ball.position.z;
      const y = ball.position.y;
      if (y < TABLE_TOP - BALL_R * 0.6){
        if (Math.abs(x) > T.W/2 + BALL_R || Math.abs(z) > T.L/2 + BALL_R){
          const winner = (Sx.lastTouch === 'P') ? 'O' : 'P';
          pointTo(winner);
          return true;
        }
      }
      if (Math.abs(z) < BALL_R * 1.2 && y < TABLE_TOP + BALL_R * 0.1){
        const winner = (Sx.lastTouch === 'P') ? 'O' : 'P';
        pointTo(winner);
        return true;
      }
      if (Sx.state === 'serve' && Sx.serveProgress === 'awaitReceiverBounce'){
        const receiver = Srv.side === 'P' ? 'O' : 'P';
        const receiverSign = receiver === 'P' ? 1 : -1;
        if (z * receiverSign > T.L/2 + BALL_R){
          pointTo(receiver);
          return true;
        }
      }
      return false;
    }

    // ---------- Loop ----------
    const FIXED_STEP = 1 / 120;
    let accumulator = 0;
    let lastTime = performance.now();

    const adjustPaddleYaw = (paddle, velocity) => {
      const { visualWrapper, baseYaw, orientationSign = 1, wrist, baseTilt = 0, baseRoll = 0 } = paddle.userData || {};
      if (!visualWrapper || !Number.isFinite(baseYaw)) return;

      const dx = ball.position.x - paddle.position.x;
      const dz = ball.position.z - paddle.position.z;
      const forwardX = Math.sin(baseYaw);
      const forwardZ = Math.cos(baseYaw);
      const ahead = forwardX * dx + forwardZ * dz > 0.01;

      const rightX = forwardZ;
      const rightZ = -forwardX;
      const velLateral = velocity.x * rightX + velocity.z * rightZ;
      const cross = forwardX * dz - forwardZ * dx;

      const swingBackhand = Math.max(0, -velLateral * orientationSign);
      const swingForehand = Math.max(0, velLateral * orientationSign);
      const backhandAim = ahead ? Math.max(0, -cross * orientationSign) : 0;

      const offsetLeft = THREE.MathUtils.clamp(backhandAim * 0.7 + swingBackhand * 0.18, 0, 0.92);
      const offsetRight = Math.min(swingForehand * 0.12, 0.35);

      const leftRange = orientationSign === 1 ? 0.5 : 0.95;
      const rightRange = orientationSign === 1 ? 0.95 : 0.5;
      const targetYaw = THREE.MathUtils.clamp(
        baseYaw + orientationSign * offsetLeft - orientationSign * offsetRight,
        baseYaw - leftRange,
        baseYaw + rightRange
      );

      const damping = orientationSign === 1 ? 0.22 : 0.18;
      visualWrapper.rotation.y = lerpAngle(visualWrapper.rotation.y, targetYaw, damping);

      if (wrist){
        const heightFactor = THREE.MathUtils.clamp((ball.position.y - TABLE_TOP) * 0.85, -0.4, 0.52);
        const tiltTarget = baseTilt + heightFactor + (velocity.z || 0) * -0.02 * orientationSign;
        const rollTarget = baseRoll + (velocity.x || 0) * 0.04;
        wrist.rotation.x += (tiltTarget - wrist.rotation.x) * 0.22;
        wrist.rotation.z += (rollTarget - wrist.rotation.z) * 0.24;
      }
    };

    function integrate(dt){
      if (Sx.state === 'dead') return;
      prevBall.copy(ball.position);
      Sx.v.y += Sx.gravity.y * dt;
      const speed = Sx.v.length();
      if (speed > 1e-4){
        const drag = Sx.drag * speed * speed * dt * 0.14;
        Sx.v.addScaledVector(Sx.v, -drag / (1 + Sx.mass));
      }
      const magnus = Sx.tmpV1.copy(Sx.w).cross(Sx.v).multiplyScalar(Sx.magnusCoeff);
      Sx.v.addScaledVector(magnus, dt);
      const spinDamp = Math.pow(Sx.spinDecay, dt * 60);
      Sx.w.multiplyScalar(spinDamp);
      ball.position.addScaledVector(Sx.v, dt);

      const scored = bounceTable(prevBall);
      if (!scored){
        hitNet(prevBall);
        hitPaddle(player, 'P', playerVel);
        hitPaddle(opp, 'O', oppVel);
        checkFaults();
      }
    }

    function step(){
      const now = performance.now();
      const frameDt = Math.min(0.05, (now - lastTime) / 1000 || 0);
      lastTime = now;
      accumulator = Math.min(accumulator + frameDt, 0.25);

      // Camera follow
      updateCamera();

      // AI
      stepAI(frameDt);

      if (!ui.gameOver){
        tableG.updateMatrixWorld(true);
        if (player.userData?.target){
          const lerpFactor = 1 - Math.exp(-frameDt * 20);
          player.position.lerp(player.userData.target, lerpFactor);
          player.position.x = THREE.MathUtils.clamp(player.position.x, -bounds.x, bounds.x);
          player.position.z = THREE.MathUtils.clamp(player.position.z, bounds.zFar, bounds.zNear);
        }
        const invDt = frameDt > 0 ? 1 / frameDt : 0;
        playerVel.copy(player.position).sub(playerPrev).multiplyScalar(invDt);
        oppVel.copy(opp.position).sub(oppPrev).multiplyScalar(invDt);
        playerPrev.copy(player.position);
        oppPrev.copy(opp.position);

        adjustPaddleYaw(player, playerVel);
        adjustPaddleYaw(opp, oppVel);

        if (playerSwing){
          playerSwing.ttl -= frameDt;
          if (playerSwing.ttl <= 0) playerSwing = null;
        }

        if (Sx.state !== 'dead'){
          if (Sx.state === 'serve'){
            const server = Srv.side === 'P' ? player : opp;
            const serverVel = Srv.side === 'P' ? playerVel : oppVel;
            const targetZ = server.position.z + (Srv.side === 'P' ? -0.14 : 0.14);
            ball.position.x = THREE.MathUtils.lerp(ball.position.x, server.position.x, 0.25);
            ball.position.z = THREE.MathUtils.lerp(ball.position.z, targetZ, 0.22);
            Sx.serveTimer -= frameDt;
            if (Sx.serveProgress === 'awaitServeHit' && Sx.serveTimer <= 0){
              const dir = Srv.side === 'P' ? -1 : 1;
              const aimX = THREE.MathUtils.clamp((server.position.x + serverVel.x * 0.05) * 0.4, -0.78, 0.78);
              const serveScale = THREE.MathUtils.clamp(Sx.forceScale, 0.65, 1.15);
              Sx.v.set(aimX * serveScale * 1.1, Math.max(1.9, 2.9 * serveScale), 1.72 * dir * serveScale);
              Sx.w.set(0, 0, 0);
              Sx.serveProgress = 'awaitServerBounce';
              Sx.lastTouch = Srv.side;
            }
          }
        }
      }

      while (accumulator >= FIXED_STEP){
        integrate(FIXED_STEP);
        accumulator -= FIXED_STEP;
      }

      ballShadow.position.set(ball.position.x, T.H + 0.005, ball.position.z);
      const heightAbove = Math.max(0, ball.position.y - TABLE_TOP);
      const sh = THREE.MathUtils.clamp(1 - heightAbove * 3.8, 0.3, 1.05);
      ballShadow.scale.set(sh, sh, 1);
      const shadowOpacity = THREE.MathUtils.clamp(0.92 - heightAbove * 5.2, 0.24, 0.92);
      ballShadow.material.opacity = THREE.MathUtils.clamp(shadowOpacity * baseShadowFactor, 0, 1);
      for (let i = TRAIL_COUNT - 1; i > 0; i--){
        const src = (i - 1) * 3;
        const dst = i * 3;
        trailPositions[dst] = trailPositions[src];
        trailPositions[dst + 1] = trailPositions[src + 1];
        trailPositions[dst + 2] = trailPositions[src + 2];
      }
      trailPositions[0] = ball.position.x;
      trailPositions[1] = ball.position.y;
      trailPositions[2] = ball.position.z;
      trailGeometry.attributes.position.needsUpdate = true;
      const velocityMag = Sx.v.length();
      trailMaterial.opacity = THREE.MathUtils.clamp(
        minTrailOpacity + velocityMag * trailSpeedFactor,
        minTrailOpacity,
        maxTrailOpacity
      );

      renderer.render(scene, camera);
      raf.current = requestAnimationFrame(step);
    }

    ensureFit();
    resetServe();
    step();

    // ---------- Resize ----------
    const onResize = ()=>{ setSize(); applyCam(); ensureFit(); };
    window.addEventListener('resize', onResize);

    return ()=>{
      cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', onResize);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      timers.forEach(clearTimeout);
      document.documentElement.style.overscrollBehavior = prevOver;
      try{ host.removeChild(renderer.domElement); }catch{}
      paddleWoodTex.dispose();
      paddleWoodMat.dispose();
      trailGeometry.dispose();
      trailMaterial.dispose();
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiLabel, difficulty.react, difficulty.speed, difficulty.vertical, playerLabel, resetKey, variantIndex, broadcastIndex, ballIndex, controlIndex]);

  const resetAll = ()=>{
    const next = Math.random() < 0.5 ? 'P' : 'O';
    setUi(createUiState(next));
    setResetKey(k => k + 1);
  };

  return (
    <div ref={hostRef} className="w-[100vw] h-[100dvh] bg-black relative overflow-hidden touch-none select-none">
      {/* HUD */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-white text-[11px] sm:text-xs bg-white/10 backdrop-blur rounded px-3 py-2 flex flex-col items-center gap-[2px] text-center min-w-[220px]">
        <div className="text-[9px] uppercase tracking-[0.24em] text-white/70">{variant.badge}</div>
        <div className="font-semibold">{playerLabel} {ui.pScore} : {ui.oScore} {aiLabel}</div>
        <div className="text-[10px] sm:text-[11px]">
          {ui.gameOver ? `Winner: ${ui.winner === 'P' ? playerLabel : aiLabel}` : `Serve: ${ui.serving === 'P' ? playerLabel : aiLabel}`}
        </div>
        <div className="text-[10px] sm:text-[11px] opacity-80">{ui.msg}</div>
        <div className="text-[9px] sm:text-[10px] opacity-70 leading-tight max-w-[240px]">{variant.tagline}</div>
        <div className="flex flex-wrap items-center justify-center gap-1 pt-1">
          <span className="px-2 py-[2px] rounded-full bg-white/10 text-[9px] uppercase tracking-[0.2em] text-white/80">{broadcastProfile.badge}</span>
          <span className="px-2 py-[2px] rounded-full bg-white/10 text-[9px] uppercase tracking-[0.2em] text-white/80">{ballProfile.badge}</span>
          <span className="px-2 py-[2px] rounded-full bg-white/10 text-[9px] uppercase tracking-[0.2em] text-white/80">{touchProfile.badge}</span>
        </div>
      </div>
      <div ref={menuRef} className="absolute top-2 right-2 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-full border border-white/10 bg-black/40 text-white/70 text-[10px] uppercase tracking-[0.2em] backdrop-blur-sm shadow-sm">
            {variant.name}
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(prev => !prev)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shadow-lg border border-white/10"
            aria-label="Toggle game configuration menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 3.75L9.75 6a7.5 7.5 0 00-1.5.87L6 6.75l-1.5 2.6 1.74 1.26a7.5 7.5 0 000 1.74L4.5 13.35 6 15.94l2.25-.12c.45.34.94.63 1.5.87l.75 2.25h3l.75-2.25c.53-.24 1.03-.53 1.5-.87l2.25.12 1.5-2.59-1.74-1.26c.06-.57.06-1.16 0-1.74l1.74-1.26-1.5-2.6-2.25.12a7.5 7.5 0 00-1.5-.87l-.75-2.25h-3z"
              />
              <circle cx="12" cy="12" r="2.25" />
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div className="w-80 max-w-[82vw] bg-black/80 text-white rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl px-3 py-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.26em] text-white/70">Game Loadout</div>
              <button
                type="button"
                onClick={confirmMenuSelection}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/80 hover:bg-emerald-500 text-white text-[11px] shadow-lg"
                aria-label="Confirm presets"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Confirm
              </button>
            </div>
            <div className="space-y-2">
              <div className="text-[11px] text-white/70 uppercase tracking-[0.2em]">Broadcast techniques</div>
              {BROADCAST_PRESETS.map((option, idx) => {
                const active = idx === broadcastIndex;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleBroadcastSelect(idx)}
                    className={`text-left px-3 py-2 rounded-xl transition-all ${active ? 'bg-white/15 ring-1 ring-white/40' : 'hover:bg-white/10'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{option.name}</span>
                      {active && <span className="text-[10px] uppercase tracking-[0.26em] text-emerald-300">Live</span>}
                    </div>
                    <div className="text-[10px] text-white/70 leading-snug mt-[2px]">{option.description}</div>
                    <div className="text-[9px] text-white/50 uppercase tracking-[0.26em] mt-1">{option.badge}</div>
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <div className="text-[11px] text-white/70 uppercase tracking-[0.2em]">Ball logic labs</div>
              {BALL_TECHNIQUES.map((option, idx) => {
                const active = idx === ballIndex;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleBallSelect(idx)}
                    className={`text-left px-3 py-2 rounded-xl transition-all ${active ? 'bg-white/15 ring-1 ring-white/40' : 'hover:bg-white/10'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{option.name}</span>
                      {active && <span className="text-[10px] uppercase tracking-[0.26em] text-emerald-300">Live</span>}
                    </div>
                    <div className="text-[10px] text-white/70 leading-snug mt-[2px]">{option.description}</div>
                    <div className="text-[9px] text-white/50 uppercase tracking-[0.26em] mt-1">{option.badge}</div>
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <div className="text-[11px] text-white/70 uppercase tracking-[0.2em]">Touch control studio</div>
              {TOUCH_PRESETS.map((option, idx) => {
                const active = idx === controlIndex;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleControlSelect(idx)}
                    className={`text-left px-3 py-2 rounded-xl transition-all ${active ? 'bg-white/15 ring-1 ring-white/40' : 'hover:bg-white/10'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{option.name}</span>
                      {active && <span className="text-[10px] uppercase tracking-[0.26em] text-emerald-300">Live</span>}
                    </div>
                    <div className="text-[10px] text-white/70 leading-snug mt-[2px]">{option.description}</div>
                    <div className="text-[9px] text-white/50 uppercase tracking-[0.26em] mt-1">{option.badge}</div>
                  </button>
                );
              })}
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-white/70 uppercase tracking-[0.2em]">Visual style</div>
              {GAME_VARIANTS.map((option, idx) => {
                const active = idx === variantIndex;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleVariantSelect(idx)}
                    className={`text-left px-3 py-2 rounded-xl transition-all ${active ? 'bg-white/15 ring-1 ring-white/40' : 'hover:bg-white/10'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{option.name}</span>
                      {active && <span className="text-[10px] uppercase tracking-[0.26em] text-emerald-300">Live</span>}
                    </div>
                    <div className="text-[10px] text-white/70 leading-snug mt-[2px]">{option.tagline}</div>
                    <div className="text-[9px] text-white/50 uppercase tracking-[0.26em] mt-1">{option.badge}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {!ui.gameOver && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
          <button onClick={resetAll} className="text-white text-[11px] bg-white/10 hover:bg-white/20 rounded px-2 py-1">Reset</button>
        </div>
      )}
      {ui.gameOver && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-white text-sm sm:text-base font-semibold">{ui.winner === 'P' ? playerLabel : aiLabel} takes the game!</p>
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

