"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

type PlayerAction = "idle" | "approach" | "throw" | "recover";
type BallReturnState = "idle" | "toPit" | "hidden" | "returning";

type HudState = {
  power: number;
  status: string;
  activePlayer: number;
  p1: number;
  p2: number;
  frame: number;
  roll: number;
};

type ThrowIntent = {
  power: number;
  releaseX: number;
  targetX: number;
  hook: number;
  speed: number;
};

type ControlState = {
  active: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  intent: ThrowIntent | null;
};

type BowlingFrame = { rolls: number[]; cumulative: number | null };
type ScorePlayer = { name: string; frames: BowlingFrame[]; total: number };

type HumanRig = {
  root: THREE.Group;
  modelRoot: THREE.Group;
  fallback: THREE.Group;
  shadow: THREE.Mesh;
  model: THREE.Object3D | null;
  pos: THREE.Vector3;
  yaw: number;
  action: PlayerAction;
  approachT: number;
  throwT: number;
  recoverT: number;
  walkCycle: number;
  approachFrom: THREE.Vector3;
  approachTo: THREE.Vector3;
};

type BallState = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  held: boolean;
  rolling: boolean;
  inGutter: boolean;
  hook: number;
  returnState: BallReturnState;
  returnT: number;
};

type PinState = {
  root: THREE.Group;
  start: THREE.Vector3;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  tilt: number;
  tiltDir: THREE.Vector3;
  angularVel: number;
  standing: boolean;
  knocked: boolean;
};

const HUMAN_URL = "https://threejs.org/examples/models/gltf/readyplayer.me.glb";
const HDRI_URL = "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr";
const OAK_BASE = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/oak_veneer_01/";
const OAK = {
  diff: `${OAK_BASE}oak_veneer_01_diff_2k.jpg`,
  rough: `${OAK_BASE}oak_veneer_01_rough_2k.jpg`,
  normal: `${OAK_BASE}oak_veneer_01_nor_gl_2k.jpg`,
};

const UP = new THREE.Vector3(0, 1, 0);

const CFG = {
  laneY: 0.08,
  laneHalfW: 1.56,
  gutterHalfW: 2.08,
  playerStartZ: 7.15,
  approachStopZ: 4.95,
  foulZ: 4.55,
  arrowsZ: 0.95,
  pinDeckZ: -10.75,
  backStopZ: -13.15,
  ballR: 0.18,
  pinR: 0.17,
  pinToppleThreshold: 0.58,
  approachDuration: 0.56,
  throwDuration: 0.9,
  recoverDuration: 0.28,
  releaseT: 0.56,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => t * t * (3 - 2 * t);

function makeEmptyPlayers(): ScorePlayer[] {
  const makeFrames = () => Array.from({ length: 10 }, () => ({ rolls: [] as number[], cumulative: null }));
  return [
    { name: "PLAYER 1", frames: makeFrames(), total: 0 },
    { name: "PLAYER 2", frames: makeFrames(), total: 0 },
  ];
}

function clonePlayers(players: ScorePlayer[]) {
  return players.map((p) => ({ ...p, frames: p.frames.map((f) => ({ rolls: [...f.rolls], cumulative: f.cumulative })) }));
}

function frameComplete(frame: BowlingFrame, index: number) {
  const r = frame.rolls;
  if (index < 9) return r[0] === 10 || r.length >= 2;
  if (r.length < 2) return false;
  if (r[0] === 10 || r[0] + r[1] === 10) return r.length >= 3;
  return r.length >= 2;
}

function currentFrameIndex(player: ScorePlayer) {
  const idx = player.frames.findIndex((f, i) => !frameComplete(f, i));
  return idx === -1 ? 9 : idx;
}

function playerFinished(player: ScorePlayer) {
  return player.frames.every((f, i) => frameComplete(f, i));
}

function recomputePlayerTotals(player: ScorePlayer) {
  const flat = player.frames.flatMap((f) => f.rolls);
  let rollIndex = 0;
  let running = 0;

  for (let frame = 0; frame < 10; frame++) {
    const out = player.frames[frame];
    out.cumulative = null;

    if (frame < 9) {
      const a = flat[rollIndex];
      if (a == null) break;
      if (a === 10) {
        const b = flat[rollIndex + 1];
        const c = flat[rollIndex + 2];
        if (b == null || c == null) break;
        running += 10 + b + c;
        out.cumulative = running;
        rollIndex += 1;
      } else {
        const b = flat[rollIndex + 1];
        if (b == null) break;
        const base = a + b;
        if (base === 10) {
          const c = flat[rollIndex + 2];
          if (c == null) break;
          running += 10 + c;
        } else running += base;
        out.cumulative = running;
        rollIndex += 2;
      }
    } else {
      if (!frameComplete(out, frame)) break;
      running += out.rolls.reduce((s, v) => s + v, 0);
      out.cumulative = running;
    }
  }

  player.total = running;
}

function addRollToPlayer(player: ScorePlayer, knocked: number) {
  const frameIndex = currentFrameIndex(player);
  const frame = player.frames[frameIndex];

  if (frameIndex < 9) {
    if (frame.rolls.length === 0) frame.rolls.push(clamp(knocked, 0, 10));
    else if (frame.rolls.length === 1) frame.rolls.push(clamp(knocked, 0, 10 - frame.rolls[0]));
  } else {
    if (frame.rolls.length === 0) frame.rolls.push(clamp(knocked, 0, 10));
    else if (frame.rolls.length === 1) {
      const max = frame.rolls[0] === 10 ? 10 : 10 - frame.rolls[0];
      frame.rolls.push(clamp(knocked, 0, max));
    } else if (frame.rolls.length === 2) {
      let max = 10;
      if (frame.rolls[0] === 10 && frame.rolls[1] !== 10) max = 10 - frame.rolls[1];
      frame.rolls.push(clamp(knocked, 0, max));
    }
  }

  recomputePlayerTotals(player);
  return { frameIndex, frameEnded: frameComplete(frame, frameIndex), gameFinished: playerFinished(player) };
}

function standingPinsCount(pins: PinState[]) {
  return pins.filter((p) => p.root.visible && p.standing && p.tilt < CFG.pinToppleThreshold).length;
}

function enableShadow(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    }
  });
  return obj;
}

function setTexRepeat(tex: THREE.Texture, rx: number, ry: number) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 8;
}

function loadOakMaterial(loader: THREE.TextureLoader, repeatX: number, repeatY: number) {
  const diff = loader.load(OAK.diff);
  const rough = loader.load(OAK.rough);
  const normal = loader.load(OAK.normal);
  diff.colorSpace = THREE.SRGBColorSpace;
  setTexRepeat(diff, repeatX, repeatY);
  setTexRepeat(rough, repeatX, repeatY);
  setTexRepeat(normal, repeatX, repeatY);
  return new THREE.MeshPhysicalMaterial({
    map: diff,
    roughnessMap: rough,
    normalMap: normal,
    roughness: 0.22,
    metalness: 0.02,
    clearcoat: 1,
    clearcoatRoughness: 0.055,
    reflectivity: 0.92,
  });
}

function makeFallbackWoodMaterial() { return new THREE.MeshPhysicalMaterial({ color: 0xd3a365, roughness: 0.24, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.08 }); }

function normalizeHuman(model: THREE.Object3D, targetHeight: number) { model.rotation.set(0, Math.PI, 0); model.position.set(0, 0, 0); model.scale.setScalar(1); model.updateMatrixWorld(true); let box = new THREE.Box3().setFromObject(model); const h = Math.max(0.001, box.max.y - box.min.y); model.scale.setScalar(targetHeight / h); model.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(model); const center = box.getCenter(new THREE.Vector3()); model.position.add(new THREE.Vector3(-center.x, -box.min.y, -center.z)); }

function makeFallbackHuman(color: number) { const g = new THREE.Group(); const skin = new THREE.MeshStandardMaterial({ color: 0xecc5a2, roughness: 0.82 }); const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.72 }); const pants = new THREE.MeshStandardMaterial({ color: 0x1f232c, roughness: 0.84 }); const shoes = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.56 }); const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 18), skin); head.position.y = 1.62; g.add(head); const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.54, 6, 14), shirt); torso.position.y = 1.05; g.add(torso); const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.52, 4, 10), pants); leftLeg.position.set(-0.12, 0.35, 0); g.add(leftLeg); const rightLeg = leftLeg.clone(); rightLeg.position.x = 0.12; g.add(rightLeg); const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 4, 10), skin); leftArm.position.set(-0.32, 1.16, 0); leftArm.rotation.z = 0.22; g.add(leftArm); const rightArm = leftArm.clone(); rightArm.position.set(0.32, 1.16, 0.06); rightArm.rotation.z = -0.18; g.add(rightArm); const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.28), shoes); shoeL.position.set(-0.12, 0.03, -0.02); g.add(shoeL); const shoeR = shoeL.clone(); shoeR.position.x = 0.12; g.add(shoeR); enableShadow(g); return g; }

function addHuman(scene: THREE.Scene, start: THREE.Vector3, accent: number): HumanRig { const root = new THREE.Group(); const modelRoot = new THREE.Group(); const fallback = makeFallbackHuman(accent); const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; modelRoot.position.copy(start); modelRoot.add(fallback); shadow.position.set(start.x, CFG.laneY + 0.01, start.z); scene.add(root, modelRoot, shadow); const rig: HumanRig = { root, modelRoot, fallback, shadow, model: null, pos: start.clone(), yaw: 0, action: "idle", approachT: 0, throwT: 0, recoverT: 0, walkCycle: 0, approachFrom: start.clone(), approachTo: start.clone() }; new GLTFLoader().setCrossOrigin("anonymous").load(HUMAN_URL, (gltf) => { const model = gltf.scene; normalizeHuman(model, 1.82); enableShadow(model); rig.model = model; rig.fallback.visible = false; rig.modelRoot.add(model); }, undefined, () => { rig.fallback.visible = true; }); return rig; }

function syncHuman(rig: HumanRig) { rig.modelRoot.position.copy(rig.pos); rig.modelRoot.rotation.y = rig.yaw; rig.shadow.position.set(rig.pos.x, CFG.laneY + 0.01, rig.pos.z); }

function getHeldBallWorldPosition(rig: HumanRig) { let local = new THREE.Vector3(0.34, 0.94, 0.16); if (rig.action === "approach") { const s = Math.sin(rig.walkCycle); local = new THREE.Vector3(0.36, 0.82 + Math.abs(s) * 0.05, 0.14 + s * 0.09); } return local.applyAxisAngle(UP, rig.yaw).add(rig.pos); }
function makeBallMaterial() { return new THREE.MeshPhysicalMaterial({ color: 0x2d88ff, roughness: 0.08, metalness: 0.01, clearcoat: 1, clearcoatRoughness: 0.03, reflectivity: 1, envMapIntensity: 1.4 }); }
function createActiveBall() { const mesh = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR, 80, 64), makeBallMaterial()); enableShadow(mesh); const pos = new THREE.Vector3(0.4, CFG.laneY + 0.82, CFG.playerStartZ); mesh.position.copy(pos); return { mesh, pos, vel: new THREE.Vector3(), held: true, rolling: false, inGutter: false, hook: 0, returnState: "idle", returnT: 0 } as BallState; }

function createPinMesh() { const root = new THREE.Group(); root.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.74, 24), new THREE.MeshStandardMaterial({ color: 0xf8f5ef }))); enableShadow(root); return root; }
function createPins(scene: THREE.Scene) { const pins: PinState[] = []; const positions = [[0,0],[-0.32,-0.56],[0.32,-0.56],[-0.64,-1.12],[0,-1.12],[0.64,-1.12],[-0.96,-1.68],[-0.32,-1.68],[0.32,-1.68],[0.96,-1.68]]; for (const [x,dz] of positions) { const root = createPinMesh(); const start = new THREE.Vector3(x, CFG.laneY + 0.09, CFG.pinDeckZ + dz); root.position.copy(start); scene.add(root); pins.push({ root, start: start.clone(), pos: start.clone(), vel: new THREE.Vector3(), tilt: 0, tiltDir: new THREE.Vector3(0, 0, -1), angularVel: 0, standing: true, knocked: false }); } return pins; }
function resetPins(pins: PinState[]) { for (const pin of pins) { pin.pos.copy(pin.start); pin.vel.set(0,0,0); pin.tilt=0; pin.tiltDir.set(0,0,-1); pin.angularVel=0; pin.standing=true; pin.knocked=false; pin.root.visible=true; pin.root.position.copy(pin.pos); pin.root.rotation.set(0,0,0);} }
function createEnvironment(scene: THREE.Scene, loader: THREE.TextureLoader) { const group = new THREE.Group(); scene.add(group); let laneMat: THREE.Material; try { laneMat = loadOakMaterial(loader, 1.05, 8.5);} catch { laneMat = makeFallbackWoodMaterial(); } const lane = new THREE.Mesh(new THREE.PlaneGeometry(CFG.laneHalfW * 2, 18.72, 80, 320), laneMat); lane.rotation.x = -Math.PI / 2; lane.position.set(0, CFG.laneY, -4.2); lane.receiveShadow = true; group.add(lane); enableShadow(group); }
function computeIntent(hostWidth:number, hostHeight:number, startX:number, startY:number, x:number, y:number): ThrowIntent { const vertical = clamp((startY - y) / Math.max(180, hostHeight * 0.38), 0, 1); const screenX = clamp((x / hostWidth) * 2 - 1, -1, 1); const dragX = clamp((x - startX) / Math.max(90, hostWidth * 0.18), -1, 1); const releaseX = clamp(screenX * 0.84, -0.96, 0.96); const targetX = clamp(screenX * 1.04, -1.1, 1.1); const power = vertical; const speed = lerp(6.2, 16.4, easeOutCubic(power)); const hook = dragX * lerp(0.08, 0.76, power); return { power, releaseX, targetX, hook, speed }; }

function FrameBox({ frame }: { frame: BowlingFrame; index: number }) { return <div style={{ minWidth: 34, border: "1px solid rgba(255,255,255,0.18)", borderRadius: 6, overflow: "hidden", background: "rgba(255,255,255,0.04)" }}><div style={{ textAlign: "center", padding: "4px 2px", minHeight: 18, fontSize: 11, fontWeight: 900, color: "#7fd6ff" }}>{frame.cumulative ?? ""}</div></div>; }

export default function MobileBowlingRealistic() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hud, setHud] = useState<HudState>({ power: 0, status: "Swipe up to bowl", activePlayer: 0, p1: 0, p2: 0, frame: 1, roll: 1 });
  const [scores, setScores] = useState<ScorePlayer[]>(() => makeEmptyPlayers());
  const scoresMemo = useMemo(() => scores, [scores]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 80);
    camera.position.set(0, 2.9, 10.8);
    const pmrem = new THREE.PMREMGenerator(renderer); let envTex: THREE.Texture | null = null;
    new RGBELoader().setCrossOrigin("anonymous").load(HDRI_URL, (hdr) => { envTex = pmrem.fromEquirectangular(hdr).texture; scene.environment = envTex; hdr.dispose(); });
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const texLoader = new THREE.TextureLoader(); createEnvironment(scene, texLoader);
    const pins = createPins(scene); const player = addHuman(scene, new THREE.Vector3(0, CFG.laneY, CFG.playerStartZ), 0xff7a2f); const ball = createActiveBall(); scene.add(ball.mesh);
    let pendingIntent: ThrowIntent | null = null; const control: ControlState = { active: false, pointerId: null, startX: 0, startY: 0, lastX: 0, lastY: 0, intent: null };
    const resize = () => { const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }; resize();
    const onPointerDown = (e: PointerEvent) => { canvas.setPointerCapture(e.pointerId); control.active = true; control.pointerId = e.pointerId; control.startX = e.clientX; control.startY = e.clientY; control.intent = computeIntent(host.clientWidth, host.clientHeight, e.clientX, e.clientY, e.clientX, e.clientY); pendingIntent = control.intent; };
    const onPointerMove = (e: PointerEvent) => { if (!control.active || control.pointerId !== e.pointerId) return; control.intent = computeIntent(host.clientWidth, host.clientHeight, control.startX, control.startY, e.clientX, e.clientY); pendingIntent = control.intent; setHud((prev) => ({ ...prev, power: control.intent!.power })); };
    const onPointerUp = (e: PointerEvent) => { if (!control.active || control.pointerId !== e.pointerId) return; control.active = false; control.pointerId = null; const intent = computeIntent(host.clientWidth, host.clientHeight, control.startX, control.startY, e.clientX, e.clientY); pendingIntent = intent; player.action = "approach"; setHud((prev) => ({ ...prev, power: 0, status: "Fast approach to the line" })); };
    canvas.addEventListener("pointerdown", onPointerDown); canvas.addEventListener("pointermove", onPointerMove); canvas.addEventListener("pointerup", onPointerUp);
    let frameId = 0; let last = performance.now();
    const animate = () => { frameId = requestAnimationFrame(animate); const now = performance.now(); const dt = Math.min(0.033, (now - last) / 1000); last = now; updateRig(player, ball, dt); if (player.action === "throw" && pendingIntent && ball.held) { ball.held = false; ball.rolling = true; } renderer.render(scene, camera); };
    animate();
    return () => { cancelAnimationFrame(frameId); canvas.removeEventListener("pointerdown", onPointerDown); canvas.removeEventListener("pointermove", onPointerMove); canvas.removeEventListener("pointerup", onPointerUp); pmrem.dispose(); envTex?.dispose(); renderer.dispose(); resetPins(pins); };
  }, []);

  return <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#090b11" }}><div ref={hostRef} style={{ position: "absolute", inset: 0 }}><canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} /></div><div style={{ position: "fixed", inset: 0, pointerEvents: "none", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}><div style={{ position: "absolute", left: 8, right: 8, top: 8, color: "white", background: "rgba(5,8,14,0.72)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 16, padding: "8px 8px 10px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}><div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 0.2 }}>REAL BOWLING SCOREBOARD</div><div style={{ fontSize: 11, fontWeight: 800, color: "#7fd6ff" }}>FRAME {hud.frame} · ROLL {hud.roll} · P{hud.activePlayer + 1}</div></div><div style={{ display: "grid", gridTemplateColumns: "56px repeat(10, minmax(28px, 1fr))", gap: 4, alignItems: "center" }}>{scoresMemo.map((p, row) => <React.Fragment key={p.name}><div style={{ paddingLeft: 2, fontSize: 11, fontWeight: 900, color: row === hud.activePlayer ? "#7fd6ff" : "#ffffff" }}>{row === 0 ? `P1 ${p.total}` : `P2 ${p.total}`}</div>{p.frames.map((f, i) => <FrameBox key={`${row}-${i}`} frame={f} index={i} />)}</React.Fragment>)}</div><div style={{ marginTop: 7, textAlign: "center", fontSize: 11, fontWeight: 700, opacity: 0.9 }}>{hud.status}</div></div></div></div>;
}
