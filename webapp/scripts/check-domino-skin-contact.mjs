/** Measure rendered fingertip skin against the finite domino, independently of IK effectors. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as THREE from 'three';
import * as shared from '../src/pages/Games/shared/seatedHumanActors.js';

const { parse } = createRequire(import.meta.url)('@babel/parser');
const testURL = new URL('../src/pages/Games/shared/seatedHumanActors.domino.test.js', import.meta.url);
const source = readFileSync(testURL, 'utf8');
const body = parse(source, { sourceType: 'module' }).program.body;
const env = { THREE, vm, readFileSync, createRequire, URL, ...shared };
for (const name of ['makeActualDominoRig', 'makeProductionHandHarness']) {
  const node = body.find((entry) => entry.type === 'FunctionDeclaration' && entry.id.name === name);
  env[name] = vm.runInNewContext(`(${source.slice(node.start, node.end).replaceAll('import.meta.url', JSON.stringify(testURL.href))})`, env);
}
Object.defineProperty(performance, 'now', { configurable: true, value: () => 0 });
const c = env.makeProductionHandHarness((seat) => env.makeActualDominoRig(seat, true));

function distalSkinSources(rig, digit) {
  const bones = new Set();
  rig[`right${digit}`].at(-1).traverse((bone) => bones.add(bone));
  return rig.skinMeshes.map((mesh) => {
    const indices = [];
    const joints = mesh.geometry.attributes.skinIndex;
    const weights = mesh.geometry.attributes.skinWeight;
    const j = new THREE.Vector4(), w = new THREE.Vector4();
    for (let index = 0; index < joints.count; index++) {
      j.fromBufferAttribute(joints, index); w.fromBufferAttribute(weights, index);
      let influence = 0;
      for (let component = 0; component < 4; component++) {
        if (bones.has(mesh.skeleton.bones[j.getComponent(component)])) influence += w.getComponent(component);
      }
      if (influence >= 0.5) indices.push(index);
    }
    return { mesh, indices };
  }).filter(({ indices }) => indices.length);
}

// Mesh-local dimensions are the real 1 × 2 × .22 domino body. Clamping to all
// three extents avoids mistaking contact with an infinite edge plane for a grip.
function finiteBoxDistance(point, domino) {
  const local = domino.worldToLocal(point.clone());
  const closest = local.clone().clamp(new THREE.Vector3(-0.5, -1, -0.11), new THREE.Vector3(0.5, 1, 0.11));
  const gap = point.distanceTo(domino.localToWorld(closest));
  if (gap > 1e-10) return gap;
  const scale = domino.getWorldScale(new THREE.Vector3());
  return -Math.min((0.5 - Math.abs(local.x)) * scale.x,
    (1 - Math.abs(local.y)) * scale.y, (0.11 - Math.abs(local.z)) * scale.z);
}

function measureDigit(sources, domino) {
  let gap = Infinity, penetration = 0, count = 0, nearest = null, nearestLocal = null;
  for (const { mesh, indices } of sources) {
    mesh.updateWorldMatrix(true, false);
    for (const index of indices) {
      const point = mesh.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      const distance = finiteBoxDistance(point, domino);
      if (Math.max(0, distance) < gap) {
        gap = Math.max(0, distance); nearest = point.toArray(); nearestLocal = domino.worldToLocal(point.clone()).toArray();
      }
      penetration = Math.max(penetration, -distance);
      count++;
    }
  }
  const scale = domino.getWorldScale(new THREE.Vector3()).toArray();
  const gapByTileAxis = nearestLocal?.map((value, axis) => Math.max(0, Math.abs(value) - [0.5, 1, 0.11][axis]) * scale[axis]);
  return { vertices: count, gap, penetration, nearest, nearestLocal, gapByTileAxis };
}

const cases = [];
for (const direction of ['place', 'draw']) for (let seat = 0; seat < 4; seat++) {
  for (const player of c.players) player.hand = Array.from({ length: 7 }, () => ({ a: 2, b: 5 }));
  c.renderHands(); c.dominoHandContacts.clear(); c.poseDominoHands(seat);
  const mesh = c.players[seat].hand[3].mesh;
  c.players[seat].hand[3].mesh = null;
  const board = new THREE.Object3D(), placing = direction === 'place';
  if (placing) c.orientDominoFlat(board, Math.PI / 2); else c.orientDominoFaceDown(board, Math.PI / 2);
  const boardPosition = new THREE.Vector3(0, placing ? c.CHAIN_TILE_Y : c.CLOTH_TOP + 0.006, placing ? 0 : c.CLOTH_RADIUS * 0.45);
  const boardScale = new THREE.Vector3(0.1, 0.016 / 0.22, 0.1).multiplyScalar(c.DOMINO_WORLD_SCALE);
  const anim = {
    mesh, sourceSeat: seat, ...(placing ? { segment: {} } : {}),
    start: (placing ? mesh.position : boardPosition).clone(), end: (placing ? boardPosition : mesh.position).clone(),
    startQuat: (placing ? mesh.quaternion : board.quaternion).clone(), endQuat: (placing ? board.quaternion : mesh.quaternion).clone(),
    startScale: (placing ? mesh.scale : boardScale).clone(), endScale: (placing ? boardScale : mesh.scale).clone(), arc: c.PLACE_ANIM_ARC
  };
  anim.humanReachProfile = c.getDominoHumanReachProfile(anim);
  const rig = c.seatedHumanActors[seat].rig;
  const digits = Object.fromEntries(['Thumb', 'Index'].map((digit) => [digit.toLowerCase(), distalSkinSources(rig, digit)]));
  for (const phase of [0, 0.12, c.PLACE_ANIM_PICK_HOLD, 0.4, 0.7, c.PLACE_ANIM_LOWER_END]) {
    const rotate = c.smoothPlacementStep(c.PLACE_ANIM_LIFT_END, c.PLACE_ANIM_LOWER_END, phase);
    mesh.position.copy(c.resolvePrecisionPlacementPosition(anim, phase));
    mesh.quaternion.slerpQuaternions(anim.startQuat, anim.endQuat, rotate);
    mesh.scale.lerpVectors(anim.startScale, anim.endScale, rotate);
    c.updateSeatedHumanDominoAction(anim, phase);
    if (!phase) continue;
    const measures = Object.fromEntries(Object.entries(digits).map(([digit, sources]) => [digit, measureDigit(sources, mesh)]));
    cases.push({ direction, seat, phase, edge: anim.contactSide, held: phase >= c.PLACE_ANIM_PICK_HOLD,
      solverError: c.handErrors.right, ...measures });
  }
}
const held = cases.filter((entry) => entry.held);
const worstGap = held.flatMap((entry) => ['thumb', 'index'].map((digit) => ({
  direction: entry.direction, seat: entry.seat, phase: entry.phase, digit, gap: entry[digit].gap
}))).sort((a, b) => b.gap - a.gap)[0];
const worstPenetration = held.flatMap((entry) => ['thumb', 'index'].map((digit) => ({
  direction: entry.direction, seat: entry.seat, phase: entry.phase, digit, penetration: entry[digit].penetration
}))).sort((a, b) => b.penetration - a.penetration)[0];
const report = { method: 'Actual distal thumb/index skin vertices against finite 1×2×.22 domino OBB; phase .12 is approach.',
  cases: cases.length, heldCases: held.length, worstGap, worstPenetration, measurements: cases };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, measurements: undefined }, null, 2));
