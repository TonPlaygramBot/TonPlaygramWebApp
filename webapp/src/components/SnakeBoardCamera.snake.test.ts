import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createSnakeBoardScene, SNAKE_SCENE_DIMENSIONS as sizes, updateSnakeBoardTokens, resolveSnakeFirearmAnimationId } from './SnakeBoard3D';
import { createSnakeCameraDirector } from '../utils/snakeCameraDirector';

// Stub canvas before imported material factories run; all meshes/transforms stay real.
vi.hoisted(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    getImageData: (_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) })
  }, { get: (object, key) => object[key] ?? (() => {}) }) as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
});

function scene() {
  const root = new THREE.Group();
  root.position.y = 0.8;
  root.scale.set(sizes.footprintScale, sizes.boardScale, sizes.footprintScale);
  const board = createSnakeBoardScene(root, new THREE.Vector3(0,0.8,0), null, []);
  root.updateMatrixWorld(true);
  return { board, root };
}

it('looks toward the actual board tiles from the same player position', () => {
  const { board, root } = scene();
  const camera = new THREE.PerspectiveCamera(52, 390/844, 0.1, 100);
  const home = new THREE.Vector3(0,3,6), homeTarget = new THREE.Vector3(0,0.8,0);
  camera.position.copy(home);
  const director = createSnakeCameraDirector(camera, homeTarget.clone());
  for (const [tile, local] of board.indexToPosition) {
    const center = root.localToWorld(local.clone());
    director.start({ id: String(tile), priority: 2, points: () => [center] }, tile * 100, home, homeTarget);
    director.update(tile * 100 + 20, home, homeTarget, true);
    expect(camera.position.equals(home)).toBe(true);
    expect(center.clone().project(camera).x).toBeCloseTo(0, 5);
    expect(center.clone().project(camera).y).toBeCloseTo(0, 5);
  }
  expect(board.indexToPosition.size).toBe(50);
});

it.each([
  ['slot-10-ak47-gltf', 'ak47VolleyAttack'], ['slot-11-krsv-gltf', 'krsvBurstAttack'],
  ['slot-12-smith-gltf', 'smithSidearmAttack'], ['slot-13-mosin-gltf', 'mosinMarksmanAttack'],
  ['slot-14-uzi-gltf', 'uziSprayAttack'], ['slot-15-sigsauer-gltf', 'sigsauerTacticalAttack'],
  ['slot-16-awp-glb', 'sniperShotAttack'], ['slot-18-fps-gun-gltf', 'shotgunBlastAttack'],
  ['poly-shotgun-01', 'polyShotgun01Attack'], ['glockSidearmAttack', 'glockSidearmAttack'],
  ['droneAttack', null], ['missileJavelin', null], ['fighterJetAttack', null]
])('routes %s to the correct firearm sequence', (id, expected) => {
  expect(resolveSnakeFirearmAnimationId(id)).toBe(expected);
});

it('preserves the entry world position and does not reparent a moving token on React updates', () => {
  const { board } = scene();
  const player = { position: 0, seatIndex: 0, color: '#fbbf24' };
  const update = (position: number) => updateSnakeBoardTokens(
    board.boardTokensGroup, board.reserveTokensGroup, [{ ...player, position }],
    board.indexToPosition, board.serpentineIndexToXZ, { baseLevelTop: board.baseLevelTop }
  );
  update(0);
  const token = board.reserveTokensGroup.children[0];
  const before = token.getWorldPosition(new THREE.Vector3());
  board.boardTokensGroup.attach(token);
  expect(token.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeLessThan(1e-8);
  token.userData.isSliding = true;
  update(0);
  expect(token.parent).toBe(board.boardTokensGroup);
  expect(token.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeLessThan(1e-8);
  token.userData.isSliding = false;
  update(1);
  expect(token.parent).toBe(board.boardTokensGroup);
});
