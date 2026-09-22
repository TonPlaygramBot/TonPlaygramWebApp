import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { POOL_ROYALE_SHOWOOD_PROFILE as PROFILE } from '../webapp/src/config/poolRoyaleShowoodProfile.js';
import { createShowoodTableGeometry, closestPointOnPoolCushion, projectPoolBallFromCushions, raycastPoolCushions, groundShowoodTableLegs } from '../webapp/src/pages/Games/shared/poolRoyaleShowoodGeometry.js';
import { clipGuideTravel } from '../webapp/src/pages/Games/shared/billiardsGuideGeometry.js';

const BALL_R = 0.028575;
const PLAY_W = 0.9906;
const PLAY_H = 1.9812;
const geometry = createShowoodTableGeometry({ playWidth: PLAY_W, playLength: PLAY_H, ballRadius: BALL_R });
const segments = geometry.segments.map(segment => ({ ...segment,
  start: new THREE.Vector2(segment.start.x, segment.start.y),
  end: new THREE.Vector2(segment.end.x, segment.end.y),
  normal: new THREE.Vector2(segment.normal.x, segment.normal.y)
}));
const source = readFileSync(new URL('../webapp/src/pages/Games/PoolRoyale.jsx', import.meta.url), 'utf8');
function liveFunction(name, nextName, bindings) {
  const from = source.indexOf(`function ${name}(`);
  const to = source.indexOf(`function ${nextName}(`, from + 1);
  assert.ok(from >= 0 && to > from);
  return Function(...Object.keys(bindings), `${source.slice(from, to)};return ${name};`)(...Object.values(bindings));
}
const common = { THREE, BALL_R, PLAY_W, PLAY_H, CUSHION_SEGMENTS: segments, SHOWOOD_GEOMETRY: geometry,
  closestPointOnPoolCushion, raycastPoolCushions, clipGuideTravel,
  RAIL_LIMIT_X: geometry.railLimits.x, RAIL_LIMIT_Y: geometry.railLimits.y };
const reflect = liveFunction('reflectRails', 'resolvePoolRoyalPhysicsFrameStep', common);
const target = liveFunction('calcTarget', 'getPoolRoyaleBallParent', common);
const clip = liveFunction('clipPoolGuideEnd', 'calcTarget', common);

test('source nose transform lands all six visible rails at the playable limits', () => {
  assert.equal(geometry.cushionPolygons.length, 6);
  assert.ok(Math.abs(geometry.footprint.width - 1.2954307796) < 1e-7);
  assert.ok(Math.abs(geometry.footprint.length - 2.2856467690) < 1e-7);
  const noses = geometry.segments.filter(segment => segment.type === 'rail');
  assert.equal(new Set(noses.map(segment => segment.polygonId)).size, 6);
  for (const segment of noses) {
    const p = segment.start;
    assert.ok(Math.min(Math.abs(Math.abs(p.x) - PLAY_W / 2), Math.abs(Math.abs(p.y) - PLAY_H / 2)) < 1e-7);
    assert.ok(segment.normal.x * p.x + segment.normal.y * p.y < 0);
  }
});

test('cloth datum, not decorative frame top, places the visible surface under each ball', () => {
  const clothHeight = 13.2;
  const mapped = createShowoodTableGeometry({ playWidth: 64, playLength: 128, ballRadius: 1.55, clothHeight });
  assert.ok(Math.abs(PROFILE.clothY * mapped.fit.scale.y + mapped.fit.position.y - clothHeight) < 1e-12);
  const model = new THREE.Group();
  const fit = liveFunction('fitPoolRoyaleExternalTableModel', 'mountPoolRoyaleExternalTableModel', {
    THREE, SHOWOOD_GEOMETRY: geometry, BALL_R, BALL_CENTER_Y: clothHeight + BALL_R, PLAY_W, PLAY_H, groundShowoodTableLegs, FLOOR_Y: -1, TABLE_Y: 0
  });
  fit(model, { id: 'showood-seven-foot', useReferenceShowoodMapping: true, fitScale: 100 }, {});
  assert.ok(Math.abs(PROFILE.clothY * model.scale.y + model.position.y - clothHeight) < 1e-12);
  assert.equal(model.userData.fittedToPlayfield.sourceSha256, PROFILE.sha256);
});

test('all six pocket approaches remain open in collision, aiming and guide clipping', () => {
  for (const pocket of geometry.pockets) {
    const aim = new THREE.Vector2(Math.sign(pocket.x), pocket.type === 'corner' ? Math.sign(pocket.y) : 0).normalize();
    const origin = new THREE.Vector2(pocket.x, pocket.y).addScaledVector(aim, -0.35);
    const cue = { pos: origin.clone(), active: true, id: 'cue' };
    const result = target(cue, aim, [cue]);
    assert.equal(result.targetBall, null);
    assert.equal(result.railNormal, null);
    assert.ok(Math.abs(result.impact.distanceTo(new THREE.Vector2(pocket.x, pocket.y)) - pocket.radius) < 1e-7);
    const edge = clip(new THREE.Vector3(origin.x, 0, origin.y), new THREE.Vector3(aim.x, 0, aim.y), 5, [], []);
    assert.ok(Math.abs(edge.distanceTo(new THREE.Vector3(origin.x, 0, origin.y)) - result.tHit) < 1e-7);
    const atDrop = { pos: new THREE.Vector2(pocket.x, pocket.y), vel: aim.clone() };
    assert.equal(reflect(atDrop), null);
  }
});

test('live collision and aiming agree on the measured jaws as well as long rails', () => {
  let rails = 0;
  let jaws = 0;
  for (const segment of segments) {
    if (segment.normal.dot(segment.start) >= 0) continue; // outer rail back faces
    const midpoint = segment.start.clone().add(segment.end).multiplyScalar(0.5);
    const origin = midpoint.clone().addScaledVector(segment.normal, BALL_R * 4);
    const direction = segment.normal.clone().negate();
    const hit = raycastPoolCushions(origin, direction, BALL_R, segments, BALL_R * 5);
    if (!hit) continue;
    const before = { pos: origin.clone().addScaledVector(direction, hit.distance - 1e-6), vel: direction.clone() };
    assert.equal(reflect(before), null);
    const after = { pos: origin.clone().addScaledVector(direction, hit.distance + 1e-5), vel: direction.clone() };
    const contact = reflect(after);
    assert.ok(contact, `Expected ${segment.polygonId} ${segment.type} contact`);
    assert.ok(contact.normal.dot(new THREE.Vector2(hit.normal.x, hit.normal.y)) > 0.99);
    assert.ok(after.pos.distanceTo(new THREE.Vector2(hit.point.x, hit.point.y)) < 2e-5);
    if (contact.type === 'rail') rails += 1;
    else jaws += 1;
  }
  assert.ok(rails >= 6);
  assert.ok(jaws >= 16);
});

test('overlap repair preserves velocity and leaves the open side-pocket throat clear', () => {
  const ball = { x: PLAY_W / 2 - BALL_R * 0.7, y: PLAY_H * 0.2 };
  assert.equal(projectPoolBallFromCushions(ball, BALL_R, segments), true);
  assert.ok(Math.abs(ball.x - (PLAY_W / 2 - BALL_R)) < 1e-7);
  const pocket = geometry.pockets[5];
  const throat = { x: (PLAY_W / 2 + pocket.x) / 2, y: pocket.y };
  assert.equal(projectPoolBallFromCushions(throat, BALL_R, segments), false);
});

const assetPath = process.env.SHOWOOD_GLB_PATH || new URL('../webapp/public/models/pool-royale/showood-seven-foot/seven_foot_showood.glb', import.meta.url);
test('measured profile matches every vertex of the actual Showood cushion meshes', {
  skip: !existsSync(assetPath) && !process.env.SHOWOOD_GLB_PATH ? 'Install the pinned GLB or set SHOWOOD_GLB_PATH to run asset measurement' : false
}, () => {
  const bytes = readFileSync(assetPath);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), PROFILE.sha256);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const binaryOffset = 20 + jsonLength + 8;
  let tested = 0;
  for (const node of gltf.nodes) {
    if (!['cushion_long', 'cushion_short'].includes(node.name)) continue;
    const primitive = gltf.meshes[node.mesh].primitives[0];
    const accessor = gltf.accessors[primitive.attributes.POSITION];
    const view = gltf.bufferViews[accessor.bufferView];
    const start = binaryOffset + (view.byteOffset || 0) + (accessor.byteOffset || 0);
    const pointsById = new Map();
    for (let i = 0; i < accessor.count; i += 1) {
      const offset = start + i * (view.byteStride || 12);
      const x = bytes.readFloatLE(offset) + node.translation[0];
      const z = bytes.readFloatLE(offset + 8) + node.translation[2];
      const id = `${node.name}_${node.name === 'cushion_long' ? Number(x > .4953) : 2}${Number(z > -.9906)}`;
      if (!pointsById.has(id)) pointsById.set(id, []);
      pointsById.get(id).push({ x, y: z });
    }
    for (const [id, points] of pointsById) {
      const outline = PROFILE.cushions.find(cushion => cushion.id === id).points;
      for (const vertex of outline) {
        assert.ok(points.some(point => Math.hypot(point.x - vertex[0], point.y - vertex[1]) < 1e-8));
      }
      for (const point of points) {
        for (let i = 0; i < outline.length; i += 1) {
          const a = outline[i], b = outline[(i + 1) % outline.length];
          const signed = (b[0] - a[0]) * (point.y - a[1]) - (b[1] - a[1]) * (point.x - a[0]);
          assert.ok(signed >= -1e-9, `Mesh vertex outside measured ${id} outline`);
        }
        tested += 1;
      }
    }
  }
  assert.ok(tested > 2000);
});

test('actual GLB legs reach the existing floor without moving felt, jaws or foot thickness', {
  skip: !existsSync(assetPath) && !process.env.SHOWOOD_GLB_PATH ? 'Install the pinned GLB or set SHOWOOD_GLB_PATH' : false
}, () => {
  const bytes = readFileSync(assetPath);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const binaryOffset = 20 + jsonLength + 8;
  const model = new THREE.Group();
  for (const node of gltf.nodes) {
    if (!['legs', 'slate', 'cushion_long', 'cushion_short'].includes(node.name)) continue;
    const group = new THREE.Group();
    group.name = node.name;
    group.position.fromArray(node.translation || [0, 0, 0]);
    if (node.rotation) group.quaternion.fromArray(node.rotation);
    if (node.scale) group.scale.fromArray(node.scale);
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const accessor = gltf.accessors[primitive.attributes.POSITION];
      const view = gltf.bufferViews[accessor.bufferView];
      const start = binaryOffset + (view.byteOffset || 0) + (accessor.byteOffset || 0);
      const positions = new Float32Array(accessor.count * 3);
      for (let i = 0; i < accessor.count; i += 1) for (let axis = 0; axis < 3; axis += 1) {
        positions[i * 3 + axis] = bytes.readFloatLE(start + i * (view.byteStride || 12) + axis * 4);
      }
      const buffer = new THREE.BufferGeometry();
      buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mesh = new THREE.Mesh(buffer, new THREE.MeshBasicMaterial());
      mesh.name = gltf.materials[primitive.material].name;
      group.add(mesh);
    }
    model.add(group);
  }
  const map = createShowoodTableGeometry({ playWidth: 54.2510920224, playLength: 108.5021840448, ballRadius: 1.3809368878, clothHeight: 4.2490962789 });
  model.scale.set(map.fit.scale.x, map.fit.scale.y, map.fit.scale.z);
  model.position.set(map.fit.position.x, map.fit.position.y, map.fit.position.z);
  model.updateMatrixWorld(true);
  const legs = model.getObjectByName('legs');
  const slate = model.getObjectByName('slate');
  const cushion = model.getObjectByName('cushion_long');
  const foot = legs.getObjectByName('black_plastic');
  const box = object => new THREE.Box3().setFromObject(object);
  const beforeSlate = box(slate);
  const beforeCushion = box(cushion);
  const beforeFootHeight = box(foot).getSize(new THREE.Vector3()).y;
  const oldLegTop = box(legs).max.y;
  const floor = -42.9616063452;
  assert.ok(box(legs).min.y - floor > 8, 'Regression fixture previously floated more than 8 game units');
  assert.equal(groundShowoodTableLegs(model, floor), true);
  assert.ok(Math.abs(box(legs).min.y - floor) < 1e-8);
  assert.ok(Math.abs(box(legs).max.y - oldLegTop) < 1e-8);
  assert.ok(Math.abs(box(foot).getSize(new THREE.Vector3()).y - beforeFootHeight) < 1e-8);
  assert.deepEqual(box(slate), beforeSlate);
  assert.deepEqual(box(cushion), beforeCushion);
  assert.equal(groundShowoodTableLegs(model, floor), false, 'Grounding is idempotent');
});
