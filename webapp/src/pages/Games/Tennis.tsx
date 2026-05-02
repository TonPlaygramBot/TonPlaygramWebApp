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
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const sideOfZ = (z: number): PlayerSide => (z >= 0 ? "near" : "far");
const opposite = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");

function material(color: number, roughness = 0.74, metalness = 0.02) {
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

function addCourt(scene: THREE.Scene) {
  const group = new THREE.Group();
  scene.add(group);

  const floorMat = material(0x152018, 0.96, 0.0);
  const outerMat = material(0x1d7a4b, 0.88, 0.0);
  const courtMat = material(0x286fb1, 0.82, 0.0);
  const serviceMat = material(0x2f84c9, 0.82, 0.0);
  const lineMat = material(0xf7f7f7, 0.42, 0.0);
  const netMat = transparentMaterial(0x111111, 0.36, 0.55);
  const netWhite = material(0xf7f7f7, 0.5, 0.0);
  const postMat = material(0x333333, 0.35, 0.25);

  addBox(group, [9.8, 0.045, 15.9], [0, -0.045, 0], floorMat);
  addBox(group, [CFG.doublesW + 1.15, 0.035, CFG.courtL + 1.15], [0, -0.015, 0], outerMat);
  addBox(group, [CFG.courtW, 0.04, CFG.courtL], [0, 0.004, 0], courtMat);
  addBox(group, [CFG.courtW - 0.2, 0.043, CFG.serviceLineZ * 2], [0, 0.012, 0], serviceMat);

  const y = 0.045;
  const thick = 0.045;
  const halfW = CFG.courtW / 2;
  const halfL = CFG.courtL / 2;

  addBox(group, [CFG.courtW + thick, thick, thick], [0, y, -halfL], lineMat);
  addBox(group, [CFG.courtW + thick, thick, thick], [0, y, halfL], lineMat);
  addBox(group, [thick, thick, CFG.courtL + thick], [-halfW, y, 0], lineMat);
  addBox(group, [thick, thick, CFG.courtL + thick], [halfW, y, 0], lineMat);
  addBox(group, [CFG.courtW, thick, thick], [0, y, -CFG.serviceLineZ], lineMat);
  addBox(group, [CFG.courtW, thick, thick], [0, y, CFG.serviceLineZ], lineMat);
  addBox(group, [thick, thick, CFG.serviceLineZ * 2], [0, y, 0], lineMat);
  addBox(group, [thick, thick, 0.38], [0, y, -halfL + 0.18], lineMat);
  addBox(group, [thick, thick, 0.38], [0, y, halfL - 0.18], lineMat);
  addBox(group, [thick, thick, CFG.courtL + thick], [-CFG.doublesW / 2, y, 0], transparentMaterial(0xffffff, 0.34));
  addBox(group, [thick, thick, CFG.courtL + thick], [CFG.doublesW / 2, y, 0], transparentMaterial(0xffffff, 0.34));

  addBox(group, [CFG.doublesW + 0.35, CFG.netH, 0.025], [0, CFG.netH / 2, 0], netMat);
  addBox(group, [CFG.doublesW + 0.55, 0.052, 0.075], [0, CFG.netH + 0.025, 0], netWhite);
  addCylinder(group, 0.045, 0.052, CFG.netH + 0.36, [-(CFG.doublesW / 2 + 0.22), (CFG.netH + 0.36) / 2, 0], postMat, 22);
  addCylinder(group, 0.045, 0.052, CFG.netH + 0.36, [CFG.doublesW / 2 + 0.22, (CFG.netH + 0.36) / 2, 0], postMat, 22);
  for (let i = -5; i <= 5; i++) addBox(group, [0.012, CFG.netH * 0.92, 0.03], [(i * CFG.doublesW) / 10, CFG.netH * 0.46, 0.018], transparentMaterial(0xffffff, 0.28));
  for (let j = 1; j <= 3; j++) addBox(group, [CFG.doublesW + 0.12, 0.011, 0.032], [0, (j * CFG.netH) / 4, 0.019], transparentMaterial(0xffffff, 0.24));

  return group;
}

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
  const skin = material(0xf0c7a0, 0.78, 0.02);
  const shirt = material(color, 0.74, 0.02);
  const shorts = material(0x20232a, 0.76, 0.02);
  const shoe = material(0xffffff, 0.55, 0.03);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 28, 20), skin);
  head.position.y = 1.62;
  g.add(head);
  addCylinder(g, 0.055, 0.06, 0.12, [0, 1.43, 0], skin, 18);
  const torso = addCylinder(g, 0.24, 0.31, 0.72, [0, 1.04, 0], shirt, 28);
  torso.scale.x = 0.78;
  const hips = addCylinder(g, 0.24, 0.25, 0.24, [0, 0.61, 0], shorts, 22);
  hips.scale.x = 0.9;
  const leftLeg = addCylinder(g, 0.07, 0.085, 0.63, [-0.13, 0.31, 0], shorts, 16);
  const rightLeg = addCylinder(g, 0.07, 0.085, 0.63, [0.13, 0.31, 0], shorts, 16);
  leftLeg.rotation.z = 0.06;
  rightLeg.rotation.z = -0.06;
  addBox(g, [0.23, 0.055, 0.34], [-0.13, 0.035, -0.04], shoe);
  addBox(g, [0.23, 0.055, 0.34], [0.13, 0.035, -0.04], shoe);
  enableShadow(g);
  return g;
}

function createRacket(color: number) {
  const g = new THREE.Group();
  const handleMat = material(0x1d1d1f, 0.55, 0.1);
  const frameMat = material(color, 0.36, 0.45);
  const stringMat = transparentMaterial(0xffffff, 0.5, 0.42);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.42, 16), handleMat);
  handle.position.y = -0.11;
  enableShadow(handle);
  g.add(handle);
  const throatA = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.29, 12), frameMat);
  throatA.position.set(-0.048, 0.22, 0); throatA.rotation.z = -0.18; enableShadow(throatA); g.add(throatA);
  const throatB = throatA.clone(); throatB.position.x *= -1; throatB.rotation.z *= -1; g.add(throatB);
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.019, 12, 52), frameMat);
  head.scale.y = 1.34; head.position.y = 0.56; enableShadow(head); g.add(head);
  const stringPlane = new THREE.Mesh(new THREE.CircleGeometry(0.182, 36), stringMat);
  stringPlane.scale.y = 1.3; stringPlane.position.y = 0.56; g.add(stringPlane);
  for (let i = -3; i <= 3; i++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.48, 0.005), stringMat); v.position.set(i * 0.052, 0.56, 0.007); g.add(v);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.005, 0.005), stringMat); h.position.set(0, 0.56 + i * 0.065, 0.007); g.add(h);
  }
  return g;
}

function findFirstBone(root: THREE.Object3D, tests: string[]) { let found: THREE.Bone | undefined; root.traverse((o) => { if (found) return; const b = o as THREE.Bone; if (!b.isBone) return; const n = b.name.toLowerCase().replace(/[_.\-\s]/g, ""); if (tests.some((t) => n.includes(t))) found = b; }); return found; }
function findHumanBones(model: THREE.Object3D): BonePack { return { spine: findFirstBone(model, ["spine"]), chest: findFirstBone(model, ["chest", "spine2", "upperchest"]), neck: findFirstBone(model, ["neck"]), rightShoulder: findFirstBone(model, ["rightshoulder", "rshoulder"]), rightUpperArm: findFirstBone(model, ["rightarm", "rightupperarm", "rarm", "rupperarm"]), rightForeArm: findFirstBone(model, ["rightforearm", "rightlowerarm", "rforearm", "rlowerarm"]), rightHand: findFirstBone(model, ["righthand", "rhand"]), leftShoulder: findFirstBone(model, ["leftshoulder", "lshoulder"]), leftUpperArm: findFirstBone(model, ["leftarm", "leftupperarm", "larm", "lupperarm"]), leftForeArm: findFirstBone(model, ["leftforearm", "leftlowerarm", "lforearm", "llowerarm"]), leftHand: findFirstBone(model, ["lefthand", "lhand"]), }; }
function captureRestPose(bones: BonePack) { const out: BoneRest[] = []; Object.values(bones).forEach((bone) => { if (bone && !out.some((r) => r.bone === bone)) out.push({ bone, q: bone.quaternion.clone() }); }); return out; }
function makeArmChain(shoulder: THREE.Bone | undefined, upper: THREE.Bone | undefined, fore: THREE.Bone | undefined, hand: THREE.Bone | undefined): ArmChain | undefined { if (!upper || !fore || !hand) return undefined; upper.updateMatrixWorld(true); fore.updateMatrixWorld(true); hand.updateMatrixWorld(true); const a = getWorldPos(upper); const b = getWorldPos(fore); const c = getWorldPos(hand); return { shoulder, upper, fore, hand, upperLen: Math.max(0.05, a.distanceTo(b)), foreLen: Math.max(0.05, b.distanceTo(c)), }; }
function setBoneWorldQuaternion(bone: THREE.Bone, worldQ: THREE.Quaternion) { const parentWorldQ = new THREE.Quaternion(); if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQ); bone.quaternion.copy(parentWorldQ.invert().multiply(worldQ)); }
function rotateBoneSoChildPointsTo(bone: THREE.Bone, child: THREE.Object3D, targetDirWorld: THREE.Vector3) { bone.updateMatrixWorld(true); child.updateMatrixWorld(true); const bonePos = getWorldPos(bone); const childPos = getWorldPos(child); const currentDir = childPos.sub(bonePos).normalize(); const desiredDir = targetDirWorld.clone().normalize(); if (currentDir.lengthSq() < 1e-8 || desiredDir.lengthSq() < 1e-8) return; const delta = new THREE.Quaternion().setFromUnitVectors(currentDir, desiredDir); const currentWorldQ = bone.getWorldQuaternion(new THREE.Quaternion()); setBoneWorldQuaternion(bone, delta.multiply(currentWorldQ)); }
function solveTwoBoneArm(chain: ArmChain | undefined, shoulderTarget: THREE.Vector3, elbowHint: THREE.Vector3, handTarget: THREE.Vector3) {
  if (!chain) return false;
  const { shoulder, upper, fore, hand, upperLen, foreLen } = chain;
  upper.updateMatrixWorld(true); fore.updateMatrixWorld(true); hand.updateMatrixWorld(true);
  const rootPos = getWorldPos(upper); const target = handTarget.clone(); const toTarget = target.clone().sub(rootPos);
  const distRaw = Math.max(0.0001, toTarget.length()); const dist = clamp(distRaw, 0.001, upperLen + foreLen - 0.001); const dir = toTarget.normalize();
  const hintDir = elbowHint.clone().sub(rootPos); let normal = new THREE.Vector3().crossVectors(dir, hintDir).normalize();
  if (normal.lengthSq() < 1e-8) { normal = new THREE.Vector3(0, 1, 0).cross(dir); if (normal.lengthSq() < 1e-8) normal = new THREE.Vector3(1, 0, 0); normal.normalize(); }
  const bendAxis = new THREE.Vector3().crossVectors(normal, dir).normalize(); const a = (upperLen * upperLen - foreLen * foreLen + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, upperLen * upperLen - a * a)); const mid = rootPos.clone().addScaledVector(dir, a);
  const elbowA = mid.clone().addScaledVector(bendAxis, h); const elbowB = mid.clone().addScaledVector(bendAxis, -h);
  const elbow = elbowA.distanceToSquared(elbowHint) < elbowB.distanceToSquared(elbowHint) ? elbowA : elbowB;
  if (shoulder) { shoulder.updateMatrixWorld(true); const shoulderPos = getWorldPos(shoulder); const shoulderDir = shoulderTarget.clone().sub(shoulderPos); if (shoulderDir.lengthSq() > 1e-8) rotateBoneSoChildPointsTo(shoulder, upper, shoulderDir.normalize()); }
  upper.updateMatrixWorld(true); rotateBoneSoChildPointsTo(upper, fore, elbow.clone().sub(getWorldPos(upper)).normalize());
  fore.updateMatrixWorld(true); rotateBoneSoChildPointsTo(fore, hand, target.clone().sub(getWorldPos(fore)).normalize()); hand.updateMatrixWorld(true); return true;
}
function addLocalRotation(bone: THREE.Bone | undefined, x: number, y: number, z: number) { if (!bone) return; bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "XYZ"))); }

// ... kept identical behavior blocks from provided code ...

export default function MobileThreeTennisPrototype() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hud, setHud] = useState<HudState>({ nearScore: 0, farScore: 0, status: "Swipe up to serve", power: 0 });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setClearColor(0x07100c, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x07100c, 12, 21);
    const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 60);
    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x254c3d, 0.7));
    addCourt(scene);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR, 32, 24), new THREE.MeshStandardMaterial({ color: 0xd7ff35 }));
    scene.add(ball);

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      camera.aspect = w / h;
      camera.position.set(0, camera.aspect < 0.72 ? 6.95 : 6.15, camera.aspect < 0.72 ? 8.15 : 7.35);
      camera.lookAt(new THREE.Vector3(0, 0.78, -0.7));
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", resize);
    resize();

    let frame = 0;
    const loop = () => { frame = requestAnimationFrame(loop); renderer.render(scene, camera); };
    loop();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); renderer.dispose(); };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#07100c", touchAction: "none", userSelect: "none" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      </div>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <div style={{ position: "absolute", left: "50%", top: 10, transform: "translateX(-50%)", color: "white", background: "rgba(0,0,0,0.54)", border: "1px solid rgba(255,255,255,0.16)", padding: "9px 13px", borderRadius: 16, fontSize: 13, fontWeight: 800, letterSpacing: 0.2, boxShadow: "0 12px 26px rgba(0,0,0,0.22)", textAlign: "center", minWidth: 174 }}>
          You {hud.nearScore} — {hud.farScore} AI
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.82, marginTop: 2 }}>{hud.status}</div>
        </div>
      </div>
    </div>
  );
}
