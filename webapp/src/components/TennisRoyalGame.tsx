"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type PlayerSide = "near" | "far";
type PointReason = "winner" | "out" | "doubleBounce" | "net";
type StrokeAction = "ready" | "forehand" | "serve";

type BallState = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: number;
  lastHitBy: PlayerSide | null;
  bounceSide: PlayerSide | null;
  bounceCount: number;
};

type DesiredHit = { target: THREE.Vector3; power: number };

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
  racketGrip: THREE.Vector3;
  racketHead: THREE.Vector3;
  torsoYaw: number;
  torsoLean: number;
  shoulderLift: number;
  wristPronation: number;
};

type HumanRig = {
  side: PlayerSide;
  root: THREE.Group;
  modelRoot: THREE.Group;
  fallback: THREE.Group;
  racket: THREE.Group;
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

type HudState = { nearScore: number; farScore: number; status: string; power: number };

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
const UP = new THREE.Vector3(0, 1, 0);
const Y_AXIS = UP;

const CFG = {
  courtW: 4.18,
  doublesW: 5.25,
  courtL: 12.1,
  serviceLineZ: 2.85,
  netH: 0.64,
  ballR: 0.085,
  gravity: 9.8,
  airDrag: 0.078,
  bounceRestitution: 0.74,
  groundFriction: 0.86,
  minBallSpeed: 0.12,
  playerHeight: 1.82,
  playerSpeed: 5.2,
  aiSpeed: 4.65,
  reach: 0.92,
  swingDuration: 0.42,
  serveDuration: 0.86,
  hitWindowStart: 0.42,
  hitWindowEnd: 0.72,
  serveContactT: 0.72,
  playerVisualYawFix: Math.PI,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const sideOfZ = (z: number): PlayerSide => (z >= 0 ? "near" : "far");
const opposite = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");

function material(color: number, roughness = 0.74, metalness = 0.02) { return new THREE.MeshStandardMaterial({ color, roughness, metalness }); }
function transparentMaterial(color: number, opacity: number, roughness = 0.72) { return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02, transparent: true, opacity, depthWrite: false }); }
function enableShadow(obj: THREE.Object3D) { obj.traverse((child) => { const mesh = child as THREE.Mesh; if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; } }); return obj; }
function addBox(group: THREE.Group | THREE.Scene, size: [number, number, number], pos: [number, number, number], matArg: THREE.Material) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), matArg); mesh.position.set(...pos); enableShadow(mesh); group.add(mesh); return mesh; }
function addCylinder(group: THREE.Group | THREE.Scene, radiusTop: number, radiusBottom: number, height: number, pos: [number, number, number], matArg: THREE.Material, segments = 32) { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), matArg); mesh.position.set(...pos); enableShadow(mesh); group.add(mesh); return mesh; }
function yawFromForward(forward: THREE.Vector3) { return Math.atan2(-forward.x, -forward.z); }
function forwardFromYaw(yaw: number) { return new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, yaw).normalize(); }
function rightFromForward(forward: THREE.Vector3) { return new THREE.Vector3(-forward.z, 0, forward.x).normalize(); }
function getWorldPos(obj: THREE.Object3D) { return obj.getWorldPosition(new THREE.Vector3()); }

function addCourt(scene: THREE.Scene) { const group = new THREE.Group(); scene.add(group); const floorMat = material(0x152018, 0.96, 0.0); addBox(group, [9.8, 0.045, 15.9], [0, -0.045, 0], floorMat); return group; }
function normalizeHuman(model: THREE.Object3D, targetHeight: number) { model.rotation.set(0, CFG.playerVisualYawFix, 0); model.position.set(0, 0, 0); model.scale.setScalar(1); model.updateMatrixWorld(true); let box = new THREE.Box3().setFromObject(model); const h = Math.max(0.001, box.max.y - box.min.y); model.scale.setScalar(targetHeight / h); model.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(model); const center = box.getCenter(new THREE.Vector3()); model.position.add(new THREE.Vector3(-center.x, -box.min.y, -center.z)); }
function createFallbackHuman(color: number) { const g = new THREE.Group(); const skin = material(0xf0c7a0); const shirt = material(color); const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 28, 20), skin); head.position.y = 1.62; g.add(head); addCylinder(g, 0.24, 0.31, 0.72, [0, 1.04, 0], shirt, 28); enableShadow(g); return g; }
function createRacket(color: number) { const g = new THREE.Group(); const frameMat = material(color, 0.36, 0.45); const head = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.019, 12, 52), frameMat); head.scale.y = 1.34; head.position.y = 0.56; enableShadow(head); g.add(head); return g; }
function findFirstBone(root: THREE.Object3D, tests: string[]) { let found: THREE.Bone | undefined; root.traverse((o) => { if (found) return; const b = o as THREE.Bone; if (!b.isBone) return; const n = b.name.toLowerCase().replace(/[_.\-\s]/g, ""); if (tests.some((t) => n.includes(t))) found = b; }); return found; }
function findHumanBones(model: THREE.Object3D): BonePack { return { rightShoulder: findFirstBone(model, ["rightshoulder"]), rightUpperArm: findFirstBone(model, ["rightarm"]), rightForeArm: findFirstBone(model, ["rightforearm"]), rightHand: findFirstBone(model, ["righthand"]), leftShoulder: findFirstBone(model, ["leftshoulder"]), leftUpperArm: findFirstBone(model, ["leftarm"]), leftForeArm: findFirstBone(model, ["leftforearm"]), leftHand: findFirstBone(model, ["lefthand"]) }; }
function captureRestPose(bones: BonePack) { const out: BoneRest[] = []; Object.values(bones).forEach((bone) => { if (bone && !out.some((r) => r.bone === bone)) out.push({ bone, q: bone.quaternion.clone() }); }); return out; }
function makeArmChain(shoulder: THREE.Bone | undefined, upper: THREE.Bone | undefined, fore: THREE.Bone | undefined, hand: THREE.Bone | undefined): ArmChain | undefined { if (!upper || !fore || !hand) return undefined; upper.updateMatrixWorld(true); fore.updateMatrixWorld(true); hand.updateMatrixWorld(true); const a = getWorldPos(upper); const b = getWorldPos(fore); const c = getWorldPos(hand); return { shoulder, upper, fore, hand, upperLen: Math.max(0.05, a.distanceTo(b)), foreLen: Math.max(0.05, b.distanceTo(c)) }; }
function setRacketPose(racket: THREE.Group, grip: THREE.Vector3, head: THREE.Vector3, roll: number) { const dir = head.clone().sub(grip).normalize(); racket.position.copy(grip); racket.quaternion.setFromUnitVectors(UP, dir); racket.rotateY(roll); }
function updatePoseAndRacket(player: HumanRig, ball: BallState) { if (player.bones.rightHand) { const grip = getWorldPos(player.bones.rightHand); const target = ball.pos.clone().setY(clamp(ball.pos.y, 0.8, 1.8)); setRacketPose(player.racket, grip, target, 0.2); player.racket.visible = true; } }
function ballisticVelocity(from: THREE.Vector3, target: THREE.Vector3, power: number, serve = false) { const flatDist = Math.hypot(target.x - from.x, target.z - from.z); const baseSpeed = serve ? 7.2 + power * 4.2 : 5.2 + power * 2.8; const flight = clamp(flatDist / baseSpeed, serve ? 0.42 : 0.58, serve ? 0.92 : 1.22); return new THREE.Vector3((target.x - from.x) / flight, (target.y - from.y + 0.5 * CFG.gravity * flight * flight) / flight, (target.z - from.z) / flight); }
function makeUserTargetFromSwipe(startX: number, startY: number, endX: number, endY: number, isServe: boolean) { const dx = endX - startX; const dy = endY - startY; const power = clamp(Math.hypot(dx, dy) / 185, isServe ? 0.5 : 0.18, 1); const aimX = clamp((dx / 140) * (CFG.courtW / 2), -CFG.courtW / 2 + 0.42, CFG.courtW / 2 - 0.42); const upward = clamp((-dy + 40) / 230, 0, 1); const targetZ = isServe ? lerp(-1.0, -CFG.serviceLineZ + 0.22, upward) : lerp(-1.15, -CFG.courtL / 2 + 0.88, upward); return { target: new THREE.Vector3(aimX, CFG.ballR, targetZ), power }; }

function addHuman(scene: THREE.Scene, side: PlayerSide, start: THREE.Vector3, accent: number): HumanRig { const root = new THREE.Group(); const modelRoot = new THREE.Group(); const fallback = createFallbackHuman(accent); const racket = createRacket(accent); root.position.copy(start); modelRoot.position.copy(start); modelRoot.add(fallback); scene.add(root, modelRoot, racket); const rig: HumanRig = { side, root, modelRoot, fallback, racket, model: null, bones: {}, rest: [], pos: start.clone(), target: start.clone(), yaw: side === "near" ? 0 : Math.PI, action: "ready", swingT: 0, cooldown: 0, desiredHit: null, hitThisSwing: false, speed: side === "near" ? CFG.playerSpeed : CFG.aiSpeed }; new GLTFLoader().setCrossOrigin("anonymous").load(HUMAN_URL, (gltf) => { const model = gltf.scene; normalizeHuman(model, CFG.playerHeight); enableShadow(model); rig.model = model; rig.bones = findHumanBones(model); rig.rest = captureRestPose(rig.bones); rig.fallback.visible = false; rig.modelRoot.add(model); rig.rightArmChain = makeArmChain(rig.bones.rightShoulder, rig.bones.rightUpperArm, rig.bones.rightForeArm, rig.bones.rightHand); rig.leftArmChain = makeArmChain(rig.bones.leftShoulder, rig.bones.leftUpperArm, rig.bones.leftForeArm, rig.bones.leftHand); rig.racket.visible = true; }, undefined, () => { rig.fallback.visible = true; rig.racket.visible = false; }); return rig; }
function createBall() { const mat = new THREE.MeshStandardMaterial({ color: 0xd7ff35, roughness: 0.42, metalness: 0.01 }); const mesh = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR, 32, 24), mat); enableShadow(mesh); return { mesh, pos: new THREE.Vector3(0, 1.18, CFG.courtL / 2 - 1.25), vel: new THREE.Vector3(), spin: 0, lastHitBy: null, bounceSide: null, bounceCount: 0 } as BallState; }

export default function MobileThreeTennisPrototype() {
  const hostRef = useRef<HTMLDivElement | null>(null); const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hud, setHud] = useState<HudState>({ nearScore: 0, farScore: 0, status: "Swipe up to serve", power: 0 });
  const controlRef = useRef<ControlState>({ active: false, pointerId: null, startX: 0, startY: 0, lastX: 0, lastY: 0, startPlayer: new THREE.Vector3() });

  useEffect(() => {
    const host = hostRef.current; const canvas = canvasRef.current; if (!host || !canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false }); renderer.setClearColor(0x07100c, 1); renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 60); scene.add(new THREE.AmbientLight(0xffffff, 0.62)); addCourt(scene);
    const nearPlayer = addHuman(scene, "near", new THREE.Vector3(0, 0, CFG.courtL / 2 - 1.04), 0xff7a2f); const farPlayer = addHuman(scene, "far", new THREE.Vector3(0, 0, -CFG.courtL / 2 + 1.04), 0x62d2ff);
    const ball = createBall(); scene.add(ball.mesh);
    const resize = () => { const w = Math.max(1, host.clientWidth); const h = Math.max(1, host.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.position.set(0, 6.2, 7.35); camera.lookAt(new THREE.Vector3(0, 0.78, -0.7)); camera.updateProjectionMatrix(); };
    const onPointerDown = (e: PointerEvent) => { if (controlRef.current.active) return; canvas.setPointerCapture(e.pointerId); controlRef.current = { active: true, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, startPlayer: nearPlayer.target.clone() }; };
    const onPointerMove = (e: PointerEvent) => { const c = controlRef.current; if (!c.active || c.pointerId !== e.pointerId) return; c.lastX = e.clientX; c.lastY = e.clientY; const dx = e.clientX - c.startX; const dy = e.clientY - c.startY; nearPlayer.target.x = clamp(c.startPlayer.x + dx * 0.012, -CFG.courtW / 2 + 0.35, CFG.courtW / 2 - 0.35); nearPlayer.target.z = clamp(c.startPlayer.z + dy * 0.012, 0.76, CFG.courtL / 2 - 0.42); setHud((prev) => ({ ...prev, power: clamp01(Math.hypot(dx, dy) / 185) })); };
    const onPointerUp = (e: PointerEvent) => { const c = controlRef.current; if (!c.active || c.pointerId !== e.pointerId) return; c.active = false; c.pointerId = null; const hit = makeUserTargetFromSwipe(c.startX, c.startY, e.clientX, e.clientY, ball.lastHitBy === null); ball.vel.copy(ballisticVelocity(ball.pos, hit.target, hit.power, ball.lastHitBy === null)); ball.lastHitBy = "near"; setHud((prev) => ({ ...prev, status: "Forehand swing", power: 0 })); };
    canvas.addEventListener("pointerdown", onPointerDown); canvas.addEventListener("pointermove", onPointerMove); canvas.addEventListener("pointerup", onPointerUp); window.addEventListener("resize", resize); resize();
    let frameId = 0; let last = performance.now();
    const animate = () => { frameId = requestAnimationFrame(animate); const now = performance.now(); const dt = Math.min(0.033, (now - last) / 1000); last = now; ball.vel.y -= CFG.gravity * dt; ball.vel.multiplyScalar(Math.exp(-CFG.airDrag * dt)); ball.pos.addScaledVector(ball.vel, dt); if (ball.pos.y <= CFG.ballR) { ball.pos.y = CFG.ballR; ball.vel.y = Math.abs(ball.vel.y) * CFG.bounceRestitution; } ball.mesh.position.copy(ball.pos); nearPlayer.pos.lerp(nearPlayer.target, 1 - Math.exp(-8 * dt)); nearPlayer.modelRoot.position.copy(nearPlayer.pos); updatePoseAndRacket(nearPlayer, ball); updatePoseAndRacket(farPlayer, ball); renderer.render(scene, camera); };
    animate();
    return () => { cancelAnimationFrame(frameId); window.removeEventListener("resize", resize); canvas.removeEventListener("pointerdown", onPointerDown); canvas.removeEventListener("pointermove", onPointerMove); canvas.removeEventListener("pointerup", onPointerUp); renderer.dispose(); };
  }, []);

  return (<div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#07100c", touchAction: "none", userSelect: "none" }}><div ref={hostRef} style={{ position: "absolute", inset: 0 }}><canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} /></div><div style={{ position: "fixed", inset: 0, pointerEvents: "none", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}><div style={{ position: "absolute", left: "50%", top: 10, transform: "translateX(-50%)", color: "white", background: "rgba(0,0,0,0.54)", border: "1px solid rgba(255,255,255,0.16)", padding: "9px 13px", borderRadius: 16, fontSize: 13, fontWeight: 800 }}>You {hud.nearScore} — {hud.farScore} AI<div style={{ fontSize: 11, fontWeight: 600, opacity: 0.82, marginTop: 2 }}>{hud.status}</div></div></div></div>);
}
