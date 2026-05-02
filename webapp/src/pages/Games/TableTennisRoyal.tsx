"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type PlayerSide = "near" | "far";
type PointReason = "out" | "doubleBounce" | "net" | "wrongSide" | "miss";
type StrokeAction = "ready" | "forehand" | "backhand" | "serve";
type ServeStage = "own" | "opponent";
type AiTactic = "serve" | "loop" | "drive" | "push" | "wide" | "body";

type DesiredHit = {
  target: THREE.Vector3;
  power: number;
  topSpin: number;
  sideSpin: number;
  tactic?: AiTactic;
};

type BallPhase =
  | { kind: "serve"; server: PlayerSide; stage: ServeStage }
  | { kind: "rally" };

type BallState = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  lastHitBy: PlayerSide | null;
  bounceSide: PlayerSide | null;
  bounceCount: number;
  phase: BallPhase;
};

type BonePack = {
  spine?: THREE.Bone;
  chest?: THREE.Bone;
  neck?: THREE.Bone;
  rightShoulder?: THREE.Bone;
  rightUpperArm?: THREE.Bone;
  rightForeArm?: THREE.Bone;
  rightHand?: THREE.Bone;
  leftShoulder?: THREE.Bone;
  leftUpperArm?: THREE.Bone;
  leftForeArm?: THREE.Bone;
  leftHand?: THREE.Bone;
};

type BoneRest = { bone: THREE.Bone; q: THREE.Quaternion };

type ArmChain = {
  shoulder?: THREE.Bone;
  upper: THREE.Bone;
  fore: THREE.Bone;
  hand: THREE.Bone;
  upperLen: number;
  foreLen: number;
};

type StrokePose = {
  rightShoulder: THREE.Vector3;
  rightElbow: THREE.Vector3;
  rightHand: THREE.Vector3;
  leftShoulder: THREE.Vector3;
  leftElbow: THREE.Vector3;
  leftHand: THREE.Vector3;
  paddleGrip: THREE.Vector3;
  paddleCenter: THREE.Vector3;
  faceNormal: THREE.Vector3;
  torsoYaw: number;
  torsoLean: number;
  shoulderLift: number;
  wristPronation: number;
  crouch: number;
};

type HumanRig = {
  side: PlayerSide;
  root: THREE.Group;
  modelRoot: THREE.Group;
  fallback: THREE.Group;
  paddle: THREE.Group;
  model: THREE.Object3D | null;
  bones: BonePack;
  rest: BoneRest[];
  rightArmChain?: ArmChain;
  leftArmChain?: ArmChain;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  yaw: number;
  action: StrokeAction;
  swingT: number;
  cooldown: number;
  desiredHit: DesiredHit | null;
  hitThisSwing: boolean;
  speed: number;
};

type HudState = { nearScore: number; farScore: number; status: string; power: number; spin: number };

type ControlState = {
  active: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startPlayer: THREE.Vector3;
};

const HUMAN_URL = "https://threejs.org/examples/models/gltf/readyplayer.me.glb";
const TABLE_GLTF_URL = "";

const UP = new THREE.Vector3(0, 1, 0);
const Y_AXIS = UP;

const CFG = {
  tableL: 2.74,
  tableW: 1.525,
  tableY: 0.76,
  tableTopThickness: 0.075,
  netH: 0.1525,
  netPostOutside: 0.1525,
  ballR: 0.02,
  gravity: 9.81,
  airDrag: 0.22,
  magnus: 0.00125,
  tableRestitution: 0.875,
  tableFriction: 0.965,
  spinDecay: 0.72,
  playerHeight: 1.72,
  playerSpeed: 2.95,
  aiSpeed: 3.05,
  reach: 0.48,
  swingDuration: 0.34,
  backhandDuration: 0.29,
  serveDuration: 0.86,
  hitWindowStart: 0.43,
  hitWindowEnd: 0.72,
  serveContactT: 0.68,
  playerVisualYawFix: Math.PI,
  paddlePalmOffset: 0.038,
};

const TABLE_HALF_W = CFG.tableW / 2;
const TABLE_HALF_L = CFG.tableL / 2;
const BALL_SURFACE_Y = CFG.tableY + CFG.ballR;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const sideOfZ = (z: number): PlayerSide => (z >= 0 ? "near" : "far");
const opposite = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");

function material(color: number, roughness = 0.72, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function transparentMaterial(color: number, opacity: number, roughness = 0.72) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02, transparent: true, opacity, depthWrite: false });
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

function addBox(group: THREE.Group | THREE.Scene, size: [number, number, number], pos: [number, number, number], matArg: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), matArg);
  mesh.position.set(...pos);
  enableShadow(mesh);
  group.add(mesh);
  return mesh;
}

function addCylinder(group: THREE.Group | THREE.Scene, radiusTop: number, radiusBottom: number, height: number, pos: [number, number, number], matArg: THREE.Material, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), matArg);
  mesh.position.set(...pos);
  enableShadow(mesh);
  group.add(mesh);
  return mesh;
}

function yawFromForward(forward: THREE.Vector3) {
  return Math.atan2(-forward.x, -forward.z);
}

function forwardFromYaw(yaw: number) {
  return new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, yaw).normalize();
}

function rightFromForward(forward: THREE.Vector3) {
  return new THREE.Vector3(-forward.z, 0, forward.x).normalize();
}

function getWorldPos(obj: THREE.Object3D) {
  return obj.getWorldPosition(new THREE.Vector3());
}

function isOverTable(x: number, z: number, margin = 0) {
  return Math.abs(x) <= TABLE_HALF_W + margin && Math.abs(z) <= TABLE_HALF_L + margin;
}

function buildRealisticTableTennisTable() {
  const group = new THREE.Group();
  const floorMat = material(0x121a22, 0.92, 0.0);
  const tableTopMat = material(0x1e64b5, 0.56, 0.02);
  const tableEdgeMat = material(0xe6edf8, 0.42, 0.02);
  const legMat = material(0x4b5563, 0.44, 0.25);
  const netMat = transparentMaterial(0xf7fbff, 0.72, 0.35);

  addBox(group, [7.2, 0.04, 8], [0, -0.02, 0], floorMat);
  addBox(group, [CFG.tableW, CFG.tableTopThickness, CFG.tableL], [0, CFG.tableY, 0], tableTopMat);
  addBox(group, [CFG.tableW, 0.01, 0.02], [0, CFG.tableY + CFG.tableTopThickness / 2 + 0.006, 0], tableEdgeMat);

  const legY = CFG.tableY / 2;
  const legOffsetX = CFG.tableW / 2 - 0.14;
  const legOffsetZ = CFG.tableL / 2 - 0.22;
  addCylinder(group, 0.035, 0.04, CFG.tableY, [-legOffsetX, legY, -legOffsetZ], legMat, 20);
  addCylinder(group, 0.035, 0.04, CFG.tableY, [legOffsetX, legY, -legOffsetZ], legMat, 20);
  addCylinder(group, 0.035, 0.04, CFG.tableY, [-legOffsetX, legY, legOffsetZ], legMat, 20);
  addCylinder(group, 0.035, 0.04, CFG.tableY, [legOffsetX, legY, legOffsetZ], legMat, 20);

  addBox(group, [CFG.tableW + CFG.netPostOutside * 2, CFG.netH, 0.015], [0, CFG.tableY + CFG.netH / 2, 0], netMat);
  return group;
}
function addTable(scene: THREE.Scene) { const fallback = buildRealisticTableTennisTable(); scene.add(fallback); return fallback; }
function normalizeHuman(model: THREE.Object3D, targetHeight: number) {
  model.rotation.set(0, CFG.playerVisualYawFix, 0);
  model.position.set(0, 0, 0);
  model.scale.setScalar(1);
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const h = Math.max(0.001, box.max.y - box.min.y);
  model.scale.setScalar(targetHeight / h);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.add(new THREE.Vector3(-center.x, -box.min.y, -center.z));
}
function createFallbackHuman(color: number) {
  const g = new THREE.Group();
  const skin = material(0xefc6a0, 0.76, 0.01);
  const shirt = material(color, 0.68, 0.02);
  const pants = material(0x17202c, 0.84, 0.0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 18), skin);
  head.position.y = 1.56;
  g.add(head);
  addCylinder(g, 0.2, 0.24, 0.62, [0, 1.08, 0], shirt, 20);
  addCylinder(g, 0.17, 0.2, 0.5, [0, 0.54, 0], pants, 20);
  enableShadow(g);
  return g;
}
function createTableTennisPaddle(colorA: number, colorB = 0x090909) {
  const g = new THREE.Group();
  const blade = material(colorA, 0.48, 0.03);
  const grip = material(colorB, 0.62, 0.06);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.014, 36), blade);
  face.rotation.x = Math.PI / 2;
  face.position.y = 0.22;
  g.add(face);
  addCylinder(g, 0.016, 0.014, 0.18, [0, 0.12, 0], grip, 16);
  enableShadow(g);
  return g;
}
function findHumanBones(model: THREE.Object3D): BonePack { void model; return {}; }
function captureRestPose(bones: BonePack) { void bones; return [] as BoneRest[]; }
function makeArmChain(shoulder: THREE.Bone | undefined, upper: THREE.Bone | undefined, fore: THREE.Bone | undefined, hand: THREE.Bone | undefined): ArmChain | undefined { void shoulder; void upper; void fore; void hand; return undefined; }
function serveTossPosition(player: HumanRig, tRaw: number) { void tRaw; return player.pos.clone(); }
function serveContactPosition(player: HumanRig) { return player.pos.clone(); }
function resetBallForServe(ball: BallState, server: HumanRig) { void server; ball.lastHitBy = null; }
function addHuman(scene: THREE.Scene, side: PlayerSide, start: THREE.Vector3): HumanRig {
  const root = new THREE.Group();
  const modelRoot = new THREE.Group();
  const accent = side === "near" ? 0xff6b38 : 0x37b2ff;
  const fallback = createFallbackHuman(accent);
  const paddle = createTableTennisPaddle(accent);
  root.position.copy(start);
  modelRoot.position.copy(start);
  modelRoot.rotation.y = side === "near" ? 0 : Math.PI;
  modelRoot.add(fallback);
  paddle.position.set(start.x + 0.18, 1.02, start.z + (side === "near" ? -0.08 : 0.08));
  scene.add(root, modelRoot, paddle);
  return { side, root, modelRoot, fallback, paddle, model:null, bones:{}, rest:[], pos:start.clone(), target:start.clone(), yaw:0, action:"ready", swingT:0, cooldown:0, desiredHit:null, hitThisSwing:false, speed:CFG.playerSpeed };
}
function createBall(): BallState { const m = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR)); return { mesh:m,pos:new THREE.Vector3(),vel:new THREE.Vector3(),spin:new THREE.Vector3(),lastHitBy:null,bounceSide:null,bounceCount:0,phase:{kind:"serve",server:"near",stage:"own"}}; }

export default function MobileRealisticTableTennisGame() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hud] = useState<HudState>({ nearScore: 0, farScore: 0, status: "Swipe up to serve", power: 0, spin: 0 });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c141d);
    const camera = new THREE.PerspectiveCamera(46, 1, 0.03, 30);
    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x274f6a, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(-2.8, 5.4, 3.2);
    scene.add(key);
    addTable(scene);
    const nearPlayer = addHuman(scene, "near", new THREE.Vector3(0, 0, TABLE_HALF_L + 0.48));
    const ball = createBall();
    resetBallForServe(ball, nearPlayer);
    scene.add(ball.mesh);
    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      camera.aspect = w / h;
      camera.position.set(0, 2.25, 3.45);
      camera.lookAt(0, CFG.tableY + 0.2, 0);
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", resize);
    resize();
    let frameId = 0;
    const animate = () => { frameId = requestAnimationFrame(animate); renderer.render(scene, camera); };
    animate();
    return () => { cancelAnimationFrame(frameId); window.removeEventListener("resize", resize); renderer.dispose(); };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#091014", touchAction: "none", userSelect: "none" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      </div>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <div style={{ position: "absolute", left: "50%", top: 10, transform: "translateX(-50%)", color: "white" }}>
          You {hud.nearScore} — {hud.farScore} AI
          <div>{hud.status}</div>
        </div>
      </div>
    </div>
  );
}
