// @vitest-environment node
import { beforeAll, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createRestoredSeatedHumanActor } from '../pages/Games/shared/seatedHumanActors';
import { createSnakeHumanInteraction, worldPoint } from './snakeHumanInteraction';
import { createSnakeDiceInteraction, SNAKE_DICE_RELEASE_MS, SNAKE_DICE_PRESENTATION_MS } from './snakeDiceInteraction';
import { createSnakeFirearmAnimation, createSnakeFirearmFallback } from './snakeFirearmAnimation';
import { prepareSnakeFirearm, readSnakeWeaponContacts, snakeWeaponProfile } from './snakeWeaponGrip';
import { computeDiceThrowLayout, updateSnakeSeatWeapons, SNAKE_SCENE_DIMENSIONS as D } from '../components/SnakeBoard3D';
import { getLudoFirearmTiming } from './ludoFirearmPresentation';

let template: THREE.Object3D;
beforeAll(async () => {
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'PoseTestTextures', loadTexture: () => Promise.resolve(null) }));
  const bytes = await readFile('public/assets/pool-royale/readyplayer.me.glb');
  template = (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
});
function fixture(yaw: number) {
  const scene = new THREE.Scene(), chair = new THREE.Group(); scene.add(chair);
  chair.position.set(0, D.chairBaseHeight, D.chairRadius + D.bottomChairExtra).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
  chair.rotation.y = Math.PI + yaw;
  const restored = createRestoredSeatedHumanActor(template, chair, { targetHeight: 1.13, seatHeight: D.seatHeight })!;
  const human = createSnakeHumanInteraction(restored.actor)!;
  const point = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
  const boardRoot = new THREE.Group(); boardRoot.scale.set(D.footprintScale, D.boardScale, D.footprintScale);
  boardRoot.position.y = D.tableHeight - 0.01; scene.add(boardRoot);
  const anchor = new THREE.Object3D(); anchor.position.y = D.avatarAnchorHeight; chair.add(anchor);
  const seat = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
  const anchors = []; anchors[seat] = anchor;
  const diceBaseY = 0.33 * D.tileSize * 8 / 10.2 + D.diceSize * 0.5 + D.tileSize * 0.02;
  const board = { root: boardRoot, seatAnchors: anchors, diceBaseY };
  const layout = computeDiceThrowLayout(board, seat, 1);
  return { scene, chair, human, point, board, seat, boardRoot, pickup: layout.basePositions[0] };
}

it.each([0, Math.PI / 2, Math.PI, -Math.PI / 2])('reaches a stationary die, carries it and releases continuously at seat yaw %f', yaw => {
  const { scene, human, point, boardRoot, pickup } = fixture(yaw);
  // Nonuniform parent scaling is present on the production Snake board.
  const parent = boardRoot;
  const die = new THREE.Object3D(); parent.add(die); die.position.copy(pickup);
  const initial = die.position.clone(), initialQ = die.quaternion.clone(), rootPosition = human.actor.position.clone();
  const destination = parent.worldToLocal(point(0.08, 1.01, 1.7));
  const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  const feet = ['RightFoot', 'LeftFoot'].map(name => human.actor.getObjectByName(name)!);
  const footPositions = feet.map(worldPoint);
  const animation = createSnakeDiceInteraction(die, destination, { human, startedAt: 0, target });
  expect(human.arms.right.fingers.Index).toHaveLength(3);
  for (let time = 0; time < 640; time += 10) {
    animation.update(time);
    expect(die.position.distanceTo(initial)).toBeLessThan(1e-12);
    expect(die.quaternion.angleTo(initialQ)).toBeLessThan(1e-7);
    if (time >= 480) {
      expect(worldPoint(human.arms.right.palm).distanceTo(worldPoint(die))).toBeLessThan(0.002);
      feet.forEach((foot, index) => expect(worldPoint(foot).distanceTo(footPositions[index])).toBeLessThan(0.002));
    }
  }
  for (let time = 640; time < SNAKE_DICE_RELEASE_MS; time += 10) {
    animation.update(time);
    expect(worldPoint(human.arms.right.palm).distanceTo(worldPoint(die))).toBeLessThan(1e-8);
    expect(human.actor.position.distanceTo(rootPosition)).toBeLessThan(1e-12);
  }
  animation.update(SNAKE_DICE_RELEASE_MS - 0.001); const beforeRelease = worldPoint(die);
  animation.update(SNAKE_DICE_RELEASE_MS);
  expect(worldPoint(die).distanceTo(beforeRelease)).toBeLessThan(1e-5);
  expect(animation.update(SNAKE_DICE_PRESENTATION_MS)).toBe(true);
  expect(die.position.distanceTo(destination)).toBeLessThan(1e-10);
  expect(die.quaternion.angleTo(target)).toBeLessThan(1e-7);
  animation.dispose(); animation.dispose(); human.dispose();
});

it.each(['glockSidearmAttack', 'uziSprayAttack', 'ak47VolleyAttack', 'shotgunBlastAttack', 'sniperShotAttack'])('holds %s at both grips and aims from its actual muzzle', id => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const { scene, human, point } = fixture(yaw);
    const rack = prepareSnakeFirearm(createSnakeFirearmFallback(), id, human.unit * snakeWeaponProfile(id).lengthInArms);
    rack.rotation.x = Math.PI / 2; rack.rotation.y = yaw;
    rack.position.copy(point(0.65, 1.03, 2.05)); scene.add(rack);
    const initial = rack.matrix.clone(), scale = rack.scale.clone();
    const target = point(-0.35, 1.02, 0.5);
    const motion = createSnakeFirearmAnimation({ scene, weaponId: id, parkedWeapon: rack, origin: worldPoint(rack), target, human, startedAt: 0, reducedMotion: true });
    for (let time = 0; time < 420; time += 20) {
      motion.update(time);
      expect(rack.visible).toBe(true);
      expect(rack.scale.equals(scale)).toBe(true);
      if (time >= 320) expect(worldPoint(human.arms.right.palm).distanceTo(readSnakeWeaponContacts(rack)!.grip)).toBeLessThan(0.003);
    }
    motion.update(1020);
    expect(rack.visible).toBe(false);
    const held = scene.getObjectByName('snake-held-firearm')!;
    const contact = readSnakeWeaponContacts(held)!;
    expect(worldPoint(human.arms.right.palm).distanceTo(contact.grip)).toBeLessThan(0.003);
    expect(worldPoint(human.arms.left.palm).distanceTo(contact.support)).toBeLessThan(0.003);
    const bore = contact.muzzle.clone().sub(contact.stock).normalize();
    expect(target.clone().sub(contact.muzzle).cross(bore).length()).toBeLessThan(0.003);
    motion.update(getLudoFirearmTiming(id).durationMs + 480);
    expect(rack.visible).toBe(true);
    expect(held.visible).toBe(false);
    expect(motion.update(motion.duration)).toBe(true);
    motion.dispose(); human.dispose();
    expect(rack.scale.equals(scale)).toBe(true);
  }
});

it.each([30, 60, 90])('preserves contact after skipped pickup frames at %i Hz', fps => {
  const { scene, human, point } = fixture(0);
  const die = new THREE.Object3D(); scene.add(die); die.position.copy(point(0, 1.01, 1.65));
  const destination = point(0, 1.01, 1.7);
  const motion = createSnakeDiceInteraction(die, destination, { human, startedAt: 0 });
  for (let time = 800; time <= SNAKE_DICE_PRESENTATION_MS; time += 1000 / fps) motion.update(time);
  expect(motion.update(SNAKE_DICE_PRESENTATION_MS)).toBe(true);
  expect(die.position.distanceTo(destination)).toBeLessThan(1e-10);
  motion.dispose(); human.dispose();
});


it('reaches the production parking slots without moving or resizing the gun before contact', () => {
  const loading = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue({ scene: null } as any);
  try {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const { scene, human, point, board, seat, boardRoot } = fixture(yaw);
      const weaponDisplayGroup = new THREE.Group(); weaponDisplayGroup.userData.byPlayer = new Map(); boardRoot.add(weaponDisplayGroup);
      const liveBoard = { ...board, scene, weaponDisplayGroup, getSeatHuman: () => human,
        tableInfo: { surfaceY: D.tableHeight }, boardLookTarget: new THREE.Vector3(0, D.tableHeight, 0) };
      const players = [{ seatIndex: seat, weaponType: 'poly-assault-rifle-01' }];
      updateSnakeSeatWeapons(liveBoard, players);
      const rack = weaponDisplayGroup.userData.byPlayer.get(`seat-${seat}`);
      const contacts = readSnakeWeaponContacts(rack)!;
      const origin = worldPoint(rack), target = point(0, 0.95, 0.2);
      const motion = createSnakeFirearmAnimation({ scene, weaponId: 'assaultRifleAttack', human, parkedWeapon: rack, origin, target, startedAt: 0 });
      for (let time = 320; time <= 400; time += 10) {
        motion.update(time);
        expect(worldPoint(rack).distanceTo(origin)).toBeLessThan(1e-10);
        expect(worldPoint(human.arms.right.palm).distanceTo(contacts.grip)).toBeLessThan(0.003);
      }
      for (let time = 420; time < 1600; time += 1000 / 60) {
        motion.update(time);
        const held = readSnakeWeaponContacts(scene.getObjectByName('snake-held-firearm')!)!;
        expect(worldPoint(human.arms.right.palm).distanceTo(held.grip)).toBeLessThan(0.003);
        if (time >= 1020) expect(worldPoint(human.arms.left.palm).distanceTo(held.support)).toBeLessThan(0.003);
      }
      motion.dispose(); expect(rack.visible).toBe(true); human.dispose();
    }
  } finally { loading.mockRestore(); }
});
