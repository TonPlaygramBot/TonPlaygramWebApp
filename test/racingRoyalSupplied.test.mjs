import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { tireBarrierLayout, addTireBarriers, addCurvedCurbs, TIRE_CENTERS, TIRE_RADIUS } from '../webapp/src/games/kartroyale/suppliedTrackGeometry.mjs';
import { disposeRacingResources } from '../webapp/src/games/kartroyale/suppliedRuntimeResources.mjs';

const require = createRequire(new URL('../webapp/package.json', import.meta.url));
const THREE = require('three');
const { parse } = require('@babel/parser');
const actual = readFileSync(new URL('../webapp/src/games/kartroyale/SuppliedRacingRoyal.tsx', import.meta.url), 'utf8');
const original = readFileSync(new URL('./fixtures/racingRoyalSupplied-20260910.tsx', import.meta.url), 'utf8');
function declarations(source) {
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  return new Map(ast.program.body.flatMap(node => {
    if (node.type === 'FunctionDeclaration') return [[node.id.name, source.slice(node.start, node.end)]];
    if (node.type === 'VariableDeclaration') return node.declarations.map(d => [d.id.name, `const ${source.slice(d.start, d.end)};`]);
    return [];
  }));
}
const supplied = declarations(original), implementation = declarations(actual);
const allowed = new Set(['buildTrack', 'makeFlatTireStack']);
test('reference file is byte-identical to the attachment', () => {
  assert.equal(createHash('sha256').update(original).digest('hex'), '1fd6efae1b9d61e049e98660e3154854191f010bb916ad60aee3ce55a23a783c');
});
test('asset catalogs, track and gameplay match the attachment except the screen-right sign correction', () => {
  for (const [name, code] of supplied) {
    const expected = name === 'updateVehicle'
      ? code.replace('v.targetLane + steerInput * dt * 3.5', 'v.targetLane - steerInput * dt * 3.5')
      : code;
    if (!allowed.has(name)) assert.equal(implementation.get(name), expected, name);
  }
});
const names = ['TRACK', 'UP', 'TAU', 'clamp', 'lerp', 'wrap01', 'fwd', 'yawFrom', 'dAng', 'mats', 'makeTrack', 'frame', 'point', 'near', 'shadows', 'makeFlatTireStack', 'updateVehicle', 'createVehicleGroup', 'addWeaponToInventory', 'chooseSelected', 'getSelectedWeapon', 'projectileStyle', 'spawnShot', 'updateShots', 'createExplosion'];
let elapsedMs = 1000;
const helpers = runInNewContext(names.map(n => implementation.get(n)).join('\n') + '\n({mats,makeTrack,frame,point,makeFlatTireStack,updateVehicle,createVehicleGroup,addWeaponToInventory,chooseSelected,getSelectedWeapon,spawnShot,updateShots})', { THREE, TIRE_CENTERS, performance: { now: () => elapsedMs } });
const track = helpers.makeTrack();
const layout = tireBarrierLayout(track, helpers.frame);
const denseCenterline = Array.from({ length: 8192 }, (_, i) => track.curve.getPointAt(i / 8192));
function tireCenter(stack, center) {
  const [x, y, z] = center, c = Math.cos(stack.yaw), s = Math.sin(stack.yaw);
  return { x: stack.x + x * c + z * s, y: stack.y + y, z: stack.z - x * s + z * c };
}
test('individual flat tires do not intersect within each stack tier', () => {
  TIRE_CENTERS.forEach((a, i) => TIRE_CENTERS.slice(i + 1).forEach(b => {
    if (Math.abs(a[1] - b[1]) < .159) assert.ok(Math.hypot(a[0] - b[0], a[2] - b[2]) >= 2 * TIRE_RADIUS);
  }));
});
test('both tire rows follow exact offset curves and tangent alignment without yaw jitter', () => {
  for (const stack of layout) {
    const fr = helpers.frame(track, stack.t), lane = stack.side * (track.width / 2 + 1.55);
    assert.ok(Math.abs(stack.x - fr.center.x - fr.right.x * lane) < 1e-8);
    assert.ok(Math.abs(stack.z - fr.center.z - fr.right.z * lane) < 1e-8);
    assert.ok(Math.abs(Math.cos(stack.yaw) * fr.tangent.x - Math.sin(stack.yaw) * fr.tangent.z) > .9999);
  }
});
test('inside and outside rows have independently uniform spacing including the closing seam', () => {
  const counts = [];
  for (const side of [-1, 1]) {
    const row = layout.filter(s => s.side === side); counts.push(row.length);
    for (let i = 0; i < row.length; i++) {
      const current = row[i], next = row[(i + 1) % row.length];
      const arcGap = (next.distance - current.distance + current.edgeLength) % current.edgeLength;
      assert.ok(Math.abs(arcGap - current.spacing) < 1e-8);
      assert.ok(Math.abs(Math.hypot(next.x - current.x, next.z - current.z) - current.spacing) < .03);
    }
  }
  assert.notEqual(counts[0], counts[1], 'inside and outside need different counts');
});
test('all tires stay outside the full asphalt and shoulder, including the apexes', () => {
  for (const stack of layout) for (const local of TIRE_CENTERS) {
    const p = tireCenter(stack, local);
    const distance = Math.sqrt(Math.min(...denseCenterline.map(c => (c.x - p.x) ** 2 + (c.z - p.z) ** 2)));
    assert.ok(distance - TIRE_RADIUS >= track.width / 2 + .6, `tire intersects shoulder at t=${stack.t}`);
  }
});
test('neighboring tire stacks do not collide around turns or across the closing seam', () => {
  for (const side of [-1, 1]) {
    const row = layout.filter(s => s.side === side);
    for (let i = 0; i < row.length; i++) {
      for (const a of TIRE_CENTERS) for (const b of TIRE_CENTERS) {
        if (Math.abs(a[1] - b[1]) > .159) continue;
        const p = tireCenter(row[i], a), q = tireCenter(row[(i + 1) % row.length], b);
        assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= 2 * TIRE_RADIUS, `overlap at ${side}/${i}`);
      }
    }
  }
});
test('curb endpoints close and remain on the same sampled road edge', () => {
  const scene = new THREE.Scene(), curbs = addCurvedCurbs(scene, track, helpers.mats(), helpers.frame);
  const positions = curbs.geometry.attributes.position;
  assert.equal(positions.count, 2 * track.samples.length * 4 * 6);
  for (let i = 0; i < positions.count; i++) assert.ok(Number.isFinite(positions.getX(i)) && Number.isFinite(positions.getZ(i)));
  // Repeated cross-sections include the first and final frame on each side.
  for (const side of [-1, 1]) {
    const fr = helpers.frame(track, 0);
    const x = fr.center.x + fr.right.x * side * track.width / 2;
    const z = fr.center.z + fr.right.z * side * track.width / 2;
    let matches = 0;
    for (let i = 0; i < positions.count; i++) if (Math.hypot(positions.getX(i) - x, positions.getZ(i) - z) < 1e-5) matches++;
    assert.ok(matches >= 6, 'seam is shared by the first and last segment');
  }
});
test('continuous tire barriers retain supplied geometry/materials in four instanced draws', () => {
  const scene = new THREE.Scene();
  const barriers = addTireBarriers(scene, track, helpers.mats(), helpers.makeFlatTireStack, helpers.frame);
  assert.equal(barriers.children.length, 4);
  assert.ok(barriers.children.every(m => m.isInstancedMesh));
  assert.equal(barriers.children.reduce((sum, m) => sum + m.count, 0), layout.length * 14);
});
test('drag and keyboard steering follow screen left/right in the supplied chase camera', () => {
  for (const [direction, code] of [[1, null], [1, 'ArrowRight'], [1, 'KeyD'], [-1, null], [-1, 'ArrowLeft'], [-1, 'KeyA']]) {
    const racer = helpers.createVehicleGroup(new THREE.Group(), track, .2, 0, false, 'Player');
    const input = {keys: code ? {[code]: true} : {}, steer: code ? 0 : direction, accel: 0, brake: false, boost: false};
    for (let i = 0; i < 180; i++) helpers.updateVehicle(racer, input, track, 1 / 60, 'race');
    const fr = helpers.frame(track, racer.routeT);
    // Camera at player - forward: its on-screen right is forward cross up.
    const cameraRight = fr.tangent.clone().cross(new THREE.Vector3(0, 1, 0));
    assert.ok(direction * racer.pos.clone().sub(fr.center).dot(cameraRight) > 1, `${code || `touch ${direction}`} reversed`);
  }
});
test('exit/restart cleanup disposes shared GLTF resources and instance buffers once', () => {
  const geometry = new THREE.BoxGeometry(), texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({map: texture});
  const scene = new THREE.Scene();
  const mesh = new THREE.InstancedMesh(geometry, material, 2);
  scene.add(mesh, new THREE.Mesh(geometry, [material, material]));
  const counts = [0, 0, 0, 0];
  [geometry, texture, material, mesh].forEach((resource, i) => resource.addEventListener('dispose', () => counts[i]++));
  disposeRacingResources(scene, material);
  assert.deepEqual(counts, [1, 1, 1, 1]);
});
test('supplied semi-auto player and AI complete all three Alpine laps with finite state', () => {
  for (const ai of [false, true]) {
    elapsedMs = 1000;
    const racer = helpers.createVehicleGroup(new THREE.Group(), track, .01, 0, ai, ai ? 'AI' : 'Player');
    const input = ai ? null : { keys: {}, steer: 0, accel: 0, brake: false, boost: false };
    for (let tick = 0; tick < 180 * 60 && racer.lap < 3; tick++) {
      elapsedMs += 1000 / 60;
      helpers.updateVehicle(racer, input, track, 1 / 60, 'race');
      assert.ok([racer.pos.x, racer.pos.z, racer.yaw, racer.speed].every(Number.isFinite));
    }
    assert.equal(racer.lap, 3, ai ? 'AI did not finish' : 'Player did not finish');
  }
});
test('supplied inventory merges ammo and changes selection when a weapon is empty', () => {
  const weapon = {id: 'pistol', name: 'Pistol', ammo: 8};
  const first = helpers.addWeaponToInventory([], weapon);
  const second = helpers.addWeaponToInventory(first, weapon);
  assert.equal(first[0].ammo, 8);
  assert.equal(second[0].ammo, 16);
  second[0].ammo = 0;
  second.push({id: 'awp', ammo: 2});
  assert.equal(helpers.chooseSelected(second, 'pistol'), 'awp');
  assert.equal(helpers.getSelectedWeapon(second, 'pistol'), null);
});
test('supplied projectile depletes shields, applies the same damage and respects fire cooldown', () => {
  const owner = helpers.createVehicleGroup(new THREE.Group(), track, .01, 0, false, 'Player');
  const target = helpers.createVehicleGroup(new THREE.Group(), track, .02, 0, true, 'Target');
  const scene = new THREE.Scene(), materials = helpers.mats(), flashes = [], explosions = [];
  const weapon = {id: 'pistol', name: 'Pistol', power: 2, speed: 40, cooldown: .3};
  target.hp = 100; target.shield = 20;
  const shot = helpers.spawnShot(owner, target, scene, materials, weapon, flashes);
  assert.ok(shot);
  assert.equal(helpers.spawnShot(owner, target, scene, materials, weapon, flashes), null);
  // Resolve a contact using the actual hit function; no renderer/network required.
  shot.pos.copy(target.pos); shot.vel.set(0, 0, 0);
  const shots = [shot];
  assert.match(helpers.updateShots(shots, [owner, target], explosions, scene, 0), /hit Target/);
  assert.equal(target.shield, 6);
  assert.equal(target.hp, 71);
  assert.equal(shots.length, 0);
  disposeRacingResources(scene, shot.root, ...Object.values(materials));
});
