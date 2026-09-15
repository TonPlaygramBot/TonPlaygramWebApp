// @vitest-environment node
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createSnakeBoardScene, computeDiceThrowLayout, updateSnakeBoardTokens, updateSnakeSeatWeapons, SNAKE_SCENE_DIMENSIONS as D } from '../components/SnakeBoard3D';
import { SNAKE_CAPTURE_WEAPON_OPTIONS, SNAKE_SHARED_CAPTURE_WEAPON_OPTIONS } from '../config/snakeWeaponCatalog';
import { createMurlanStyleTable, TABLE_SHAPE_OPTIONS } from './murlanTable';
import { prepareSnakeFirearm, snakeWeaponProfile } from './snakeWeaponGrip';
import { parkSnakeWeapons, snakeParkingBounds, SNAKE_PARKING_GAP } from './snakeWeaponParking';

const models = new Map<string, THREE.Object3D>();
beforeAll(async () => {
  const context = new Proxy({
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
  }, { get: (object, key) => object[key] ?? (() => {}) });
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => context, toDataURL: () => '' }) });
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockReturnValue(new THREE.Texture());
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'ParkingTextures', loadTexture: () => Promise.resolve(null) }));
  for (const id of ['polyAssaultRifle01Attack', 'polyPistol01Attack', 'polyShotgun01Attack']) {
    const bytes = await readFile(`public/assets/tirana-streets/imported/${id}.glb`);
    models.set(id, (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene);
  }
});
afterAll(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function fixture(count: number, shape = TABLE_SHAPE_OPTIONS[0]) {
  const scene = new THREE.Scene();
  const table = createMurlanStyleTable({ arena: scene, tableRadius: D.tableRadius, tableHeight: D.tableHeight,
    shapeOption: shape, topThicknessScale: D.topThicknessScale, includeBase: false, flushPlayingSurface: true, textures: false });
  const root = new THREE.Group(); scene.add(root); root.position.y = D.tableHeight - 0.01;
  root.scale.set(D.footprintScale, D.boardScale, D.footprintScale);
  const board = createSnakeBoardScene(root, new THREE.Vector3(0, D.tableHeight, 0), null);
  const anchors = Array.from({ length: count }, (_, i) => {
    const anchor = new THREE.Object3D(), yaw = count === 2 ? i * Math.PI : i * Math.PI / 2;
    anchor.position.set(0, 1, D.chairRadius).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw); scene.add(anchor); return anchor;
  });
  const diceZones = anchors.map((_, i) => board.root.localToWorld(computeDiceThrowLayout({ ...board, tableInfo: table, seatAnchors: anchors }, i, 1).basePositions[0].clone()));
  return { scene, root, board, anchors, diceZones, table, center: new THREE.Vector3() };
}

it.each(TABLE_SHAPE_OPTIONS)('supports all four flat imported firearms on $id with clear board and dice lanes', shape => {
  for (const count of [2, 3, 4]) for (const id of models.keys()) {
    const f = fixture(count, shape);
    const holders = f.anchors.map((_, seat) => {
      const holder = new THREE.Group(); holder.userData.seatIndex = seat; f.root.add(holder);
      const ludoArenaRatio = (0.72 * 0.374) / 0.85;
      const visual = prepareSnakeFirearm(models.get(id)!.clone(true), id, 1.40932 * ludoArenaRatio * snakeWeaponProfile(id).lengthInArms / D.footprintScale);
      visual.rotation.x = Math.PI / 2; holder.add(visual); return holder;
    });
    const results = parkSnakeWeapons({ ...f, holders, obstacles: [f.board.platformGroup] });
    expect(results, `${shape.id}/${count}/${id}`).toHaveLength(count);
    const platform = snakeParkingBounds(f.board.platformGroup);
    results.forEach(({ box, scale }, index) => {
      expect(scale, `${shape.id}/${count}/${id} seat ${index}`).toBeGreaterThanOrEqual(0.1);
      expect(box.min.y).toBeCloseTo(D.tableHeight + 0.002, 8);
      expect(box.intersectsBox(platform)).toBe(false);
      expect(box.getSize(new THREE.Vector3()).y).toBeLessThan(0.16);
      for (const other of results.slice(index + 1)) expect(box.clone().expandByScalar(SNAKE_PARKING_GAP * 0.99).intersectsBox(other.box)).toBe(false);
      const actual = snakeParkingBounds(holders[index]);
      expect(actual.min.distanceTo(box.min)).toBeLessThan(1e-8);
      expect(actual.max.distanceTo(box.max)).toBeLessThan(1e-8);
      for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) {
        const direction = new THREE.Vector3(x, 0, z);
        expect(direction.length()).toBeLessThan(f.table.getOuterRadius(direction.clone().normalize()));
      }
    });
    const poses = holders.map(h => h.matrixWorld.clone());
    parkSnakeWeapons({ ...f, holders, obstacles: [f.board.platformGroup] });
    holders.forEach((h, i) => expect(h.matrixWorld.elements).toEqual(poses[i].elements));
    f.table.dispose();
  }
});

it('uses the same table and board calibration as Ludo Battle Royal', () => {
  const arenaScale = 0.72 * 0.374;
  const modelScale = 0.75 * arenaScale;
  expect(D.tableRadius).toBeCloseTo(4.2 * modelScale * 0.92, 8);
  expect(D.boardScale).toBeCloseTo(3.22 * arenaScale, 8);
  expect(D.diceSize).toBeCloseTo(0.054, 8);
  const f = fixture(4);
  const underside = new THREE.Box3().setFromObject(f.table.group).min.y;
  expect(underside).toBeGreaterThan(0.03);
  expect(underside).toBeLessThan(0.07);
  f.table.dispose();
  expect(D.chairRadius).toBeLessThan(D.tableRadius + 0.03);
});

it('reparks an asynchronously loaded firearm on the surface instead of retaining placeholder offsets', async () => {
  let deliver: (value: any) => void;
  const pending = new Promise(resolve => { deliver = resolve; });
  const loading = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockReturnValue(pending as any);
  const f = fixture(4), weaponDisplayGroup = new THREE.Group(); f.root.add(weaponDisplayGroup);
  weaponDisplayGroup.userData.byPlayer = new Map();
  const live = { ...f.board, scene: f.scene, tableInfo: f.table, seatAnchors: f.anchors, weaponDisplayGroup,
    boardLookTarget: new THREE.Vector3(0, D.tableHeight, 0), getSeatHuman: () => ({ unit: 1.40932 }) };
  const players = f.anchors.map((_, seatIndex) => ({ seatIndex, weaponType: 'poly-assault-rifle-01' }));
  updateSnakeSeatWeapons(live, players);
  const first = weaponDisplayGroup.children[0].children[0].children[0];
  deliver!({ scene: models.get('polyAssaultRifle01Attack')!.clone(true) });
  await vi.waitFor(() => expect(weaponDisplayGroup.children[0].children[0].children[0]).not.toBe(first));
  const boxes = weaponDisplayGroup.children.map(snakeParkingBounds);
  boxes.forEach((box, i) => {
    expect(box.min.y).toBeCloseTo(D.tableHeight + 0.002, 8);
    expect(box.getSize(new THREE.Vector3()).y).toBeLessThan(0.16);
    for (const other of boxes.slice(i + 1)) expect(box.clone().expandByScalar(0.034).intersectsBox(other)).toBe(false);
  });
  loading.mockRestore(); f.table.dispose();
});

it('keeps every catalog fallback clear of real reserve tokens and other parked weapons', async () => {
  const loading = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue({ scene: null } as any);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline geometry test')));
  const f = fixture(4), weaponDisplayGroup = new THREE.Group(); f.root.add(weaponDisplayGroup);
  weaponDisplayGroup.userData.byPlayer = new Map();
  const live = { ...f.board, scene: f.scene, tableInfo: f.table, seatAnchors: f.anchors, weaponDisplayGroup,
    boardLookTarget: new THREE.Vector3(0, D.tableHeight, 0), getSeatHuman: () => ({ unit: 1.40932 }) };
  const ids = [...new Set([...SNAKE_CAPTURE_WEAPON_OPTIONS, ...SNAKE_SHARED_CAPTURE_WEAPON_OPTIONS].map(o => o.id))];
  for (const id of ids) {
    const players = f.anchors.map((_, seatIndex) => ({ seatIndex, position: 0, color: '#ffaa11', weaponType: id }));
    updateSnakeBoardTokens(f.board.boardTokensGroup, f.board.reserveTokensGroup, players, f.board.indexToPosition, f.board.serpentineIndexToXZ,
      { baseLevelTop: f.board.baseLevelTop, seatAnchors: f.anchors, boardLookTarget: live.boardLookTarget, boardRoot: f.board.root, tableInfo: f.table });
    updateSnakeSeatWeapons(live, players);
    const holders = [...weaponDisplayGroup.userData.byPlayer.values()] as THREE.Object3D[];
    expect(holders).toHaveLength(4);
    const tokenBounds = f.board.reserveTokensGroup.children.map(snakeParkingBounds);
    holders.forEach((holder, i) => {
      expect(holder.visible, `${id}/${i}`).toBe(true);
      const box = snakeParkingBounds(holder);
      expect(box.min.y, `${id}/${i}`).toBeCloseTo(D.tableHeight + 0.002, 7);
      for (const token of tokenBounds) expect(box.clone().expandByScalar(0.034).intersectsBox(token), `${id}/${i} token`).toBe(false);
      for (const other of holders.slice(i + 1)) expect(box.clone().expandByScalar(0.034).intersectsBox(snakeParkingBounds(other)), `${id}/${i} weapon`).toBe(false);
    });
  }
  await new Promise(resolve => setImmediate(resolve)); loading.mockRestore(); f.table.dispose();
}, 20000);
