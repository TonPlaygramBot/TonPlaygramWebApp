
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { createArenaCarpetMaterial, createArenaWallMaterial } from "../utils/arenaDecor.js";
import { applySRGBColorSpace } from "../utils/colorSpace.js";

/**
 * TableTennis3D — next-gen portrait simulation
 * -------------------------------------------
 * This rewrite rebuilds the game loop, physics, AI, and input stack from the
 * ground up to mirror modern Android table-tennis titles. The architecture is
 * modular: camera, physics, input, AI, scoring, FX, and presentation are
 * isolated systems that communicate via small data objects and a shared event
 * bus. The logic below intentionally favors readability while providing
 * advanced mechanics: Magnus lift, spin transfer on glancing blows, collision
 * layering (table/net/floor/walls/paddles), AI with anticipation and tempo
 * modulation, broadcast-style camera rails, swipe-derived intent decoding, and
 * deterministic fixed-step physics (240Hz sim, 60Hz render).
 */

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
    id: "impact-reel",
    name: "Impact Reel",
    badge: "Punch-In",
    description: "Tighter framing with aggressive yaw swing for power rallies.",
    camera: { yawBase: 0.08, yawRange: 0.72, pitch: 0.32, height: 1.94, dist: 3.04, forwardBias: 0.02 },
    tracking: { followLerp: 0.26, rallyBlend: 0.6, yawDamping: 0.22, distDamping: 0.12 },
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
];

// ---------------------- Math + helpers ----------------------
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const lerp = (a, b, t) => a + (b - a) * t;
const easeExp = (t, k = 8) => 1 - Math.exp(-t * k);

const TABLE = { L: 2.74, W: 1.525, H: 0.84, topT: 0.03, NET_H: 0.1525 };
const BALL_R = 0.02;
const FIXED_DT = 1 / 240;

class EventBus {
  constructor(){ this.listeners = new Map(); }
  on(evt, fn){
    if (!this.listeners.has(evt)) this.listeners.set(evt, new Set());
    this.listeners.get(evt).add(fn);
    return () => this.off(evt, fn);
  }
  off(evt, fn){ const s = this.listeners.get(evt); if (s) s.delete(fn); }
  emit(evt, payload){ const s = this.listeners.get(evt); if (!s) return; s.forEach(fn => fn(payload)); }
}

// ---------------------- Audio Board ----------------------
class AudioBoard {
  constructor(){
    this.ctx = null;
    this.buffers = {};
  }
  ensure(){
    if (this.ctx) return this.ctx;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    this.ctx = new C();
    return this.ctx;
  }
  resume(){ const ctx = this.ensure(); if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {}); }
  makeHit(name, freq = 420, duration = 0.14, noisy = false){
    const ctx = this.ensure(); if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++){
      const t = i / ctx.sampleRate;
      const env = Math.pow(1 - t / duration, 3);
      const osc = noisy ? (Math.random() * 2 - 1) * 0.6 : Math.sin(2 * Math.PI * freq * t);
      data[i] = osc * env;
    }
    this.buffers[name] = buffer;
  }
  play(name, gain = 0.9, rate = 1){
    const ctx = this.ensure();
    const buffer = this.buffers[name];
    if (!ctx || !buffer) return;
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buffer; src.playbackRate.value = rate; g.gain.value = gain;
    src.connect(g).connect(ctx.destination); src.start();
  }
}

// ---------------------- Camera Rig ----------------------
class CameraRig {
  constructor(camera, settings){
    this.camera = camera;
    this.base = { ...settings };
    this.current = {
      dist: settings.dist ?? 3.5,
      height: settings.height ?? 2,
      yaw: settings.yawBase ?? 0,
    };
    this.target = new THREE.Vector3(0, TABLE.H + 0.15, 0.36);
    this.opts = settings;
  }
  setBounds(host){
    this.camera.aspect = host.clientWidth / host.clientHeight;
    this.camera.updateProjectionMatrix();
  }
  update(ball, rallyMix, dt){
    const forwardBias = this.opts.forwardBias ?? 0;
    const yawRange = this.opts.yawRange ?? 0.4;
    const yawBase = this.opts.yawBase ?? 0;
    const pitch = this.opts.pitch ?? 0.34;
    const followLerp = this.opts.followLerp ?? 0.2;
    const rallyBlend = this.opts.rallyBlend ?? 0.55;
    const yawDamping = this.opts.yawDamping ?? 0.18;
    const distDamping = this.opts.distDamping ?? 0.1;
    const minDist = this.opts.minDist ?? this.current.dist;
    const maxDist = this.opts.dist ?? this.current.dist;
    const minHeight = this.opts.minHeight ?? this.current.height;
    const maxHeight = this.opts.height ?? this.current.height;

    this.target.lerp(ball.position, followLerp);
    this.target.y = clamp(this.target.y, TABLE.H + 0.08, TABLE.H + 0.62);
    const rallyLerp = lerp(minDist, maxDist, rallyMix * rallyBlend + (1 - rallyBlend) * 0.3);
    const rallyHeight = lerp(minHeight, maxHeight, rallyMix * rallyBlend + (1 - rallyBlend) * 0.3);
    this.current.dist = lerp(this.current.dist, rallyLerp, easeExp(dt, distDamping * 12));
    this.current.height = lerp(this.current.height, rallyHeight, easeExp(dt, distDamping * 12));

    const desiredYaw = yawBase + clamp(ball.position.x * 0.25, -yawRange, yawRange);
    this.current.yaw = lerp(this.current.yaw, desiredYaw, easeExp(dt, yawDamping * 10));

    const cx = this.target.x + Math.sin(this.current.yaw) * this.current.dist;
    const cz = this.target.z + Math.cos(this.current.yaw) * this.current.dist + forwardBias;
    const cy = this.current.height;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.target.x, this.target.y - 0.04, this.target.z);
    this.camera.rotation.x -= pitch * 0.08;
  }
}

// ---------------------- Physics World ----------------------
class PhysicsWorld {
  constructor(settings, bus){
    this.bus = bus;
    this.gravity = new THREE.Vector3(0, settings.gravity ?? -9.81, 0);
    this.drag = settings.drag ?? 0.44;
    this.magnusCoeff = settings.magnusCoeff ?? 0.48;
    this.spinDecay = settings.spinDecay ?? 0.96;
    this.tableRest = settings.tableRest ?? 0.85;
    this.tableFriction = settings.tableFriction ?? 0.22;
    this.paddleRest = settings.paddleRest ?? 1.02;
    this.paddleAim = settings.paddleAim ?? 0.6;
    this.paddleLift = settings.paddleLift ?? 0.16;
    this.netRest = settings.netRest ?? 0.35;
    this.forceScale = settings.forceScale ?? 0.82;
    this.spinTransfer = settings.spinTransfer ?? 0.35;
    this.netDrag = settings.netDrag ?? 0.2;
    this.state = "serve";
    this.lastTouch = null;
    this.serveProgress = "awaitServeHit";
    this.bounces = { P: 0, O: 0 };
    this.serveTimer = settings.serveTimer ?? 0.45;
    this.ball = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.spin = new THREE.Vector3();
    this.tmpN = new THREE.Vector3();
    this.tmpT = new THREE.Vector3();
    this.prev = new THREE.Vector3();
    this.bounds = {
      halfW: TABLE.W / 2 + BALL_R,
      halfL: TABLE.L / 2 + BALL_R,
      netTop: TABLE.H + TABLE.NET_H,
    };
  }

  resetServe(side, anchor){
    this.state = "serve";
    this.serveProgress = "awaitServeHit";
    this.bounces.P = 0; this.bounces.O = 0;
    this.lastTouch = null;
    this.serveTimer = side === "P" ? anchor.playerTimer : anchor.aiTimer;
    this.vel.set(0, 0, 0);
    this.spin.set(0, 0, 0);
  }

  launchServe(side, paddle, aimX = 0, twist = 0){
    const dir = side === "P" ? -1 : 1;
    const serveScale = clamp(this.forceScale, 0.62, 0.98);
    const targetZ = paddle.position.z + dir * 0.14;
    const vz = 1.32 * dir * serveScale;
    const vy = Math.max(1.85, 2.42 * serveScale);
    this.vel.set(aimX * serveScale * 0.86, vy, vz);
    this.ensureNetClear(this.ball, this.vel, this.gravity.y, this.bounds.netTop + 0.06, BALL_R * 1.05);
    this.spin.set(0, twist, 0);
    this.serveProgress = "awaitServerBounce";
    this.lastTouch = side;
    this.ball.set(paddle.position.x, TABLE.H + 0.12, targetZ - dir * 0.05);
  }

  ensureNetClear(pos, velocity, gravityY, netTop, margin = BALL_R){
    const vz = velocity.z; const dz = -pos.z;
    if (Math.abs(vz) < 1e-5) return velocity;
    const tNet = dz / vz;
    if (tNet <= 0) return velocity;
    const yNet = pos.y + velocity.y * tNet + 0.5 * gravityY * tNet * tNet;
    const need = netTop + margin;
    if (yNet < need){
      velocity.y += (need - yNet) / Math.max(0.15, tNet);
      velocity.x *= 0.98;
    }
    return velocity;
  }

  resolveSurface(normal, restitution, friction, spinElasticity = 0.8){
    const contactVel = this.tmpT.copy(this.vel);
    const spinVel = this.tmpN.copy(this.spin).cross(normal).multiplyScalar(BALL_R);
    contactVel.add(spinVel);
    const approach = contactVel.dot(normal);
    if (approach >= 0) return false;
    const cor = clamp(restitution + clamp(-approach * 0.08, 0, 0.2), 0.72, 1.15);
    const impulseN = -(1 + cor) * approach;
    const tangent = contactVel.addScaledVector(normal, -approach);
    const tangMag = tangent.length();
    let frictionImpulse = 0;
    if (tangMag > 1e-6){
      frictionImpulse = Math.min(tangMag, friction * impulseN);
      tangent.multiplyScalar(frictionImpulse / tangMag);
    } else {
      tangent.set(0, 0, 0);
    }
    this.vel.addScaledVector(normal, impulseN).addScaledVector(tangent, -1);
    if (frictionImpulse > 0){
      const spinImpulse = this.tmpN.copy(normal).cross(tangent).multiplyScalar(1 / BALL_R);
      this.spin.add(spinImpulse);
    }
    const spinBrake = 1 - clamp(-approach * 0.045, 0, 0.28);
    this.spin.multiplyScalar(spinElasticity * spinBrake);
    return true;
  }

  bounceTable(prev, playBounce){
    if (prev.y > TABLE.H + TABLE.topT && this.ball.y <= TABLE.H + TABLE.topT){
      if (Math.abs(this.ball.x) > this.bounds.halfW || Math.abs(this.ball.z) > this.bounds.halfL){
        const side = this.ball.z >= 0 ? "P" : "O";
        this.bus.emit("fault", { winner: side === "P" ? "O" : "P", reason: "out" });
        return true;
      }
      const normal = this.tmpN.set(0, 1, 0);
      this.resolveSurface(normal, this.tableRest, this.tableFriction, 0.86);
      this.spin.crossVectors(this.spin, normal).multiplyScalar(0.02);
      this.vel.x *= 0.92; this.vel.z *= 0.92;
      this.ball.y = TABLE.H + TABLE.topT;
      playBounce();
      const side = this.ball.z >= 0 ? "P" : "O";
      this.bounces[side] += 1;
      if (this.state === "serve"){
        if (this.serveProgress === "awaitServerBounce"){
          if (side === this.lastTouch){ this.serveProgress = "awaitReceiverBounce"; }
          else this.bus.emit("fault", { winner: side, reason: "serve-error" });
        } else if (this.serveProgress === "awaitReceiverBounce"){
          if (side !== this.lastTouch){
            this.state = "rally"; this.serveProgress = "live"; this.bounces[side === "P" ? "O" : "P"] = 0;
          } else this.bus.emit("fault", { winner: side === "P" ? "O" : "P", reason: "double-serve" });
        }
      } else {
        const other = side === "P" ? "O" : "P";
        if (this.bounces[side] > 1) this.bus.emit("fault", { winner: other, reason: "double-bounce" });
      }
      return true;
    }
    return false;
  }

  collideNet(){
    if (Math.abs(this.ball.z) < 0.01 && this.ball.y < this.bounds.netTop){
      this.vel.z *= -this.netRest; this.vel.x *= 0.94; this.vel.y *= 0.7; this.spin.multiplyScalar(0.6);
      return true;
    }
    return false;
  }

  collideArena(){
    if (Math.abs(this.ball.x) > this.bounds.halfW){
      this.vel.x *= -0.5; this.ball.x = clamp(this.ball.x, -this.bounds.halfW, this.bounds.halfW);
      this.bus.emit("fault", { winner: this.ball.z > 0 ? "O" : "P", reason: "wide" });
      return true;
    }
    if (Math.abs(this.ball.z) > this.bounds.halfL + 0.22){
      this.bus.emit("fault", { winner: this.ball.z > 0 ? "O" : "P", reason: "long" });
      return true;
    }
    if (this.ball.y < 0.02){ this.vel.y *= -0.35; this.bus.emit("fault", { winner: this.ball.z > 0 ? "O" : "P", reason: "floor" }); }
    return false;
  }

  collidePaddle(paddle, side, paddleVel, playPaddle){
    const head = paddle.userData.headAnchor.getWorldPosition(new THREE.Vector3());
    const radius = paddle.userData.headRadius;
    const toBall = this.tmpN.subVectors(this.ball, head);
    const dist = toBall.length();
    const moveDir = paddleVel.length();
    if (dist < radius + BALL_R * 1.1){
      const normal = toBall.normalize();
      const approach = this.vel.dot(normal);
      const attack = clamp(moveDir * 0.35, 0, 1.8);
      const aim = paddle.userData.swingLR || 0;
      const lift = paddle.userData.swing || 0;
      const baseCor = this.paddleRest + attack * 0.18;
      this.vel.addScaledVector(normal, -approach).addScaledVector(normal, baseCor);
      this.vel.x += paddleVel.x * this.paddleAim;
      this.vel.z += paddleVel.z * this.paddleAim;
      this.vel.y += this.paddleLift * (lift + 0.4);
      this.vel.addScaledVector(normal, attack * 0.35);
      this.spin.addScaledVector(normal, aim * this.spinTransfer);
      playPaddle();
      this.lastTouch = side; this.bounces.P = 0; this.bounces.O = 0; this.state = "rally"; this.serveProgress = "live";
      this.ball.addScaledVector(normal, (radius + BALL_R - dist) * 1.05);
    }
  }

  integrate(dt, paddleHit, netHit, arenaHit){
    this.prev.copy(this.ball);
    this.vel.addScaledVector(this.gravity, dt);
    this.vel.multiplyScalar(1 / (1 + this.drag * dt));
    const magnus = this.tmpN.crossVectors(this.spin, this.vel);
    this.vel.addScaledVector(magnus, this.magnusCoeff * dt);
    this.spin.multiplyScalar(this.spinDecay);
    this.ball.addScaledVector(this.vel, dt);
    if (!this.bounceTable(this.prev, paddleHit)){
      this.collideNet() && netHit();
      this.collideArena() && arenaHit();
    }
  }
}

// ---------------------- AI Brain ----------------------
class AiBrain {
  constructor(settings, bounds){
    this.baseSpeed = settings.speed;
    this.baseVertical = settings.vertical;
    this.baseReact = settings.react;
    this.speed = this.baseSpeed; this.vertical = this.baseVertical; this.react = this.baseReact;
    this.timer = 0; this.prediction = null; this.target = new THREE.Vector3(0, 0, 0);
    this.bounds = bounds;
  }
  predict(world){
    const simPos = new THREE.Vector3().copy(world.ball);
    const simVel = new THREE.Vector3().copy(world.vel);
    const gravity = world.gravity.y;
    const step = FIXED_DT;
    for (let i = 0; i < 900; i++){
      simVel.y += gravity * step;
      const drag = 0.5 * world.drag * BALL_R * simVel.length() * step;
      simVel.addScaledVector(simVel, -drag);
      simPos.addScaledVector(simVel, step);
      if (simPos.y <= TABLE.H + TABLE.topT && simVel.y < 0){
        simPos.y = TABLE.H + TABLE.topT; simVel.y = -simVel.y * world.tableRest; simVel.x *= 0.9; simVel.z *= 0.9;
      }
      if (Math.abs(simPos.z) < 0.01 && simPos.y < TABLE.H + TABLE.NET_H){ simVel.z *= -world.netRest; simVel.y *= 0.6; }
      if (simPos.z < -TABLE.L / 2 + 0.34) return { pos: simPos.clone(), vel: simVel.clone(), time: i * step };
      if (simPos.y < 0) break;
    }
    return null;
  }
  step(dt, world, paddle){
    this.timer -= dt;
    if (this.timer <= 0){
      this.timer = this.react;
      if (world.vel.z < -0.05 && (world.state === "rally" || (world.state === "serve" && world.lastTouch === "P"))){
        this.prediction = this.predict(world);
      } else this.prediction = null;
    }
    const baseZ = -TABLE.L / 2 + 0.325;
    if (this.prediction){
      const anticipation = clamp(1 - this.prediction.time * 0.6, 0, 1);
      const safeX = clamp(this.prediction.pos.x + this.prediction.vel.x * 0.12, -this.bounds.x, this.bounds.x);
      const targetX = lerp(safeX, 0, 0.2 + (1 - anticipation) * 0.2);
      const reach = clamp((this.prediction.pos.y - TABLE.H) * 0.35, -0.12, 0.24);
      const targetZ = clamp(baseZ + reach - anticipation * 0.05, baseZ - 0.22, baseZ + 0.22);
      this.target.set(targetX, 0, targetZ);
      paddle.userData.swing = lerp(paddle.userData.swing || 0, anticipation * 0.9, 0.4);
      paddle.userData.swingLR = lerp(paddle.userData.swingLR || 0, Math.sign(targetX) * anticipation * 0.6, 0.3);
    } else {
      this.target.set(0, 0, baseZ - 0.04);
      paddle.userData.swing = lerp(paddle.userData.swing || 0, 0, 0.22);
      paddle.userData.swingLR = lerp(paddle.userData.swingLR || 0, 0, 0.22);
    }
  }
}

// ---------------------- Input Router ----------------------
class InputRouter {
  constructor(el, bounds, profile, onIntent){
    this.el = el; this.bounds = bounds; this.profile = profile; this.onIntent = onIntent;
    this.touching = false; this.usingTouch = false; this.swipeStart = { pos: new THREE.Vector3(), t: 0 };
    this.touchPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TABLE.H + 0.12));
    this.ray = new THREE.Raycaster();
  }
  activate(){
    this.el.style.touchAction = "none";
    this.onDown = (e)=>{ this.usingTouch = e.pointerType !== "mouse"; this.touching = true; this.sample(e, true); };
    this.onMove = (e)=>{ if (!this.touching) return; this.sample(e, false); };
    this.onUp = ()=>{ this.touching = false; };
    this.el.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
  }
  dispose(){
    this.el.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
  }
  project(clientX, clientY){
    const rect = this.el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.ray.setFromCamera({ x, y }, this.onIntent.camera);
    const pos = new THREE.Vector3();
    this.ray.ray.intersectPlane(this.touchPlane, pos);
    return pos;
  }
  sample(e, first){
    const now = performance.now();
    const pos = this.project(e.clientX, e.clientY);
    pos.x = clamp(pos.x, -this.bounds.x, this.bounds.x);
    pos.z = clamp(pos.z, this.bounds.zFar, this.bounds.zNear);
    if (first){ this.swipeStart = { pos, t: now }; this.onIntent({ type: "move", pos, usingTouch: this.usingTouch }); return; }
    const dt = Math.max(1, now - this.swipeStart.t);
    const dx = pos.x - this.swipeStart.pos.x;
    const dz = pos.z - this.swipeStart.pos.z;
    const speed = Math.min(this.profile.maxSpeed, Math.hypot(dx, dz) * 1000 / dt);
    const norm = clamp((speed - this.profile.minSpeed) / (this.profile.maxSpeed - this.profile.minSpeed), 0, 1);
    const lift = lerp(this.profile.liftRange[0], this.profile.liftRange[1], norm);
    const forward = lerp(this.profile.forwardRange[0], this.profile.forwardRange[1], norm);
    const lateral = dx * this.profile.lateralScale;
    const curve = clamp(lateral * this.profile.curveScale, -1.4, 1.4);
    const chop = clamp(-dz * this.profile.chopScale, -1.2, 1.4);
    this.onIntent({ type: "swipe", pos, intent: { lift, forward, curve, chop, norm } });
  }
}

// ---------------------- Component ----------------------
export default function TableTennis3D({ player, ai }){
  const hostRef = useRef(null);
  const raf = useRef(0);
  const variant = GAME_VARIANTS[0];
  const broadcastProfile = BROADCAST_PRESETS[0];
  const ballProfile = BALL_TECHNIQUES[0];
  const touchProfile = TOUCH_PRESETS[0];
  const [ui, setUi] = useState({ pScore: 0, oScore: 0, serving: Math.random() < 0.5 ? "P" : "O", msg: "", gameOver: false, winner: null });
  const uiRef = useRef(ui); useEffect(() => { uiRef.current = ui; }, [ui]);

  const difficulty = useMemo(() => {
    const tag = (ai?.difficulty || ai?.level || "pro").toString().toLowerCase();
    const presets = { easy: { speed: 3, vertical: 2.3, react: 0.055 }, medium: { speed: 3.5, vertical: 2.7, react: 0.042 }, pro: { speed: 4.1, vertical: 3.1, react: 0.028 } };
    return presets[tag] || presets.pro;
  }, [ai?.difficulty, ai?.level]);

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const timers = [];
    const bus = new EventBus();
    const audio = new AudioBoard();
    audio.makeHit("bounce", 360, 0.18, true);
    audio.makeHit("paddle", 920, 0.16, false);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = variant.renderer?.exposure ?? 1.85;
    renderer.setPixelRatio(Math.min(2.5, window.devicePixelRatio || 1));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = false;
    renderer.domElement.style.touchAction = "none";
    host.appendChild(renderer.domElement);

    // Scene + lighting
    const scene = new THREE.Scene(); scene.background = new THREE.Color(variant.scene?.background ?? 0x0b0e14);
    const hemi = new THREE.HemisphereLight(variant.lighting?.hemisphere?.sky ?? 0xffffff, variant.lighting?.hemisphere?.ground ?? 0x1b2233, variant.lighting?.hemisphere?.intensity ?? 0.95);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(variant.lighting?.sun?.color ?? 0xffffff, variant.lighting?.sun?.intensity ?? 0.95); sun.position.set(...(variant.lighting?.sun?.position ?? [-16, 28, 18])); scene.add(sun);
    const rim = new THREE.DirectionalLight(variant.lighting?.rim?.color ?? 0x99ccff, variant.lighting?.rim?.intensity ?? 0.35); rim.position.set(...(variant.lighting?.rim?.position ?? [20, 14, -12])); scene.add(rim);
    (variant.lighting?.spotlights || []).forEach(spec => { const s = new THREE.SpotLight(spec.color ?? 0xffffff, spec.intensity ?? 0.7); s.position.set(spec.position?.[0] ?? 0, spec.position?.[1] ?? 6, spec.position?.[2] ?? 0); s.angle = spec.angle ?? Math.PI / 5; s.penumbra = spec.penumbra ?? 0.3; scene.add(s); scene.add(s.target); });

    // Camera
    const camera = new THREE.PerspectiveCamera(60, host.clientWidth / host.clientHeight, 0.05, 500);
    const camRig = new CameraRig(camera, { ...variant.camera, ...(broadcastProfile.camera || {}), ...(broadcastProfile.tracking || {}) });
    scene.add(camera);

    // Arena meshes
    const arena = new THREE.Group();
    const tableG = buildTable(scene, variant);
    arena.add(tableG);
    scene.add(arena);

    // Paddles
    const paddleSettings = variant.materials?.paddles || {};
    const playerPaddle = makePaddle(paddleSettings.player ?? 0xff4d6d, 1); tableG.add(playerPaddle);
    const oppPaddle = makePaddle(paddleSettings.opponent ?? 0x49dcb1, -1); tableG.add(oppPaddle);
    const playerBaseZ = TABLE.L / 2 - 0.325; const oppBaseZ = -TABLE.L / 2 + 0.325;
    playerPaddle.position.set(0, 0, playerBaseZ); oppPaddle.position.set(0, 0, oppBaseZ);
    playerPaddle.userData.target = new THREE.Vector3(playerPaddle.position.x, playerPaddle.position.y, playerPaddle.position.z);

    // Ball
    const ballMat = new THREE.MeshStandardMaterial({ color: variant.ball?.color ?? 0xfff1cc, roughness: variant.ball?.roughness ?? 0.6, metalness: variant.ball?.metalness ?? 0 });
    if (variant.ball?.emissive !== undefined) ballMat.emissive.setHex(variant.ball.emissive);
    if (variant.ball?.emissiveIntensity !== undefined) ballMat.emissiveIntensity = variant.ball.emissiveIntensity;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 42, 32), ballMat);
    const ballGlow = new THREE.PointLight(variant.ball?.glowColor ?? variant.ball?.emissive ?? variant.ball?.color ?? 0xffd7a1, variant.ball?.glowIntensity ?? 0.85, variant.ball?.glowDistance ?? 4.2);
    ball.add(ballGlow); tableG.add(ball);
    const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(BALL_R * (variant.ball?.shadowScale ?? 1.6), 24), new THREE.MeshBasicMaterial({ color: variant.ball?.shadowColor ?? 0x000000, transparent: true, opacity: variant.ball?.shadowOpacity ?? 0.22 }));
    ballShadow.rotation.x = -Math.PI / 2; ballShadow.position.y = TABLE.H + 0.005; tableG.add(ballShadow);
    const trail = buildTrail(tableG, variant.trail);

    // Physics
    const physics = new PhysicsWorld({ gravity: -9.81, drag: variant.physics?.drag ?? 0.48, magnusCoeff: variant.physics?.magnusCoeff ?? 0.00065, spinDecay: variant.physics?.spinDecay ?? 0.98, tableRest: variant.physics?.tableRest ?? 0.84, tableFriction: variant.physics?.tableFriction ?? 0.22, paddleRest: variant.physics?.paddleRest ?? 1.02, paddleAim: variant.physics?.paddleAim ?? 0.58, paddleLift: variant.physics?.paddleLift ?? 0.18, netRest: variant.physics?.netRest ?? 0.37, netDrag: variant.physics?.netDrag ?? 0.18, forceScale: variant.physics?.forceScale ?? 0.82, spinTransfer: variant.physics?.spinTransfer ?? 0.34, serveTimer: (variant.physics?.serveTimers || {}).player ?? 0.45 }, bus);
    physics.ball = ball.position; physics.vel.set(0, 0, 0); physics.spin.set(0, 0, 0);

    const aiBrain = new AiBrain({ speed: difficulty.speed * (variant.ai?.speed ?? 1), vertical: difficulty.vertical * (variant.ai?.vertical ?? 1), react: difficulty.react * (variant.ai?.react ?? 1) }, { x: TABLE.W / 2 - 0.06, zNear: playerBaseZ + 0.08, zFar: 0.06 });

    // Input
    const bounds = { x: TABLE.W / 2 - 0.06, zNear: playerBaseZ + 0.08, zFar: 0.06 };
    const input = new InputRouter(renderer.domElement, bounds, touchProfile.swipe, ({ type, pos, intent, usingTouch, camera: cam }) => {
      if (type === "move"){ playerPaddle.userData.target.copy(pos); }
      if (type === "swipe" && physics.state !== "dead"){ handlePlayerSwing(intent, pos, usingTouch); }
    });
    input.onIntent = (payload) => {
      payload.camera = camera; // allow InputRouter to project using live camera
      if (payload.type === "move") playerPaddle.userData.target.copy(payload.pos);
      if (payload.type === "swipe" && physics.state !== "dead") handlePlayerSwing(payload.intent, payload.pos, payload.usingTouch);
    };
    input.activate();

    // HUD helpers
    const playerLabel = player?.name || "You"; const aiLabel = ai?.name || "AI";
    const updateMsg = (msg) => setUi(prev => ({ ...prev, msg }));

    const servingSide = { side: uiRef.current.serving };
    const serveAnchors = { playerTimer: variant.physics?.serveTimers?.player ?? 0.45, aiTimer: variant.physics?.serveTimers?.opponent ?? 0.6 };

    function resetRally(nextSide){ servingSide.side = nextSide || servingSide.side; physics.resetServe(servingSide.side, serveAnchors); positionServe(); updateMsg(`${servingSide.side === "P" ? playerLabel : aiLabel} to serve`); }
    function positionServe(){ if (servingSide.side === "P"){ ball.position.set(playerPaddle.position.x, TABLE.H + 0.12, playerBaseZ - 0.09); } else { ball.position.set(oppPaddle.position.x, TABLE.H + 0.12, oppBaseZ + 0.09); } ballShadow.position.set(ball.position.x, TABLE.H + 0.005, ball.position.z); trail.reset(ball.position); }

    // Paddle swing
    function handlePlayerSwing(intent, pos){
      playerPaddle.userData.swing = clamp(intent.forward * 0.6 + intent.lift * 0.4, -0.2, 1.6);
      playerPaddle.userData.swingLR = clamp(intent.curve * 0.8, -1.2, 1.2);
      if (physics.state === "serve" && servingSide.side === "P" && physics.serveProgress === "awaitServeHit"){ physics.launchServe("P", playerPaddle, intent.curve * 0.4, intent.curve * -2); }
      if (physics.state === "rally") physics.forceScale = lerp(physics.forceScale, ballProfile.physics?.forceScale ?? physics.forceScale, 0.1);
    }

    // AI serving
    function autoAiServe(){ if (physics.state === "serve" && servingSide.side === "O" && physics.serveProgress === "awaitServeHit"){ const aim = (Math.random() - 0.5) * 0.6; physics.launchServe("O", oppPaddle, aim, -aim * 2); } }

    // Events
    const pointTo = (winner) => {
      const loser = winner === "P" ? "O" : "P";
      setUi(prev => {
        const next = { ...prev };
        next[ winner === "P" ? "pScore" : "oScore" ] += 1;
        const total = next.pScore + next.oScore;
        if (next.pScore >= 11 && next.pScore - next.oScore >= 2) { next.gameOver = true; next.winner = "P"; }
        if (next.oScore >= 11 && next.oScore - next.pScore >= 2) { next.gameOver = true; next.winner = "O"; }
        if (next.gameOver){ next.msg = `Winner: ${next.winner === "P" ? playerLabel : aiLabel}`; physics.state = "dead"; }
        else {
          const swap = total % 2 === 1 ? servingSide.side : (servingSide.side === "P" ? "O" : "P");
          servingSide.side = swap; next.serving = swap; next.msg = `${swap === "P" ? playerLabel : aiLabel} to serve`;
          physics.resetServe(swap, serveAnchors); positionServe();
        }
        return next;
      });
    };

    bus.on("fault", ({ winner }) => { physics.state = "dead"; timers.push(setTimeout(() => pointTo(winner), 240)); });

    // Animation state
    let last = performance.now(); let accumulator = 0; let rallyMix = 0;
    const playerPrev = new THREE.Vector3().copy(playerPaddle.position);
    const oppPrev = new THREE.Vector3().copy(oppPaddle.position);
    const playerVel = new THREE.Vector3(); const oppVel = new THREE.Vector3();

    const updatePaddleYaw = (paddle, velocity) => {
      const yaw = Math.atan2(velocity.x, Math.abs(velocity.z) + 0.01);
      paddle.userData.visualWrapper.rotation.y = lerp(paddle.userData.visualWrapper.rotation.y, paddle.userData.baseYaw + yaw * 0.4, 0.22);
      const heightFactor = clamp((ball.position.y - TABLE.H) * 0.8, -0.3, 0.5);
      paddle.userData.wrist.rotation.x += (paddle.userData.baseTilt + heightFactor - paddle.userData.wrist.rotation.x) * 0.25;
      paddle.userData.wrist.rotation.z += (paddle.userData.baseRoll + velocity.x * 0.04 - paddle.userData.wrist.rotation.z) * 0.25;
    };

    function tick(){
      const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now; accumulator = Math.min(accumulator + dt, 0.25);

      // Camera follow
      rallyMix = clamp(Math.abs(physics.vel.z) * 0.4, 0, 1);
      camRig.update(ball, rallyMix, dt);

      // AI logic
      aiBrain.step(dt, physics, oppPaddle);

      // Paddle targets
      const lerpFactor = 1 - Math.exp(-dt * 20);
      playerPaddle.position.lerp(playerPaddle.userData.target, lerpFactor);
      playerPaddle.position.x = clamp(playerPaddle.position.x, -bounds.x, bounds.x);
      playerPaddle.position.z = clamp(playerPaddle.position.z, bounds.zFar, bounds.zNear);
      oppPaddle.position.x += clamp(aiBrain.target.x - oppPaddle.position.x, -aiBrain.speed * dt, aiBrain.speed * dt);
      oppPaddle.position.z += clamp(aiBrain.target.z - oppPaddle.position.z, -aiBrain.vertical * dt, aiBrain.vertical * dt);

      // Velocities
      const invDt = dt > 0 ? 1 / dt : 0;
      playerVel.copy(playerPaddle.position).sub(playerPrev).multiplyScalar(invDt);
      oppVel.copy(oppPaddle.position).sub(oppPrev).multiplyScalar(invDt);
      playerPrev.copy(playerPaddle.position); oppPrev.copy(oppPaddle.position);

      updatePaddleYaw(playerPaddle, playerVel);
      updatePaddleYaw(oppPaddle, oppVel);

      if (physics.state === "serve" && physics.serveProgress === "awaitServeHit" && servingSide.side === "O") physics.serveTimer -= dt;
      if (physics.state === "serve" && physics.serveProgress === "awaitServeHit" && servingSide.side === "O" && physics.serveTimer <= 0){ autoAiServe(); }

      while (accumulator >= FIXED_DT){
        physics.integrate(FIXED_DT, () => audio.play("bounce", 0.65, clamp(0.9 + Math.abs(physics.vel.z) * 0.18, 0.86, 1.25)), () => audio.play("bounce", 0.6, 0.9), () => audio.play("bounce", 0.5, 0.8));
        physics.collidePaddle(playerPaddle, "P", playerVel, () => audio.play("paddle", 0.9, 1.05));
        physics.collidePaddle(oppPaddle, "O", oppVel, () => audio.play("paddle", 0.9, 1.05));
        accumulator -= FIXED_DT;
      }

      // Shadow + trail
      ballShadow.position.set(ball.position.x, TABLE.H + 0.005, ball.position.z);
      const height = Math.max(0, ball.position.y - TABLE.H); const sh = clamp(1 - height * 3.8, 0.3, 1.05);
      ballShadow.scale.set(sh, sh, 1); ballShadow.material.opacity = clamp((0.92 - height * 5.2) * (variant.ball?.shadowOpacity ?? 0.22) / 0.22, 0, 1);
      trail.push(ball.position, physics.vel.length());

      renderer.render(scene, camera);
      raf.current = requestAnimationFrame(tick);
    }

    resetRally(uiRef.current.serving);
    tick();

    const onResize = () => { renderer.setSize(host.clientWidth, host.clientHeight); camRig.setBounds(host); };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", onResize);
      input.dispose(); timers.forEach(clearTimeout);
      try { host.removeChild(renderer.domElement); } catch {}
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty.react, difficulty.speed, difficulty.vertical]);

  const resetAll = () => { setUi({ pScore: 0, oScore: 0, serving: Math.random() < 0.5 ? "P" : "O", msg: "", gameOver: false, winner: null }); };

  const renderAvatarBadge = (avatarSrc, label, align = "left") => {
    const isImage = avatarSrc?.startsWith("http") || avatarSrc?.startsWith("/") || avatarSrc?.startsWith("data:");
    const roleLabel = align === "right" ? "Opponent" : "Player";
    return (
      <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
        <div className="h-11 w-11 rounded-full border border-white/30 overflow-hidden bg-white/10 flex items-center justify-center text-lg">
          {isImage ? (
            <img src={avatarSrc} alt={`${label} avatar`} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl leading-none">{avatarSrc || "🙂"}</span>
          )}
        </div>
        <div className="leading-tight">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/80">{roleLabel}</div>
          <div className="text-sm font-semibold">{label}</div>
        </div>
      </div>
    );
  };

  const playerLabel = player?.name || "You"; const aiLabel = ai?.name || "AI";

  return (
    <div ref={hostRef} className="w-[100vw] h-[100dvh] bg-black relative overflow-hidden touch-none select-none">
      <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 text-white min-w-[260px]">
        <div className="inline-flex flex-col gap-2 rounded-2xl px-4 py-3 bg-[rgba(7,10,18,0.78)] border border-[rgba(255,215,0,0.25)] shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex items-center gap-4 justify-between">
            {renderAvatarBadge(player?.avatar, playerLabel, "left")}
            <div className="text-center min-w-[96px]">
              <div className="text-[10px] uppercase tracking-[0.22em] text-amber-100/80">Race to 11</div>
              <div className="text-2xl font-bold drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">{ui.pScore} : {ui.oScore}</div>
              <div className="text-[11px] text-white/80">
                {ui.gameOver ? `Winner: ${ui.winner === "P" ? playerLabel : aiLabel}` : `Serve: ${ui.serving === "P" ? playerLabel : aiLabel}`}
              </div>
            </div>
            {renderAvatarBadge(ai?.avatar, aiLabel, "right")}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 text-white">
        <div className="px-3 py-1 rounded-full bg-black/50 border border-white/10 text-[11px] sm:text-[12px] shadow-lg">{ui.msg || "Swipe to rally"}</div>
      </div>
      {!ui.gameOver && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
          <button onClick={resetAll} className="text-white text-[11px] bg-[rgba(7,10,18,0.78)] border border-[rgba(255,215,0,0.25)] hover:bg-[rgba(12,18,30,0.92)] rounded-full px-3 py-1 shadow">Reset</button>
        </div>
      )}
      {ui.gameOver && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <div className="text-2xl font-bold">{ui.winner === "P" ? "You win!" : "Opponent wins"}</div>
          <div className="text-sm text-white/80">Tap reset to play again.</div>
          <button onClick={resetAll} className="text-white text-sm bg-[rgba(7,10,18,0.9)] border border-[rgba(255,215,0,0.25)] rounded-full px-4 py-2 shadow">Reset Match</button>
        </div>
      )}
    </div>
  );
}

// ---------------------- Mesh builders ----------------------
function buildTable(scene, variant){
  const tableG = new THREE.Group();
  const mats = variant.materials || {};
  const carpet = createArenaCarpetMaterial({ color: mats.table?.color ?? 0x1e3a8a, emissive: variant.carpet?.emissive ?? 0x2d020a, emissiveIntensity: variant.carpet?.emissiveIntensity ?? 0.18, bumpScale: variant.carpet?.bumpScale ?? 0.24 });
  applySRGBColorSpace(carpet);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4.6, 64), carpet); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; tableG.add(floor);

  const floorMat = new THREE.MeshStandardMaterial({ color: variant.floor?.color ?? 0x0f1222, roughness: 0.8 });
  const floorPlane = new THREE.Mesh(new THREE.CircleGeometry(6.4, 72), floorMat); floorPlane.rotation.x = -Math.PI / 2; floorPlane.position.y = -0.001; floorPlane.receiveShadow = true; tableG.add(floorPlane);

  const wallMat = createArenaWallMaterial({ color: variant.walls?.color ?? 0xeeeeee }); applySRGBColorSpace(wallMat);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 6.8, 2.4, 72, 1, true), wallMat); wall.position.y = 1.2; tableG.add(wall);

  const tableMat = new THREE.MeshStandardMaterial({ color: mats.table?.color ?? 0x1e3a8a, roughness: mats.table?.roughness ?? 0.6, metalness: mats.table?.metalness ?? 0 }); applySRGBColorSpace(tableMat);
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(TABLE.W, TABLE.topT, TABLE.L), tableMat); tableTop.position.y = TABLE.H + TABLE.topT / 2; tableG.add(tableTop);

  const lineMat = new THREE.MeshStandardMaterial({ color: mats.lines?.color ?? 0xffffff, roughness: mats.lines?.roughness ?? 0.35 }); applySRGBColorSpace(lineMat);
  const makeStripe = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, TABLE.topT + 0.001, d), lineMat); m.position.set(x, TABLE.H + TABLE.topT + 0.0005, z); tableG.add(m); };
  makeStripe(TABLE.W, 0.02, 0, 0); makeStripe(0.02, TABLE.L, 0, 0);

  const netTex = makeHexNetAlpha(512, 256, 8);
  const netMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, map: netTex });
  const net = new THREE.Mesh(new THREE.BoxGeometry(TABLE.W + 0.1, TABLE.NET_H, 0.015), netMat); net.position.set(0, TABLE.H + TABLE.NET_H / 2, 0); tableG.add(net);

  tableG.add(makeFrame(-1, mats), makeFrame(1, mats));
  scene.add(tableG);
  return tableG;
}

function makeFrame(zSign = 1, mats = {}){
  const g = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: mats.metal?.color ?? 0x9aa4b2, roughness: mats.metal?.roughness ?? 0.45, metalness: mats.metal?.metalness ?? 0.6 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: mats.wheel?.color ?? 0x111111, roughness: mats.wheel?.roughness ?? 0.9 });
  const legH = 0.7; const tubeR = 0.02; const wheelR = 0.06; const wheelT = 0.03; const offsetX = TABLE.W / 2 - 0.08; const offsetZ = TABLE.L / 2 - 0.08;
  const upright = new THREE.CylinderGeometry(tubeR, tubeR, legH, 26);
  const upLeft = new THREE.Mesh(upright, steelMat); const upRight = new THREE.Mesh(upright, steelMat);
  upLeft.position.set(-offsetX, wheelR + legH / 2, zSign * offsetZ); upRight.position.set(offsetX, wheelR + legH / 2, zSign * offsetZ);
  const cross = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, offsetX * 2, 26), steelMat); cross.rotation.z = Math.PI / 2; cross.position.set(0, wheelR + 0.11, zSign * offsetZ);
  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, wheelT, 24); const wheelL = new THREE.Mesh(wheelGeo, wheelMat); const wheelRMesh = new THREE.Mesh(wheelGeo, wheelMat);
  wheelL.rotation.x = Math.PI / 2; wheelRMesh.rotation.x = Math.PI / 2; wheelL.position.set(-offsetX, wheelR, zSign * offsetZ); wheelRMesh.position.set(offsetX, wheelR, zSign * offsetZ);
  g.add(upLeft, upRight, cross, wheelL, wheelRMesh);
  return g;
}

function makePaddle(color, orientation = 1){
  const g = new THREE.Group();
  const headRadius = 0.092;
  const headYOffset = TABLE.H + 0.072;
  const headAnchor = new THREE.Object3D(); headAnchor.position.set(0, headYOffset, orientation === 1 ? -0.018 : 0.018); headAnchor.visible = false; g.add(headAnchor);

  const frontColor = new THREE.Color(color); const backColor = frontColor.clone(); backColor.offsetHSL(-0.05, -0.18, -0.18);
  const visualWrapper = new THREE.Group();
  const fancy = buildCurvedPaddle(frontColor.getHex(), backColor.getHex()); fancy.scale.setScalar(0.9); fancy.position.set(0, headYOffset - 0.12, -0.08); fancy.children.forEach(c => c.castShadow = true);
  const wrist = new THREE.Group(); const baseTilt = THREE.MathUtils.degToRad(orientation === 1 ? -18 : -22); const baseRoll = THREE.MathUtils.degToRad(orientation === 1 ? 12 : -12);
  wrist.rotation.set(baseTilt, 0, baseRoll); wrist.add(fancy); visualWrapper.add(wrist); visualWrapper.rotation.y = orientation === 1 ? Math.PI : 0; g.add(visualWrapper);
  g.userData = { headRadius, headAnchor, visualWrapper, baseYaw: visualWrapper.rotation.y, orientationSign: orientation, wrist, baseTilt, baseRoll };
  return g;
}

function buildCurvedPaddle(frontColor, backColor){
  const headR = 0.092; const headZ = 0.014; const handleLen = 0.13; const handleR = 0.018;
  const geo = new THREE.SphereGeometry(headR, 32, 24, 0, Math.PI * 2, 0, Math.PI / 1.1);
  const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: frontColor, roughness: 0.45 }));
  const back = new THREE.Mesh(geo.clone(), new THREE.MeshStandardMaterial({ color: backColor, roughness: 0.45 })); back.rotation.y = Math.PI; back.position.z = headZ;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(handleR, handleR * 1.12, handleLen, 26), new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.6 }));
  handle.rotation.x = Math.PI / 2; handle.position.set(0, headR * 0.62, -headZ * 1.6);
  const group = new THREE.Group(); group.add(front, back, handle); return group;
}

function buildTrail(parent, settings = {}){
  const count = settings.count ?? 24; const minOpacity = settings.minOpacity ?? 0.2; const maxOpacity = settings.maxOpacity ?? 0.62; const speedFactor = settings.speedFactor ?? 0.04;
  const positions = new Float32Array(count * 3); const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color: settings.color ?? 0xfff1cc, transparent: true, opacity: minOpacity });
  const line = new THREE.Line(geometry, material); line.frustumCulled = false; parent.add(line);
  return {
    reset(pos){ for (let i = 0; i < count; i++){ const idx = i * 3; positions[idx] = pos.x; positions[idx + 1] = pos.y; positions[idx + 2] = pos.z; } geometry.attributes.position.needsUpdate = true; material.opacity = minOpacity; },
    push(pos, speed){ for (let i = count - 1; i > 0; i--){ const src = (i - 1) * 3; const dst = i * 3; positions[dst] = positions[src]; positions[dst + 1] = positions[src + 1]; positions[dst + 2] = positions[src + 2]; } positions[0] = pos.x; positions[1] = pos.y; positions[2] = pos.z; geometry.attributes.position.needsUpdate = true; material.opacity = clamp(minOpacity + speed * speedFactor, minOpacity, maxOpacity); },
  };
}

function makeHexNetAlpha(w, h, hexR){
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h; const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#ffffff"; const dx = hexR * 1.732; const dy = hexR * 1.5;
  const drawHex = (cx, cy, r) => { ctx.beginPath(); for (let i = 0; i < 6; i++){ const a = (Math.PI / 3) * i; const px = cx + r * Math.cos(a); const py = cy + r * Math.sin(a); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath(); ctx.lineWidth = 2; ctx.stroke(); ctx.globalCompositeOperation = "destination-out"; ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = "source-over"; };
  for (let y = 0; y < h + dy; y += dy) {
    for (let x = 0; x < w + dx; x += dx) {
      const offset = Math.floor(y / dy) % 2 ? dx / 2 : 0;
      drawHex(x + offset, y, hexR);
    }
  }
  const tex = new THREE.CanvasTexture(canvas); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 2); tex.anisotropy = 8; return tex;
}
