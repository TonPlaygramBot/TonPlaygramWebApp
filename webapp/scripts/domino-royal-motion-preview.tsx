/** Visual motion review. The production game remains DominoRoyalArena.jsx. */
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createRestoredSeatedHumanActor,
  applySeatedHumanPose,
  applySeatedHumanReachPose,
  applySeatedHumanHandTargets
} from '../src/pages/Games/shared/seatedHumanActors.js';
import * as P from './domino-royal-motion-helpers';

declare const __DOMINO_REVIEW_MODEL_GZIP__: string;
type Contact = { position: THREE.Vector3; grip: number; approachDirection: THREE.Vector3; palmNormal: THREE.Vector3; maxArmExtension?: number };
type Engine = { count: (n: number) => void; replay: () => void; place: () => void; draw: () => void; pass: () => void; mute: () => boolean; dispose: () => void };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SIZES = [7, 8, 10, 14, 21];

async function embeddedAvatar() {
  const bytes = Uint8Array.from(atob(__DOMINO_REVIEW_MODEL_GZIP__), (character) => character.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const data = await new Response(stream).arrayBuffer();
  return new Promise<THREE.Group>((resolve, reject) => {
    const loader = new GLTFLoader();
    // Decode embedded textures through image elements, avoiding even blob fetches.
    loader.register((parser) => {
      parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
      return { name: 'DOMINO_EMBEDDED_TEXTURES' };
    });
    loader.parse(data, '', (gltf) => resolve(gltf.scene), reject);
  });
}

function buildReview(host: HTMLDivElement, status: (s: string) => void, loaded: () => void): Engine {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#07100f');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  scene.add(new THREE.HemisphereLight(0xe7eee8, 0x34453a, 1.8));
  const key = new THREE.DirectionalLight(0xffeed2, 3.2);
  key.position.set(2, 8, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, far: 22 });
  key.shadow.bias = -0.001; scene.add(key);
  const rimLight = new THREE.DirectionalLight(0x96cfc7, 1.8);
  rimLight.position.set(-4, 4, -3); scene.add(rimLight);
  const camera = new THREE.PerspectiveCamera(P.CAMERA_FOV, 1, P.CAMERA_NEAR, P.CAMERA_FAR);
  camera.position.copy(P.computeDesiredCameraPosition({ isPortrait: true }));
  camera.lookAt(P.CAMERA_TARGET);
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height, false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix();
    // Review-only framing: preserve every production world anchor and show the
    // actual seated rigs that the close first-person game camera crops out.
    const target = P.CAMERA_TARGET.clone().add(V(0, .3, .15));
    const direction = V(.3, .62, .79).normalize();
    const anchors: THREE.Vector3[] = [];
    for (let seat = 0; seat < 4; seat++) {
      const basis = P.seatBasisForIndex(seat), head = basis.position.clone().addScaledVector(basis.forward, .22); head.y = 2.28;
      for (const side of [-1, 1]) { anchors.push(head.clone().add(V(side * .48, .36, 0))); anchors.push(P.computeHandSlotPosition(seat, side < 0 ? 0 : 6, 7)); }
    }
    for (const x of [-P.TABLE_OUTER_RADIUS, P.TABLE_OUTER_RADIUS]) for (const z of [-P.TABLE_OUTER_RADIUS, P.TABLE_OUTER_RADIUS]) anchors.push(V(x, P.CLOTH_TOP, z));
    for (let distance = 5.5; distance <= 20; distance += .15) {
      camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); camera.updateMatrixWorld(true);
      if (anchors.every((point) => { const ndc = point.clone().project(camera); return Math.abs(ndc.x) <= .92 && Math.abs(ndc.y) <= .91; })) break;
    }
  };
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); resize();
  const wood = new THREE.MeshStandardMaterial({ color: '#352619', roughness: 0.4, metalness: 0.12 });
  const gold = new THREE.MeshStandardMaterial({ color: '#b59959', roughness: 0.35, metalness: 0.72 });
  const green = new THREE.MeshStandardMaterial({ color: '#174838', roughness: 0.96 });
  const chairFabric = new THREE.MeshStandardMaterial({ color: '#23463a', roughness: 0.9 });
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) => {
    const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  };
  // Same production octagon, cloth radius, rail height and chair anchors.
  const top = mesh(new THREE.CylinderGeometry(P.TABLE_OUTER_RADIUS, P.TABLE_OUTER_RADIUS, P.TABLE_TOP_DEPTH, 8), wood, 0, P.CLOTH_TOP - P.TABLE_TOP_DEPTH / 2, 0);
  top.rotation.y = Math.PI / 8; top.scale.x = P.TABLE_LEFT_RIGHT_SHRINK_FACTOR;
  const felt = mesh(new THREE.CylinderGeometry(P.CLOTH_RADIUS, P.CLOTH_RADIUS, 0.014, 8), green, 0, P.CLOTH_TOP + 0.006, 0);
  felt.rotation.y = Math.PI / 8;
  const rail = new THREE.Mesh(new THREE.TorusGeometry(P.TABLE_INNER_RADIUS, 0.018, 5, 8), gold);
  rail.rotation.set(Math.PI / 2, 0, Math.PI / 8); rail.position.y = P.CLOTH_TOP + 0.015; rail.scale.x = P.TABLE_LEFT_RIGHT_SHRINK_FACTOR; scene.add(rail);
  mesh(new THREE.CylinderGeometry(P.TABLE_OUTER_RADIUS * .34, P.TABLE_OUTER_RADIUS * .48, P.TABLE_HEIGHT * .58, 24), wood, 0, P.TABLE_BASE_Y - P.TABLE_HEIGHT * .29, 0);
  const floor = mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#0c211b', roughness: 1 }), 0, -2.15, 0); floor.rotation.x = -Math.PI / 2;
  const chairs: THREE.Group[] = [];
  const actors: Array<any> = [];
  for (let seat = 0; seat < 4; seat++) {
    const chair = new THREE.Group(); chair.position.copy(P.seatBasisForIndex(seat).position); chair.lookAt(V()); scene.add(chair); chairs.push(chair);
    mesh(new RoundedBoxGeometry(P.SEAT_WIDTH, P.SEAT_THICKNESS, P.SEAT_DEPTH, 2, .06), chairFabric, 0, P.STOOL_HEIGHT - P.SEAT_THICKNESS / 2, 0, chair);
    mesh(new RoundedBoxGeometry(P.SEAT_WIDTH, P.BACK_HEIGHT, P.BACK_THICKNESS, 2, .05), chairFabric, 0, P.STOOL_HEIGHT + P.BACK_HEIGHT / 2, -P.SEAT_DEPTH * .45, chair);
    [-1, 1].forEach((side) => mesh(new RoundedBoxGeometry(P.ARM_THICKNESS, P.ARM_THICKNESS, P.ARM_DEPTH, 2, .03), gold, side * P.SEAT_WIDTH * .49, P.STOOL_HEIGHT + P.ARM_HEIGHT, 0, chair));
  }
  const pieces = new THREE.Group(); scene.add(pieces);
  const bodyGeometry = new RoundedBoxGeometry(1, 2, .22, 3, .06);
  const faceGeometry = new THREE.PlaneGeometry(.9, 1.9);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#f7f0d8', roughness: .35, metalness: .04 });
  const faceMaterials: THREE.MeshStandardMaterial[] = [];
  const flatScale = V(P.DOMINO_WORLD_SCALE * .1, P.DOMINO_WORLD_SCALE * .016 / .22, P.DOMINO_WORLD_SCALE * .1);
  const uprightScale = V(P.DOMINO_WORLD_SCALE * .1, P.DOMINO_WORLD_SCALE * .1, P.DOMINO_WORLD_SCALE * .016 / .22);
  const flatQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const backQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  const pipLayouts = [[], [[0, 0]], [[-.23, -.23], [.23, .23]], [[-.23, -.23], [0, 0], [.23, .23]], [[-.23, -.23], [.23, -.23], [-.23, .23], [.23, .23]], [[-.23, -.23], [.23, -.23], [0, 0], [-.23, .23], [.23, .23]], [[-.23, -.26], [.23, -.26], [-.23, 0], [.23, 0], [-.23, .26], [.23, .26]]];
  function faceMaterial(a: number, b: number) {
    const index = a * 7 + b;
    if (faceMaterials[index]) return faceMaterials[index];
    const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 192;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#f4efdc'; ctx.fillRect(0, 0, 96, 192);
    ctx.strokeStyle = '#bba46b'; ctx.lineWidth = 2; ctx.strokeRect(2, 2, 92, 188); ctx.beginPath(); ctx.moveTo(5, 96); ctx.lineTo(91, 96); ctx.stroke();
    ctx.fillStyle = '#17281d';
    [a, b].forEach((value, half) => pipLayouts[value].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(48 + x * 96, 48 + half * 96 + y * 96, 7, 0, Math.PI * 2); ctx.fill(); }));
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    return (faceMaterials[index] = new THREE.MeshStandardMaterial({ map: texture, roughness: .48 }));
  }
  const set: Array<[number, number]> = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) set.push([a, b]);
  function tile(a: number, b: number) {
    const root = new THREE.Group(); const body = new THREE.Mesh(bodyGeometry, bodyMaterial); body.castShadow = true; body.receiveShadow = true; root.add(body);
    const face = new THREE.Mesh(faceGeometry, faceMaterial(a, b)); face.position.z = .111; root.add(face); root.scale.copy(uprightScale); pieces.add(root); return root;
  }
  const racks: THREE.Group[][] = [[], [], [], []];
  let count = 7, stopped = false, animation: any = null, frame = 0, sound = true;
  let audio: AudioContext | null = null;
  const clearPieces = () => { pieces.clear(); racks.forEach((rack) => rack.splice(0)); animation = null; };
  const rackPosition = (seat: number, slot: number, size: number) => P.computeHandSlotPosition(seat, slot, size, { playerCount: 4, human: 0 });
  const rackQuaternion = (seat: number) => {
    const [x, z] = P.layoutSeat(seat);
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, seat === 0 ? 0 : Math.atan2(-x, -z), 0));
  };
  function addToRack(root: THREE.Group, seat: number, index: number, size: number) {
    root.position.copy(rackPosition(seat, index, size)); root.quaternion.copy(rackQuaternion(seat)); root.scale.copy(uprightScale).multiplyScalar(P.getDominoHandScale(seat, size));
    root.userData.animating = false; racks[seat][index] = root;
  }
  function fillRacks() {
    clearPieces();
    for (let seat = 0; seat < 4; seat++) {
      const length = seat === 0 ? count : 7;
      for (let i = 0; i < length; i++) { const value = set[(i * 3 + seat * 7) % set.length]; addToRack(tile(...value), seat, i, length); }
    }
    status(`${count} tiles · ${Math.round(P.getHumanHandCountScale(count) * 100)}% hand size`);
  }
  function contact(root: THREE.Group, side: number, grip = .55): Contact {
    root.updateWorldMatrix(true, false); const rotation = root.getWorldQuaternion(new THREE.Quaternion());
    return { position: root.localToWorld(V(side * .5, -.08, 0)), grip, approachDirection: V(-side, 0, 0).applyQuaternion(rotation), palmNormal: V(0, 0, 1).applyQuaternion(rotation) };
  }
  function pickupContact(root: THREE.Group, edge: number, grip: number): Contact {
    if (edge < 2) return contact(root, edge === 0 ? -1 : 1, grip);
    root.updateWorldMatrix(true, false); const sign = edge === 2 ? -1 : 1, rotation = root.getWorldQuaternion(new THREE.Quaternion());
    return { position: root.localToWorld(V(0, sign, 0)), grip, approachDirection: V(0, -sign, 0).applyQuaternion(rotation), palmNormal: V(0, 0, 1).applyQuaternion(rotation) };
  }
  function rackTargets(seat: number): { left?: Contact; right?: Contact } {
    const visible = racks[seat].filter((root) => root?.parent && !root.userData.animating), rig = actors[seat]?.rig;
    if (!visible.length || !rig) return {};
    const first = contact(visible[0], -1), last = contact(visible[visible.length - 1], 1);
    const left = rig.leftUpperArm.getWorldPosition(V()), right = rig.rightUpperArm.getWorldPosition(V());
    return left.distanceToSquared(first.position) + right.distanceToSquared(last.position) <= left.distanceToSquared(last.position) + right.distanceToSquared(first.position) ? { left: first, right: last } : { left: last, right: first };
  }
  function pose(seat: number, overrides: { left?: Contact; right?: Contact } = {}, mode = 'idle') {
    const rig = actors[seat]?.rig; if (!rig) return;
    const targets = { ...rackTargets(seat), ...overrides };
    applySeatedHumanPose(rig, mode, 1, targets.right?.grip || 0);
    if (targets.right) applySeatedHumanReachPose(rig, 'right', targets.right.position, { ...targets.right, maxLean: THREE.MathUtils.degToRad(mode === 'idle' ? 12 : 88), maxArmExtension: mode === 'idle' ? 1 : 1.35 });
    if (targets.left) targets.left.maxArmExtension = mode === 'idle' ? 1 : 1.35;
    applySeatedHumanHandTargets(rig, targets);
  }
  function unlockAudio() { if (!audio) audio = new AudioContext(); void audio.resume(); }
  function knock() {
    if (!sound || !audio) return;
    // Exact production procedural wood-knock fallback, struck on the contact frame.
    const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * .36), audio.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) { const t = i / audio.sampleRate, strike = Math.exp(-t * 72), body = Math.exp(-t * 14); data[i] = (Math.sin((i + 11) * .22) * strike * .52 + (((Math.sin(i * 12.9898) * 43758.5453) % 1) - .5) * strike * .24 + Math.sin(2 * Math.PI * 128 * t) * body * .46 + Math.sin(2 * Math.PI * 188 * t) * Math.exp(-t * 9.5) * .28 + Math.sin(2 * Math.PI * 64 * t) * Math.exp(-t * 7.5) * .32) * .88; }
    const source = audio.createBufferSource(), gain = audio.createGain(); source.buffer = buffer; gain.gain.value = .5; source.connect(gain).connect(audio.destination); source.start();
  }
  function startTravel(root: THREE.Group, seat: number, end: THREE.Vector3, endQuat: THREE.Quaternion, endScale: THREE.Vector3, duration: number, done?: () => void) {
    root.userData.animating = true;
    animation = { type: 'travel', mesh: root, seat, startTime: performance.now(), duration, start: root.position.clone(), end, startQuat: root.quaternion.clone(), endQuat, startScale: root.scale.clone(), endScale, arc: P.PLACE_ANIM_ARC, handStart: rackTargets(seat).right?.position?.clone(), done };
  }
  function travel(anim: any, now: number) {
    const t = Math.min(1, (now - anim.startTime) / anim.duration), rotate = P.smoothPlacementStep(P.PLACE_ANIM_PICK_HOLD, P.PLACE_ANIM_LOWER_END, t);
    anim.mesh.position.copy(P.resolvePrecisionPlacementPosition(anim, t)); anim.mesh.quaternion.slerpQuaternions(anim.startQuat, anim.endQuat, rotate); anim.mesh.scale.lerpVectors(anim.startScale, anim.endScale, rotate);
    const grip = .4 * (t > P.PLACE_ANIM_LOWER_END ? 1 - P.smoothPlacementStep(P.PLACE_ANIM_LOWER_END, 1, t) : P.smoothPlacementStep(0, P.PLACE_ANIM_PICK_HOLD, t));
    const rig = actors[anim.seat]?.rig;
    if (anim.contactSide == null && rig) {
      const at = anim.duration === P.PLACE_ANIM_DURATION ? 'end' : 'start';
      const reference = anim.mesh.clone(false); reference.position.copy(anim[at]); reference.quaternion.copy(anim[at + 'Quat']); reference.scale.copy(anim[at + 'Scale']); reference.parent = pieces;
      const shoulder = rig.rightUpperArm.getWorldPosition(V());
      anim.contactSide = [0, 1, 2, 3].map((edge) => { const target = pickupContact(reference, edge, grip); return { edge, distance: shoulder.distanceToSquared(target.position.clone().addScaledVector(target.approachDirection, -P.DOMINO_WIDTH * 1.5)) }; }).sort((a, b) => a.distance - b.distance)[0].edge;
    }
    const target = pickupContact(anim.mesh, anim.contactSide ?? 0, grip);
    if (rig) { target.approachDirection.copy(target.position).sub(rig.rightUpperArm.getWorldPosition(V())); target.approachDirection.y = 0; target.approachDirection.normalize(); }
    if (anim.handStart && t < P.PLACE_ANIM_PICK_HOLD) target.position.lerpVectors(anim.handStart, target.position, P.smoothPlacementStep(0, P.PLACE_ANIM_PICK_HOLD, t));
    const rest = rackTargets(anim.seat).right;
    if (rest && t > P.PLACE_ANIM_LOWER_END) target.position.lerp(rest.position, P.smoothPlacementStep(P.PLACE_ANIM_LOWER_END, 1, t));
    pose(anim.seat, { right: target }, t < P.PLACE_ANIM_LIFT_END ? 'gripPiece' : t < P.PLACE_ANIM_CARRY_END ? 'carryPiece' : 'placePiece');
    if (t >= 1) { animation = null; anim.mesh.userData.animating = false; anim.done?.(); }
  }
  function replay() {
    clearPieces(); count = 7;
    const shuffled = [...set];
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    const tiles = shuffled.map((value, i) => {
      const root = tile(...value); root.scale.copy(flatScale); root.quaternion.copy(backQuat);
      const home = V((i % 7 - 3) * P.DOMINO_WIDTH * 1.35, P.CLOTH_TOP + flatScale.z * .11 + .003, (Math.floor(i / 7) - 1.5) * P.DOMINO_LENGTH * 1.28);
      root.position.copy(home); return { root, home, yaw: (Math.random() - .5) * .16 };
    });
    animation = { type: 'shuffle', startTime: performance.now(), tiles };
    status('Mixing 28 face-down dominoes…');
  }
  function deal(tiles: Array<any>, index = 0) {
    if (index >= tiles.length) { status('Ready · try a move or change your hand size'); return; }
    const seat = index % 4, slot = Math.floor(index / 4), root = tiles[index].root;
    status(`Random draw · Player ${seat + 1} · ${index + 1}/28`);
    startTravel(root, seat, rackPosition(seat, slot, 7), rackQuaternion(seat), uprightScale.clone().multiplyScalar(P.getDominoHandScale(seat, 7)), P.OPENING_DEAL_ANIM_DURATION, () => { addToRack(root, seat, slot, 7); deal(tiles, index + 1); });
  }
  function pickPlace() {
    fillRacks(); const seat = 1, root = racks[seat][3];
    status('Pick → lift → carry → place → release');
    startTravel(root, seat, V(P.CLOTH_RADIUS * .52, P.CLOTH_TOP + flatScale.z * .11 + .004, -.1), flatQuat, flatScale.clone(), P.PLACE_ANIM_DURATION, () => { racks[seat].splice(3, 1); racks[seat].forEach((remaining, i) => addToRack(remaining, seat, i, racks[seat].length)); status('Domino placed · fingers released'); });
  }
  function draw() {
    fillRacks(); const seat = 1, value = set[Math.floor(Math.random() * set.length)], root = tile(...value);
    root.position.set(P.CLOTH_RADIUS * .52, P.CLOTH_TOP + flatScale.z * .11 + .004, .2); root.scale.copy(flatScale); root.quaternion.copy(backQuat);
    status('Picking a domino from the table…');
    startTravel(root, seat, rackPosition(seat, 7, 8), rackQuaternion(seat), uprightScale.clone().multiplyScalar(P.getDominoHandScale(seat, 8)), P.DRAW_ANIM_DURATION, () => { addToRack(root, seat, 7, 8); racks[seat].forEach((held, i) => addToRack(held, seat, i, 8)); status('Draw complete · domino joins the hand'); });
  }
  function pass() { fillRacks(); animation = { type: 'knock', startTime: performance.now(), handStart: rackTargets(1).right?.position.clone(), impact: false }; status('Pass · right-hand table knock'); }
  function animate(now: number) {
    if (stopped) return;
    frame = requestAnimationFrame(animate);
    for (let seat = 0; seat < 4; seat++) pose(seat);
    const active = animation;
    if (active?.type === 'travel') travel(active, now);
    if (active?.type === 'shuffle') {
      const t = Math.min(1, (now - active.startTime) / P.OPENING_SHUFFLE_ANIM_DURATION), angle = P.smoothPlacementStep(0, 1, t) * Math.PI * 2;
      active.tiles.forEach((entry: any, i: number) => { const lane = Math.floor(i / 7), sign = lane % 2 ? -1 : 1; entry.root.position.copy(entry.home); entry.root.position.x += Math.sin(angle) * P.DOMINO_WIDTH * .35 * sign; entry.root.position.z += Math.sin(angle * 2) * P.DOMINO_WIDTH * .1; entry.root.quaternion.copy(backQuat).premultiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), entry.yaw + Math.sin(angle) * .08 * sign)); });
      const targets = [active.tiles[6], active.tiles[20]].map((entry: any) => ({ position: entry.root.localToWorld(V(0, 0, -.11)), grip: .12, approachDirection: V(-1, 0, 0), palmNormal: V(0, -1, 0) }));
      pose(1, { left: targets[0], right: targets[1] }, 'reachPiece');
      if (t >= 1) { animation = null; deal(active.tiles); }
    }
    if (active?.type === 'knock') {
      const t = Math.min(1, (now - active.startTime) / P.KNOCK_DURATION), [sx, sz] = P.layoutSeat(1), outward = V(sx, 0, sz).normalize(), right = V(outward.z, 0, -outward.x).negate();
      const point = outward.multiplyScalar(P.CLOTH_RADIUS * .7).addScaledVector(right, P.DOMINO_WIDTH * 1.3);
      point.y = P.CLOTH_TOP + .008 + (t < P.KNOCK_CONTACT_PHASE ? Math.sin(Math.PI * P.smoothPlacementStep(0, P.KNOCK_CONTACT_PHASE, t)) * .085 : Math.sin(Math.PI * P.smoothPlacementStep(P.KNOCK_CONTACT_PHASE, 1, t)) * .035);
      if (active.handStart && t < .18) point.lerpVectors(active.handStart, point, P.smoothPlacementStep(0, .18, t));
      const rest = rackTargets(1).right; if (rest && t > .76) point.lerp(rest.position, P.smoothPlacementStep(.76, 1, t));
      pose(1, { right: { position: point, grip: .9, approachDirection: point.clone().sub(V(sx, point.y, sz)).normalize(), palmNormal: V(0, -1, 0) } }, 'reachPiece');
      if (!active.impact && t >= P.KNOCK_CONTACT_PHASE) { active.impact = true; knock(); }
      if (t >= 1) { animation = null; status('Passed · knock and sound share the contact frame'); }
    }
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(animate);
  embeddedAvatar().then((template) => {
    if (stopped) return;
    const bounds = new THREE.Box3().setFromObject(template), center = bounds.getCenter(V()); template.position.x -= center.x; template.position.z -= center.z; template.position.y -= bounds.min.y;
    template.traverse((object: any) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false; } });
    for (let seat = 0; seat < 4; seat++) actors[seat] = createRestoredSeatedHumanActor(template, chairs[seat], { targetHeight: P.LEGACY_DOMINO_HUMAN_HEIGHT, seatHeight: P.STOOL_HEIGHT, supportsArmrest: true });
    loaded(); replay();
  }).catch((error) => { console.error(error); status('Avatar could not load. Open the complete game preview.'); });
  const action = (run: () => void) => () => { unlockAudio(); run(); };
  return {
    count: (n) => { count = n; fillRacks(); }, replay: action(replay), place: action(pickPlace), draw: action(draw), pass: action(pass),
    mute: () => { sound = !sound; if (sound) unlockAudio(); return sound; },
    dispose: () => { stopped = true; cancelAnimationFrame(frame); resizeObserver.disconnect(); renderer.dispose(); pmrem.dispose(); environment.dispose(); void audio?.close(); scene.traverse((object: any) => { object.geometry?.dispose(); const mats = Array.isArray(object.material) ? object.material : [object.material]; mats.forEach((material: any) => { material?.map?.dispose(); material?.dispose(); }); }); renderer.domElement.remove(); }
  };
}

function MotionReview() {
  const host = useRef<HTMLDivElement>(null), engine = useRef<Engine | null>(null);
  const [status, setStatus] = useState('Loading the original avatar…'), [ready, setReady] = useState(false), [count, setCount] = useState(7), [sound, setSound] = useState(true);
  useEffect(() => {
    try { engine.current = buildReview(host.current!, setStatus, () => setReady(true)); }
    catch (error) { console.error(error); setStatus('WebGL is unavailable in this preview.'); }
    return () => engine.current?.dispose();
  }, []);
  return <main className="motion-review">
    <header><div><strong>DOMINO ROYAL</strong><small>Visual motion preview</small></div><button type="button" aria-label={sound ? 'Mute preview' : 'Unmute preview'} onClick={() => setSound(engine.current?.mute() ?? true)}>{sound ? 'Sound on' : 'Muted'}</button></header>
    <div className="motion-stage" ref={host} />
    <footer>
      <p role="status" aria-live="polite">{status}</p>
      <div className="hand-options" role="group" aria-label="Dominoes in your hand"><span>Your hand</span>{SIZES.map((n) => <button type="button" key={n} disabled={!ready} aria-pressed={count === n} onClick={() => { setCount(n); engine.current?.count(n); }}>{n}</button>)}</div>
      <div className="motion-actions"><button type="button" disabled={!ready} onClick={() => { setCount(7); engine.current?.replay(); }}>↻ Opening</button><button type="button" disabled={!ready} onClick={() => engine.current?.place()}>Pick + place</button><button type="button" disabled={!ready} onClick={() => engine.current?.draw()}>Draw</button><button type="button" disabled={!ready} onClick={() => engine.current?.pass()}>Pass</button></div>
    </footer>
  </main>;
}
createRoot(document.getElementById('domino-royal-motion-root')!).render(<MotionReview />);
