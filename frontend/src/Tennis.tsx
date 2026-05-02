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

const CFG = { courtW: 4.18, doublesW: 5.25, courtL: 12.1, serviceLineZ: 2.85, netH: 0.64, ballR: 0.085, gravity: 9.8, airDrag: 0.078, bounceRestitution: 0.74, groundFriction: 0.86, minBallSpeed: 0.12, playerHeight: 1.82, playerSpeed: 5.2, aiSpeed: 4.65, reach: 0.92, swingDuration: 0.42, serveDuration: 0.86, hitWindowStart: 0.42, hitWindowEnd: 0.72, serveContactT: 0.72, playerVisualYawFix: Math.PI };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const sideOfZ = (z: number): PlayerSide => (z >= 0 ? "near" : "far");
const opposite = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");
const material = (color: number, roughness = 0.74, metalness = 0.02) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const transparentMaterial = (color: number, opacity: number, roughness = 0.72) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02, transparent: true, opacity, depthWrite: false });
const enableShadow = (obj: THREE.Object3D) => (obj.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }}), obj);

export default function MobileThreeTennisPrototype() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hud] = useState<HudState>({ nearScore: 0, farScore: 0, status: "Swipe up to serve", power: 0 });
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setClearColor(0x07100c, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 60);
    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x254c3d, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.55); sun.position.set(-4.2, 8.5, 5.2); scene.add(sun);
    const resize = () => { const w = Math.max(1, host.clientWidth); const h = Math.max(1, host.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.position.set(0, 6.15, 7.35); camera.lookAt(new THREE.Vector3(0, 0.78, -0.7)); camera.updateProjectionMatrix(); };
    window.addEventListener("resize", resize); resize();
    const id = requestAnimationFrame(function loop(){ renderer.render(scene, camera); requestAnimationFrame(loop);});
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", resize); renderer.dispose(); };
  }, []);
  return <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#07100c", touchAction: "none", userSelect: "none" }}><div ref={hostRef} style={{ position: "absolute", inset: 0 }}><canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} /></div><div style={{ position: "fixed", inset: 0, pointerEvents: "none", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}><div style={{ position: "absolute", left: "50%", top: 10, transform: "translateX(-50%)", color: "white" }}>You {hud.nearScore} — {hud.farScore} AI</div></div></div>;
}
