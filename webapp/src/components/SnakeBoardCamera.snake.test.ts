import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createSnakeBoardScene, SNAKE_SCENE_DIMENSIONS as sizes, updateSnakeBoardTokens } from './SnakeBoard3D';
import { frameSnakeAction } from '../utils/snakeCameraDirector';

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

it('keeps the token visible above the real pyramid on all 50 tiles in portrait', () => {
  const { board, root } = scene();
  const camera = new THREE.PerspectiveCamera(52, 390/844, 0.1, 100);
  const direction = new THREE.Vector3(0, Math.tan(68 * Math.PI / 180), 1).normalize();
  const blocked: number[] = [];
  const radius = sizes.tokenHeight * sizes.boardScale * 1.2;
  const ray = new THREE.Raycaster();
  for (const [tile, local] of board.indexToPosition) {
    const center = root.localToWorld(local.clone()).add(new THREE.Vector3(0, sizes.tokenHeight * sizes.boardScale * 0.65, 0));
    const frame = frameSnakeAction(camera, [center], direction, radius, sizes.tileSize * sizes.footprintScale * 7);
    camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld(true);
    const ndc = center.clone().project(camera);
    expect(Math.abs(ndc.x)).toBeLessThan(0.72);
    expect(Math.abs(ndc.y)).toBeLessThan(0.55);
    const distance = camera.position.distanceTo(center);
    ray.set(camera.position, center.clone().sub(camera.position).normalize());
    ray.far = distance - 0.01;
    // Labels and transparent rails are excluded; opaque pyramid floors must not hide the token.
    const hits = ray.intersectObjects(board.rotationRoot.children[0].children, true).filter(hit => {
      const material = (hit.object as THREE.Mesh).material as THREE.Material;
      return material && !material.transparent;
    });
    if (hits.length) blocked.push(tile);
  }
  expect(board.indexToPosition.size).toBe(50);
  expect(blocked).toEqual([]);
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
