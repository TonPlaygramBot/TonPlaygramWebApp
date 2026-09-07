import test from 'node:test';
import assert from 'node:assert/strict';
import { project, unproject, inBounds, resolveLocation, placeAsset, planPlacements, planGamePlacements } from '../webapp/src/games/tirana-landmarks/placement.ts';

// Small synthetic fixture. Origin/bounds match the checked-in map builder;
// 'fixture-clock' is a test anchor, NOT a claimed real monument coordinate.
const world = {
  origin: [41.3275, 19.8188],
  bounds: [-805, -380, 660, 1150],
  landmarks: [{ id: 'fixture-clock', x: 125, z: 45 }]
};
const model = (changes = {}) => ({
  id: 'fixture-model', landmarkId: 'fixture-clock',
  modelUrl: '/assets/tirana-landmarks/fixture.glb',
  location: { kind: 'world-landmark', landmarkId: 'fixture-clock', source: 'test fixture only' },
  metresPerUnit: 1, yawRadians: 0, groundHeightM: 0,
  anchorInModel: [0, 0, 0],
  rights: { approved: true, license: 'test-only', attribution: 'synthetic fixture', source: 'test fixture only' },
  ...changes
});
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('map geographic origin projects to zero', () => {
  assert.deepEqual(project(world, ...world.origin), { x: 0, z: 0 });
});
test('projection matches map builder metre constants, without an axis swap', () => {
  const east = project(world, 41.3275, 19.8198);
  const north = project(world, 41.3285, 19.8188);
  close(east.x, 111.32 * Math.cos(41.3275 * Math.PI / 180));
  close(east.z, 0);
  close(north.x, 0);
  close(north.z, -111.32);
});
test('geographic round trips preserve coordinates throughout the map', () => {
  for (const x of [-805, -220, 0, 660]) for (const z of [-380, 0, 600, 1150]) {
    const geo = unproject(world, { x, z });
    const p = project(world, geo.latitude, geo.longitude);
    close(p.x, x); close(p.z, z);
  }
});
test('existing landmark anchors are used exactly, without road snapping', () => {
  assert.deepEqual(resolveLocation(world, model().location), { x: 125, z: 45 });
});
test('unknown and ambiguous landmark IDs fail instead of using city centre', () => {
  assert.throws(() => resolveLocation(world, { kind: 'world-landmark', landmarkId: 'missing', source: 'fixture' }), /Unresolved/);
  assert.throws(() => resolveLocation({ ...world, landmarks: [...world.landmarks, ...world.landmarks] }, model().location), /ambiguous/);
});
test('Tirana Streets and Kart Royale use identical positions', () => {
  assert.deepEqual(placeAsset(world, model()), placeAsset(world, model(), { x: 0, z: 0 }));
});
test('BlackWater receives only its existing translation, at unchanged scale/yaw', () => {
  const a = placeAsset(world, model());
  const b = placeAsset(world, model(), { x: -220, z: 600 });
  assert.deepEqual(b.anchor, { x: a.anchor.x + 220, y: a.anchor.y, z: a.anchor.z - 600 });
  assert.equal(b.uniformScale, a.uniformScale);
  assert.equal(b.yawRadians, a.yawRadians);
});
test('model anchor lands on the geographic point after uniform scale and yaw', () => {
  const asset = model({ anchorInModel: [3, -2, 7], metresPerUnit: 0.01, yawRadians: 0.73, groundHeightM: 1.4 });
  const p = placeAsset(world, asset, { x: -220, z: 600 });
  const [x, y, z] = asset.anchorInModel, s = p.uniformScale, c = Math.cos(p.yawRadians), sn = Math.sin(p.yawRadians);
  close(p.position.x + s * (x * c + z * sn), p.anchor.x);
  close(p.position.y + s * y, p.anchor.y);
  close(p.position.z + s * (-x * sn + z * c), p.anchor.z);
});
test('out-of-map anchors are rejected, never moved into central Tirana', () => {
  const far = unproject(world, { x: 4000, z: 9000 });
  assert.throws(() => placeAsset(world, model({ location: { kind: 'geographic', ...far, source: 'synthetic distant fixture' } })), /outside/);
});
test('bounds include their edges and exclude just-outside points', () => {
  assert.equal(inBounds(world, { x: -805, z: -380 }), true);
  assert.equal(inBounds(world, { x: 660, z: 1150 }), true);
  assert.equal(inBounds(world, { x: 660.01, z: 1150 }), false);
});
test('non-finite coordinates and invalid geographic ranges fail', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => project(world, value, 19.8), /finite/);
    assert.throws(() => unproject(world, { x: value, z: 0 }), /finite/);
  }
  assert.throws(() => project(world, 91, 19), /Invalid geographic/);
  assert.throws(() => project(world, 41, 181), /Invalid geographic/);
});
test('invalid origins, bounds, and absent location evidence fail', () => {
  assert.throws(() => project({ ...world, origin: [90, 0] }, 41, 19), /Invalid map origin/);
  assert.throws(() => project({ ...world, bounds: [10, 0, 0, 1] }, 41, 19), /Invalid map bounds/);
  assert.throws(() => resolveLocation(world, { ...model().location, source: '' }), /traceable source/);
});
test('unapproved rights and missing attribution cannot enter a placement plan', () => {
  assert.throws(() => placeAsset(world, model({ rights: { ...model().rights, approved: false } })), /not been approved/);
  assert.throws(() => placeAsset(world, model({ rights: { ...model().rights, attribution: '' } })), /not been approved/);
});
test('source pages, remote files, and traversal paths are not treated as local models', () => {
  for (const modelUrl of ['https://sketchfab.com/3d-models/example', 'https://cdn.example/model.glb', '/assets/tirana-landmarks/../secret.glb', '/assets/tirana-landmarks/%2e%2e.glb', '/assets/tirana-landmarks/a.glb?token=secret'])
    assert.throws(() => placeAsset(world, model({ modelUrl })), /local, acquired GLB/);
});
test('invalid model units, orientation, and anchor coordinates fail', () => {
  for (const metresPerUnit of [0, -1, NaN]) assert.throws(() => placeAsset(world, model({ metresPerUnit })));
  assert.throws(() => placeAsset(world, model({ yawRadians: Infinity })), /finite/);
  assert.throws(() => placeAsset(world, model({ anchorInModel: [0, NaN, 0] })), /finite/);
  assert.throws(() => placeAsset(world, model({ anchorInModel: [0, 0] })), /three coordinates/);
});
test('alternate listings cannot place the same monument twice', () => {
  assert.throws(() => planPlacements(world, [model(), model({ id: 'alternative-listing' })]), /Duplicate/);
});
test('empty approved asset lists produce no phantom placements', () => {
  assert.deepEqual(planPlacements(world, []), []);
});

test('game adapters share locations and require BlackWater origin explicitly', () => {
  const city = planGamePlacements(world, [model()], { game: 'tiranastreets' });
  assert.deepEqual(city, planGamePlacements(world, [model()], { game: 'kartroyale' }));
  const blackwater = planGamePlacements(world, [model()], { game: 'blackwater', mapOrigin: { x: -220, z: 600 } });
  close(blackwater[0].anchor.x, city[0].anchor.x + 220);
  close(blackwater[0].anchor.z, city[0].anchor.z - 600);
  assert.throws(() => planGamePlacements(world, [model()], { game: 'blackwater' }), /requires/);
  assert.throws(() => planGamePlacements(world, [model()], { game: 'unknown' }), /Unsupported/);
});
test('wrong-sized map definitions cannot silently produce invalid positions', () => {
  assert.throws(() => project({ ...world, origin: [41] }, 41, 19), /dimensions/);
  assert.throws(() => project({ ...world, bounds: [0, 0, 1] }, 41, 19), /dimensions/);
});
test('the shipped approval registry is empty and immutable until actual meshes arrive', async () => {
  const { APPROVED_TIRANA_LANDMARK_ASSETS } = await import('../webapp/src/games/tirana-landmarks/assets.ts');
  assert.equal(APPROVED_TIRANA_LANDMARK_ASSETS.length, 0);
  assert.equal(Object.isFrozen(APPROVED_TIRANA_LANDMARK_ASSETS), true);
});
