import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { createFallbackLudoToken, hasVisibleLudoToken, withLudoTokenAssets, setLudoTileHighlight, updateLudoTileGlow, LUDO_TILE_GLOW_SECONDS } from '../webapp/src/utils/ludoTokenPresentation.ts';

const colors = [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e];
test('all six offline pieces have visible, pickable, player-colored geometry above the board', () => {
  for (const type of ['p', 'r', 'n', 'b', 'q', 'k']) {
    for (const color of colors) {
      const piece = createFallbackLudoToken(type, color);
      piece.position.set(.12, .0185, -.2);
      const box = new THREE.Box3().setFromObject(piece);
      const size = box.getSize(new THREE.Vector3());
      assert.ok(hasVisibleLudoToken(piece));
      assert.ok(Math.abs(size.y - .09) < 1e-7);
      assert.ok(size.x > .05 && size.x < .075 && size.z > .05 && size.z < .075, 'base must fit a track tile');
      assert.ok(box.min.y >= .01849, 'base must not sink into the board');
      piece.traverse((node) => {
        if (node.isMesh) {
          assert.equal(node.material.color.getHex(), color);
          assert.equal(node.material.opacity, 1);
          assert.ok(node.geometry.attributes.position.array.every(Number.isFinite));
        }
      });
      const ray = new THREE.Raycaster(new THREE.Vector3(.12, .4, -.2), new THREE.Vector3(0, -1, 0));
      assert.ok(ray.intersectObject(piece, true).length > 0, 'piece cannot be selected by raycasting');
    }
  }
});

test('empty, hidden, transparent and degenerate models are rejected for a visible fallback', () => {
  assert.equal(hasVisibleLudoToken(null), false);
  assert.equal(hasVisibleLudoToken(new THREE.Group()), false);
  const piece = createFallbackLudoToken('p', colors[0]);
  piece.visible = false;
  assert.equal(hasVisibleLudoToken(piece), false);
  piece.visible = true;
  piece.traverse((node) => { if (node.isMesh) { node.material.transparent = true; node.material.opacity = 0; } });
  assert.equal(hasVisibleLudoToken(piece), false);
  piece.traverse((node) => { if (node.isMesh) node.material.opacity = 1; });
  piece.scale.setScalar(0);
  assert.equal(hasVisibleLudoToken(piece), false);
});

test('failed and stalled asset downloads allow the board to use local pieces', async () => {
  assert.equal(await withLudoTokenAssets(Promise.reject(new Error('offline')), 10), null);
  assert.equal(await withLudoTokenAssets(new Promise(() => {}), 10), null);
  const assets = { proto: {} };
  assert.equal(await withLudoTokenAssets(Promise.resolve(assets)), assets);
});

function tile() {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(.069, .018, .069), new THREE.MeshStandardMaterial({ color: 0xf4e3bd, emissive: 0x112233, emissiveIntensity: .14 }));
  mesh.userData.boardTile = { baseColor: mesh.material.color.clone() };
  return mesh;
}

test('landing glows retain the token color and fade back to the exact original material', () => {
  for (const color of [...colors, 0xad52f1]) {
    const mesh = tile();
    const original = { color: mesh.material.color.clone(), emissive: mesh.material.emissive.clone(), intensity: mesh.material.emissiveIntensity };
    setLudoTileHighlight(mesh, true, color);
    assert.equal(mesh.material.color.getHex(), color);
    assert.equal(mesh.material.emissive.getHex(), color);
    assert.ok(mesh.userData.boardTile.isHighlighted);
    assert.ok(mesh.children.length > 0);
    mesh.children.forEach((layer) => {
      assert.equal(layer.material.color.getHex(), color);
      assert.ok(layer.visible && layer.material.opacity > 0);
      assert.ok(layer.position.y > .009, 'glow must clear the tile surface');
      assert.equal(layer.material.depthWrite, false);
    });
    updateLudoTileGlow(mesh, .35);
    assert.ok(mesh.children[0].visible, 'last landing disappears immediately');
    updateLudoTileGlow(mesh, LUDO_TILE_GLOW_SECONDS);
    assert.ok(mesh.material.color.equals(original.color));
    assert.ok(mesh.material.emissive.equals(original.emissive));
    assert.equal(mesh.material.emissiveIntensity, original.intensity);
    assert.ok(mesh.children.every((layer) => !layer.visible));
    assert.equal(mesh.userData.boardTile.isHighlighted, false);
  }
});

test('consecutive players reuse a tile glow without stale colors and cancellation clears it', () => {
  const mesh = tile(), base = mesh.material.color.clone();
  setLudoTileHighlight(mesh, true, colors[0]);
  const layers = [...mesh.children];
  updateLudoTileGlow(mesh, .2);
  setLudoTileHighlight(mesh, true, colors[1]);
  assert.deepEqual(mesh.children, layers, 'a repeated landing should not allocate more meshes');
  assert.equal(mesh.material.color.getHex(), colors[1]);
  setLudoTileHighlight(mesh, false);
  assert.ok(mesh.material.color.equals(base));
  assert.ok(mesh.children.every((layer) => !layer.visible));
});
