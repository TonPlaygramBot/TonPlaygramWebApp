"use client";

/*
EXPORT SETUP
1) npx create-next-app@latest bowling-game --ts --app
2) cd bowling-game && npm i three
3) Replace app/page.tsx with this file
4) Preview: npm run dev
5) Static export: next.config.js -> const nextConfig={output:"export"}; export default nextConfig;
6) Build: npm run build
Controls: swipe visually upward to throw. Slide left/right while swiping to aim and hook.
Game: fixed player camera, same human character, oak lane, no ball-return mechanism. Ball resets back to player after pins settle.
*/

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

type Act = "idle" | "run" | "throw" | "recover";
type Pin = { g: THREE.Group; p: THREE.Vector3; s: THREE.Vector3; v: THREE.Vector3; tilt: number; axis: THREE.Vector3; down: boolean };
type Ball = { m: THREE.Mesh; p: THREE.Vector3; v: THREE.Vector3; held: boolean; rolling: boolean; hook: number };
type Rig = { body: THREE.Group; fallback: THREE.Group; sh: THREE.Mesh; model: THREE.Object3D | null; p: THREE.Vector3; act: Act; t: number; from: THREE.Vector3; to: THREE.Vector3; cycle: number };
type Frame = { rolls: number[]; marks: string[]; total: number | null };
type Hud = { score: number; last: number; power: number; msg: string };

const C = { y: .08, laneW: 1.56, gutterW: 2.08, startZ: 7.15, stopZ: 4.95, foulZ: 4.55, pinZ: -10.75, backZ: -13.15, ballR: .18, pinR: .17 };
const HUMAN = "https://threejs.org/examples/models/gltf/readyplayer.me.glb";
const WOOD = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/";
const HDRI_PRESETS = [{id:"dancingHall",name:"Dancing Hall",file:"dancing_hall_1k.hdr"},{id:"sepulchralChapelRotunda",name:"Sepulchral Chapel Rotunda",file:"sepulchral_chapel_rotunda_1k.hdr"},{id:"vestibule",name:"Vestibule",file:"vestibule_1k.hdr"}];
const FLOOR_FINISHES = ["Rosewood Veneer 01", "Oak Veneer 01", "Dark Wood", "Wood Table 001"];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const out = (t: number) => 1 - Math.pow(1 - t, 3);

function cast(o: THREE.Object3D) {
  o.traverse(c => {
    const m = c as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
  });
  return o;
}

function box(w: number, h: number, d: number, color: number, rough = .6, metal = 0) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
}

function woodMaterial(loader: THREE.TextureLoader, key = "oak_veneer_01") {
  try {
    const d = loader.load(`${WOOD}${key}/${key}_diff_2k.jpg`);
    const r = loader.load(`${WOOD}${key}/${key}_rough_2k.jpg`);
    const n = loader.load(`${WOOD}${key}/${key}_nor_gl_2k.jpg`);
    [d, r, n].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.05, 8.5); t.anisotropy = 8; });
    d.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshPhysicalMaterial({ map: d, roughnessMap: r, normalMap: n, roughness: .2, clearcoat: 1, clearcoatRoughness: .05 });
  } catch {
    return new THREE.MeshPhysicalMaterial({ color: 0xd3a365, roughness: .25, clearcoat: 1 });
  }
}

function ballTexture() {
  const c = document.createElement("canvas"), x = c.getContext("2d")!;
  c.width = c.height = 512;
  const g = x.createRadialGradient(160, 120, 20, 256, 256, 330);
  g.addColorStop(0, "#9ee7ff"); g.addColorStop(.45, "#2d88ff"); g.addColorStop(1, "#07103b");
  x.fillStyle = g; x.fillRect(0, 0, 512, 512); x.globalAlpha = .2;
  for (let i = 0; i < 24; i++) {
    x.strokeStyle = i % 2 ? "#91f1ff" : "#06112f"; x.lineWidth = 5 + Math.random() * 8;
    x.beginPath(); x.moveTo(Math.random() * 512, Math.random() * 512);
    for (let j = 0; j < 4; j++) x.lineTo(Math.random() * 512, Math.random() * 512);
    x.stroke();
  }
  x.globalAlpha = 1; x.fillStyle = "rgba(0,0,0,.55)";
  [[202, 187, 14], [242, 215, 14], [191, 246, 13]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, Math.PI * 2); x.fill(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function makeBall(): Ball {
  const m = new THREE.Mesh(new THREE.SphereGeometry(C.ballR, 56, 40), new THREE.MeshPhysicalMaterial({ map: ballTexture(), roughness: .08, clearcoat: 1, clearcoatRoughness: .03 }));
  const p = new THREE.Vector3(.36, .92, C.startZ);
  cast(m); m.position.copy(p);
  return { m, p, v: new THREE.Vector3(), held: true, rolling: false, hook: 0 };
}

function makePinMesh() {
  const g = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({ color: 0xfffbf2, roughness: .2, clearcoat: 1 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd72d37, roughness: .28 });
  const raw = [.045,0,.09,.06,.085,.2,.16,.36,.14,.5,.068,.62,.076,.7,.038,.74,0,.74];
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < raw.length; i += 2) pts.push(new THREE.Vector2(raw[i], raw[i + 1]));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 42), white));
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(.082, .072, .035, 40), red);
  stripe.position.y = .615; g.add(stripe);
  return cast(g);
}

function makePins(scene: THREE.Scene) {
  const data = [[0,0],[-.32,-.56],[.32,-.56],[-.64,-1.12],[0,-1.12],[.64,-1.12],[-.96,-1.68],[-.32,-1.68],[.32,-1.68],[.96,-1.68]];
  return data.map(([x, z]) => {
    const g = makePinMesh(), p = new THREE.Vector3(x, C.y + .09, C.pinZ + z);
    g.position.copy(p); scene.add(g);
    return { g, p: p.clone(), s: p.clone(), v: new THREE.Vector3(), tilt: 0, axis: new THREE.Vector3(0, 0, -1), down: false } as Pin;
  });
}

function resetPins(pins: Pin[]) {
  pins.forEach(p => { p.p.copy(p.s); p.v.set(0,0,0); p.tilt = 0; p.axis.set(0,0,-1); p.down = false; p.g.visible = true; p.g.position.copy(p.p); p.g.rotation.set(0,0,0); });
}

const standing = (pins: Pin[]) => pins.filter(p => p.g.visible && !p.down && p.tilt < .58).length;

function normalize(model: THREE.Object3D, h: number) {
  model.rotation.set(0, Math.PI, 0); model.scale.setScalar(1); model.updateMatrixWorld(true);
  let b = new THREE.Box3().setFromObject(model); model.scale.setScalar(h / Math.max(.001, b.max.y - b.min.y));
  model.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(model);
  const c = b.getCenter(new THREE.Vector3()); model.position.add(new THREE.Vector3(-c.x, -b.min.y, -c.z));
}

function fallbackHuman() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xecc5a2, roughness: .82 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xff7a2f, roughness: .72 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x1f232c, roughness: .84 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .56 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(.17, 24, 18), skin); head.position.y = 1.62;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.22, .54, 6, 14), shirt); body.position.y = 1.05;
  g.add(head, body);
  [-.12, .12].forEach(x => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.07, .52, 4, 10), pants); leg.position.set(x, .35, 0); g.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.18, .06, .28), shoe); foot.position.set(x, .03, -.02); g.add(foot);
  });
  [-.32, .32].forEach((x, i) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.055, .42, 4, 10), skin); arm.position.set(x, 1.16, i ? .06 : 0); arm.rotation.z = i ? -.18 : .22; g.add(arm);
  });
  return cast(g);
}

function makeRig(scene: THREE.Scene): Rig {
  const p = new THREE.Vector3(0, C.y, C.startZ), body = new THREE.Group(), fallback = fallbackHuman();
  const sh = new THREE.Mesh(new THREE.CircleGeometry(.34, 32), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .18, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; body.position.copy(p); body.add(fallback); sh.position.set(p.x, C.y + .01, p.z); scene.add(body, sh);
  const rig: Rig = { body, fallback, sh, model: null, p: p.clone(), act: "idle", t: 0, from: p.clone(), to: p.clone(), cycle: 0 };
  new GLTFLoader().setCrossOrigin("anonymous").load(HUMAN, gltf => { normalize(gltf.scene, 1.82); cast(gltf.scene); rig.model = gltf.scene; fallback.visible = false; body.add(gltf.scene); }, undefined, () => fallback.visible = true);
  return rig;
}

function heldPos(r: Rig) {
  let v = new THREE.Vector3(.34, .94, .16);
  if (r.act === "run") { const s = Math.sin(r.cycle); v.set(.36, .82 + Math.abs(s) * .05, .14 + s * .09); }
  if (r.act === "throw") {
    const t = clamp(r.t, 0, 1);
    if (t < .38) { const k = smooth(t / .38); v.set(lerp(.34,.44,k), lerp(.86,.55,k), lerp(.16,-.68,k)); }
    else if (t < .56) { const k = smooth((t - .38) / .18); v.set(lerp(.44,.22,k), lerp(.55,.42,k), lerp(-.68,1.24,k)); }
    else { const k = out((t - .56) / .44); v.set(lerp(.22,.16,k), lerp(.42,1.42,k), lerp(1.24,.48,k)); }
  }
  return v.add(r.p);
}

function updateRig(r: Rig, b: Ball, dt: number) {
  if (r.act === "run") {
    r.t = clamp(r.t + dt / .56, 0, 1); r.cycle += dt * 16.8; r.p.lerpVectors(r.from, r.to, smooth(r.t));
    if (r.model) { r.model.position.y = Math.abs(Math.sin(r.cycle)) * .046; r.model.rotation.x = .035; r.model.rotation.z = Math.sin(r.cycle) * .02; }
    if (r.t >= 1) { r.act = "throw"; r.t = .001; }
  } else if (r.act === "throw") {
    r.t += dt / .9;
    if (r.model) { const t = clamp(r.t, 0, 1); r.model.rotation.x = t < .55 ? lerp(0,.18,t/.55) : lerp(.18,-.05,(t-.55)/.45); r.model.rotation.z = t < .45 ? lerp(0,-.04,t/.45) : lerp(-.04,.02,(t-.45)/.55); }
    if (r.t >= 1) { r.act = "recover"; r.t = .001; }
  } else if (r.act === "recover") {
    r.t += dt / .28; if (r.model) { r.model.rotation.x = lerp(-.05, 0, clamp(r.t,0,1)); r.model.rotation.z *= .82; }
    if (r.t >= 1) { r.act = "idle"; r.t = 0; }
  } else if (r.model) { r.model.position.y *= .82; r.model.rotation.x *= .82; r.model.rotation.z *= .82; }
  r.body.position.copy(r.p); r.body.rotation.y = 0; r.sh.position.set(r.p.x, C.y + .01, r.p.z);
  if (b.held) { b.p.copy(heldPos(r)); b.m.position.copy(b.p); }
}

function buildLane(scene: THREE.Scene, floorKey: string) {
  const g = new THREE.Group(), w = woodMaterial(new THREE.TextureLoader(), floorKey); scene.add(g);
  const floor = box(8.8,.18,31.5,0x080a0e,.9); floor.position.set(0,-.12,-3.4); g.add(floor);
  const lane = new THREE.Mesh(new THREE.BoxGeometry(C.laneW*2,.08,19.25), w); lane.position.set(0,C.y,-4.05); g.add(lane);
  const approach = new THREE.Mesh(new THREE.BoxGeometry(4.85,.08,4.55), w); approach.position.set(0,C.y,7.35); g.add(approach);
  const oil = new THREE.Mesh(new THREE.PlaneGeometry(C.laneW*2-.08,13.25), new THREE.MeshPhysicalMaterial({ color:0xffffff, transparent:true, opacity:.105, roughness:.035, clearcoat:1 }));
  oil.rotation.x = -Math.PI / 2; oil.position.set(0, C.y + .047, -2.62); g.add(oil);
  for (const sx of [-1, 1]) {
    const gut = box(.48,.16,19.7,0x202b36,.42,.25); gut.position.set(sx*1.9,C.y-.01,-4.1); g.add(gut);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(.09,.18,19.9), w); rail.position.set(sx*2.2,C.y+.06,-4.1); g.add(rail);
    const led = new THREE.Mesh(new THREE.BoxGeometry(.035,.02,18.7), new THREE.MeshBasicMaterial({ color:0x68d7ff, transparent:true, opacity:.35 })); led.position.set(sx*1.61,C.y+.085,-4.1); g.add(led);
  }
  const foul = box(3.58,.025,.06,0xffffff,.35); foul.position.set(0,C.y+.075,C.foulZ); g.add(foul);
  for (let i=-3;i<=3;i++) { const s = new THREE.Shape(); s.moveTo(0,.24); s.lineTo(-.11,-.16); s.lineTo(.11,-.16); s.closePath(); const a = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshStandardMaterial({color:0x12395e,roughness:.5})); a.rotation.x=-Math.PI/2; a.position.set(i*.34,C.y+.018,.95-Math.abs(i)*.08); g.add(a); }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.15,.15,2.25), w); deck.position.set(0,C.y+.02,C.pinZ-.85); g.add(deck);
  const pit = box(4.85,.58,1.35,0x06080b,.9); pit.position.set(0,-.08,-12.35); g.add(pit);
  const curtain = box(4.7,1.35,.12,0x0a0b0d,.86); curtain.position.set(0,.8,-13.07); g.add(curtain);
  const pinsetter = box(4.9,.44,1.05,0x202936,.36,.6); pinsetter.position.set(0,1.15,-12.8); g.add(pinsetter);
  for (let i=0;i<7;i++) { const p = box(1.05,.03,.55,0xd9f4ff,.2); p.position.set(i%2?-1.25:1.25,3.24,lerp(7.2,-11.2,i/6)); g.add(p); }
  cast(g);
}

function updatePins(pins: Pin[], b: Ball, dt: number) {
  let moving = false;
  if (b.rolling && Math.abs(b.p.x) < C.laneW + .1) for (const p of pins) {
    if (!p.g.visible) continue;
    const dx = p.p.x - b.p.x, dz = p.p.z - b.p.z, d = Math.hypot(dx, dz);
    if (d < C.ballR + C.pinR && d > .001) {
      const n = new THREE.Vector3(dx/d,0,dz/d), s = Math.hypot(b.v.x,b.v.z), imp = Math.max(1, s*.78);
      p.v.addScaledVector(n, imp); p.v.z += b.v.z * .18; p.axis.copy(n); p.down = true; b.v.addScaledVector(n, -.6); b.v.multiplyScalar(.92);
    }
  }
  for (let i=0;i<pins.length;i++) for (let j=i+1;j<pins.length;j++) {
    const a = pins[i], c = pins[j]; if (!a.g.visible || !c.g.visible) continue;
    const dx = c.p.x - a.p.x, dz = c.p.z - a.p.z, d = Math.hypot(dx, dz);
    if (d < C.pinR * 1.8 && d > .001) { const n = new THREE.Vector3(dx/d,0,dz/d); a.v.addScaledVector(n,-.45); c.v.addScaledVector(n,.45); a.down = c.down = true; a.axis.copy(n).multiplyScalar(-1); c.axis.copy(n); }
  }
  for (const p of pins) {
    if (!p.g.visible) continue;
    const s = Math.hypot(p.v.x, p.v.z); if (s > .015 || p.tilt > .015) moving = true;
    p.p.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.exp(-2.05 * dt));
    if (p.down || s > .28) p.tilt = clamp(p.tilt + (s * 1.2 + .7) * dt, 0, 1.46);
    if (Math.abs(p.p.x) > 2.35 || p.p.z < C.backZ - .25 || p.p.z > C.pinZ + 1.15) p.g.visible = false;
    p.g.position.copy(p.p); const d = p.axis.lengthSq() > .001 ? p.axis : new THREE.Vector3(0,0,-1); p.g.rotation.x = d.z * p.tilt; p.g.rotation.z = -d.x * p.tilt;
  }
  return moving;
}

function updateBall(b: Ball, pins: Pin[], dt: number) {
  if (!b.rolling) return false;
  const sp = Math.hypot(b.v.x,b.v.z), gutter = Math.abs(b.p.x) > C.laneW;
  if (!gutter && sp > .85 && b.p.z < 2.6) b.v.x += b.hook * clamp((2.4 - b.p.z) / 8.4, 0, 1) * dt;
  b.v.multiplyScalar(Math.exp((gutter ? -1.24 : -.4) * dt)); b.p.addScaledVector(b.v, dt); b.p.x = clamp(b.p.x, -C.gutterW, C.gutterW);
  b.p.y = C.y + C.ballR + (gutter ? -.08 : .02); b.m.position.copy(b.p);
  if (sp > .02) b.m.rotateOnWorldAxis(new THREE.Vector3(b.v.z,0,-b.v.x).normalize(), sp / C.ballR * dt);
  updatePins(pins, b, dt);
  if (b.p.z <= C.backZ + .45 || sp < .12) { b.rolling = false; b.v.set(0,0,0); return false; }
  return true;
}

function release(b: Ball, intent: { releaseX: number; targetX: number; speed: number; hook: number }) {
  const p = new THREE.Vector3(intent.releaseX, C.y + C.ballR + .02, C.foulZ - .16);
  const t = new THREE.Vector3(intent.targetX, C.y + C.ballR + .02, C.pinZ + .4);
  b.held = false; b.rolling = true; b.hook = intent.hook; b.p.copy(p); b.v.copy(t.sub(p).normalize().multiplyScalar(intent.speed)); b.m.position.copy(b.p);
}

function Stat({ n, v }: { n: string; v: string | number }) {
  return <div style={{padding:"6px 8px",border:"1px solid rgba(255,255,255,.15)",borderRadius:12,background:"rgba(255,255,255,.07)"}}><div style={{fontSize:10,opacity:.65,fontWeight:800}}>{n}</div><div style={{fontSize:16,fontWeight:950,color:"#7be2ff"}}>{v}</div></div>;
}

export default function BowlingGame() {
  const host = useRef<HTMLDivElement | null>(null), canvas = useRef<HTMLCanvasElement | null>(null);
  const [hud, setHud] = useState<Hud>({ power: 0, score: 0, last: 0, msg: "Swipe up to bowl" });
  const [menuOpen, setMenuOpen] = useState(false);
  const [graphics, setGraphics] = useState("High");
  const [inventory, setInventory] = useState<string[]>([]);
  const [floor, setFloor] = useState("oak_veneer_01");
  const [activeHdri, setActiveHdri] = useState("dancingHall");
  const [frames, setFrames] = useState<Frame[]>(Array.from({length:10}, () => ({rolls:[], marks:[], total:null})));


  useEffect(() => {
    const invRaw = localStorage.getItem("tonplaygram:bowlingInventory:v1");
    const acc = localStorage.getItem("accountId") || "guest";
    const inv = invRaw ? JSON.parse(invRaw) : {};
    const owned = inv?.[acc] || { environmentHdri:["dancingHall"], floorFinish:["oakVeneer01"] };
    setInventory([...(owned.environmentHdri||[]), ...(owned.floorFinish||[])]);
    if (owned.environmentHdri?.[0]) setActiveHdri(owned.environmentHdri[0]);
  }, []);

  useEffect(() => {
    if (!host.current || !canvas.current) return;
    const renderer = new THREE.WebGLRenderer({ canvas: canvas.current, antialias: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x07090d); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x07090d); scene.fog = new THREE.Fog(0x07090d, 18, 39);
    const draco = new DRACOLoader(); draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    const ktx2 = new KTX2Loader(); ktx2.setTranscoderPath("https://unpkg.com/three@0.169.0/examples/jsm/libs/basis/").detectSupport(renderer);
    const hdri = HDRI_PRESETS.find(h=>h.id===activeHdri);
    if (hdri) new RGBELoader().load(`https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/${hdri.file}`, (tex)=>{ tex.mapping = THREE.EquirectangularReflectionMapping; scene.environment = tex; scene.background = tex; scene.fog = null as any; });
    const cam = new THREE.PerspectiveCamera(52, 1, .05, 80); cam.position.set(0, 2.9, 10.8); cam.lookAt(0, C.y + .74, -2.6);
    scene.add(new THREE.HemisphereLight(0xcceaff, 0x130b06, .82));
    const key = new THREE.DirectionalLight(0xffffff, 1.55); key.position.set(-4.5, 7.5, 7.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); scene.add(key);
    for (let i=0;i<6;i++) { const l = new THREE.PointLight(i%2 ? 0xffefdc : 0x78dcff, .46, 10.8, 1.9); l.position.set(i%2 ? -1.12 : 1.12, 2.8, lerp(6.5,-11.7,i/5)); scene.add(l); }
    buildLane(scene, floor);
    const pins = makePins(scene), rig = makeRig(scene), ball = makeBall(); scene.add(ball.m);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(.24, 32), new THREE.MeshBasicMaterial({ color:0, transparent:true, opacity:.22, depthWrite:false })); sh.rotation.x = -Math.PI / 2; scene.add(sh);
    const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const aimLine = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color:0x8bd7ff, transparent:true, opacity:.85 })); aimLine.visible = false; scene.add(aimLine);
    const mark = new THREE.Mesh(new THREE.RingGeometry(.24,.31,36), new THREE.MeshBasicMaterial({ color:0x8bd7ff, transparent:true, opacity:.72, side:THREE.DoubleSide })); mark.rotation.x = -Math.PI / 2; mark.visible = false; scene.add(mark);

    let sx=0, sy=0, active=false, id:number|null=null, power=0, intent:any=null, pending:any=null, before=10, movingWas=false, settle=0, shot=false, score=0, lastHit=0;
    const calc = (x:number,y:number) => { const w=host.current!.clientWidth, h=host.current!.clientHeight, screen=clamp(x/w*2-1,-1,1), drag=clamp((x-sx)/Math.max(90,w*.18),-1,1); power=clamp((sy-y)/Math.max(180,h*.38),0,1); return { power, releaseX:clamp(screen*.84,-.96,.96), targetX:clamp(screen*1.04,-1.1,1.1), hook:drag*lerp(.08,.76,power), speed:lerp(6.2,16.4,out(power)) }; };
    const showAim = (it:any) => { aimLine.visible = mark.visible = !!it; if (!it) return; const a=lineGeo.getAttribute("position") as THREE.BufferAttribute; const z=.95+lerp(2.4,-.4,it.power); a.setXYZ(0,it.releaseX,C.y+.1,C.foulZ-.18); a.setXYZ(1,it.targetX,C.y+.1,z); a.needsUpdate=true; mark.position.set(it.targetX,C.y+.11,z); setHud(h=>({...h,power:it.power,msg:"Aim left/right, swipe upward"})); };
    const reset = () => { rig.act="idle"; rig.t=0; rig.p.set(0,C.y,C.startZ); rig.from.copy(rig.p); rig.to.copy(rig.p); ball.held=true; ball.rolling=false; ball.v.set(0,0,0); ball.p.copy(heldPos(rig)); ball.m.position.copy(ball.p); resetPins(pins); movingWas=false; settle=0; shot=false; setHud(h=>({...h,power:0,score,last:lastHit,msg:"Ball returned to player. Swipe again."})); };
    const down = (e:PointerEvent) => { if(active || ball.rolling || rig.act!=="idle") return; canvas.current!.setPointerCapture(e.pointerId); active=true; id=e.pointerId; sx=e.clientX; sy=e.clientY; intent=calc(e.clientX,e.clientY); showAim(intent); };
    const move = (e:PointerEvent) => { if(!active || id!==e.pointerId) return; intent=calc(e.clientX,e.clientY); showAim(intent); };
    const up = (e:PointerEvent) => { if(!active || id!==e.pointerId) return; try{canvas.current!.releasePointerCapture(e.pointerId)}catch{} active=false; id=null; aimLine.visible=mark.visible=false; intent=calc(e.clientX,e.clientY); if(intent.power<.05){setHud(h=>({...h,power:0,msg:"Swipe higher for power"}));return} pending=intent; rig.act="run"; rig.t=0; rig.from.copy(rig.p); rig.to.set(clamp(intent.releaseX*.34,-.4,.4),C.y,C.stopZ); setHud(h=>({...h,power:0,msg:"Running to the line"})); };
    const resize = () => { const w=host.current!.clientWidth,h=host.current!.clientHeight; renderer.setPixelRatio(Math.min(2,devicePixelRatio||1)); renderer.setSize(w,h,false); cam.aspect=w/h; cam.fov=cam.aspect<.72?52:46; cam.updateProjectionMatrix(); cam.position.set(0,2.9,10.8); cam.lookAt(0,C.y+.74,-2.6); };
    canvas.current.addEventListener("pointerdown",down); canvas.current.addEventListener("pointermove",move); canvas.current.addEventListener("pointerup",up); canvas.current.addEventListener("pointercancel",up); window.addEventListener("resize",resize); resize();

    let frame=0, prev=performance.now();
    function loop(){
      frame=requestAnimationFrame(loop); const now=performance.now(), dt=Math.min(.033,(now-prev)/1000); prev=now;
      updateRig(rig,ball,dt);
      if(rig.act==="throw" && pending && rig.t>=.56 && ball.held){ before=standing(pins); release(ball,pending); pending=null; setHud(h=>({...h,msg:"Ball rolling"})); }
      updateBall(ball,pins,dt); const moving=updatePins(pins,ball,dt); if(moving) movingWas=true;
      if(!shot && !ball.rolling && movingWas && !moving){ settle+=dt; if(settle>.72){ lastHit=clamp(before-standing(pins),0,10); score+=lastHit; shot=true; setHud(h=>({...h,score,last:lastHit,msg:`Knocked ${lastHit} pins`}));
        setFrames(prev => {
          const next = prev.map(f=>({...f, rolls:[...f.rolls], marks:[...f.marks]}));
          const fi = next.findIndex(f => f.rolls.length < 2);
          if (fi >= 0) {
            const f = next[fi];
            const pinLeft = f.rolls[0] == null ? 10 : Math.max(0, 10 - f.rolls[0]);
            const pinsHit = Math.min(lastHit, pinLeft);
            f.rolls.push(pinsHit);
            if (f.rolls.length === 1 && pinsHit === 10) { f.marks = ["X"]; }
            else if (f.rolls.length === 2 && (f.rolls[0] + f.rolls[1] === 10)) { f.marks = [String(f.rolls[0]), "/"]; }
            else { f.marks = f.rolls.map(String); }
            if (f.rolls.length === 2 || f.rolls[0] === 10) f.total = (f.rolls[0]||0)+(f.rolls[1]||0);
          }
          return next;
        });
        setTimeout(reset,700); } } else if(moving) settle=0;
      sh.visible=ball.m.visible; sh.position.set(ball.p.x,C.y+.01,ball.p.z); cam.position.set(0,2.9,10.8); cam.lookAt(0,C.y+.74,-2.6); renderer.render(scene,cam);
    }
    loop();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize",resize); renderer.dispose(); };
  }, []);

  return <div style={{position:"fixed",inset:0,overflow:"hidden",background:"#07090d",touchAction:"none",userSelect:"none"}}>
    <div ref={host} style={{position:"absolute",inset:0}}><canvas ref={canvas} style={{width:"100%",height:"100%",display:"block",touchAction:"none"}} /></div>
    <div style={{position:"fixed",inset:0,pointerEvents:"none",fontFamily:"system-ui,-apple-system,sans-serif",color:"white"}}>
      <button onClick={()=>setMenuOpen(v=>!v)} style={{position:"absolute",left:12,top:12,pointerEvents:"auto",width:42,height:42,borderRadius:12,border:"1px solid rgba(255,255,255,.35)",background:"rgba(7,12,19,.7)",color:"white",fontSize:22}}>☰</button>
      <div style={{position:"absolute",left:62,right:12,top:10,padding:"8px 10px",borderRadius:12,background:"rgba(6,8,11,.78)",border:"1px solid rgba(255,255,255,.2)"}}>
        <div style={{display:"grid",gridTemplateColumns:"120px repeat(10,1fr)",gap:6,alignItems:"center",fontSize:11}}>
          <div style={{fontWeight:900}}>🎳 PLAYER_01</div>
          {frames.map((f,i)=><div key={i} style={{textAlign:"center",border:"1px solid rgba(255,255,255,.18)",borderRadius:6,padding:"2px 0"}}>{f.marks.join(" ") || "-"}</div>)}
        </div>
      </div>
      {menuOpen && <div style={{position:"absolute",left:12,top:62,width:300,padding:12,pointerEvents:"auto",borderRadius:12,background:"rgba(6,9,14,.9)",border:"1px solid rgba(123,226,255,.3)"}}>
        <div style={{fontWeight:900,marginBottom:8}}>Game Menu</div>
        <div style={{fontSize:12,opacity:.9,marginBottom:6}}>Graphics</div>
        <div style={{display:"flex",gap:6,marginBottom:10}}>{["Low","Medium","High"].map(g=><button key={g} onClick={()=>setGraphics(g)} style={{padding:"4px 8px",borderRadius:8,border:"1px solid #4a6",background:graphics===g?"#2b6":"#122",color:"white"}}>{g}</button>)}</div>
        <div style={{fontSize:12,opacity:.9}}>Owned inventory</div>
        <ul style={{margin:"4px 0 10px 18px",padding:0}}>{inventory.map(it=><li key={it}>{it}</li>)}</ul>
        <div style={{fontSize:12,opacity:.9}}>Store HDRIs</div>
        <ul style={{margin:"4px 0 10px 18px",padding:0}}>{HDRI_PRESETS.map(it=><li key={it}>{it}</li>)}</ul>
        <div style={{fontSize:12,opacity:.9}}>Store floor finishes</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>{FLOOR_FINISHES.map(it=><button key={it} style={{padding:6,borderRadius:8,border:"1px solid rgba(255,255,255,.2)",background:"#132",color:"#fff",fontSize:11}}>{it}</button>)}</div>
      </div>}
    </div>
  </div>;
}
