import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { updateAutomaticLods } from '../webapp/src/games/tirana-landmarks/automaticLods.mjs';

// Dispatch/traversal contract tests with explicit scene doubles, not GPU tests.
// Three.js itself remains responsible for LOD distance/zoom/hysteresis selection.
function scene(children) {
  const root = { visible: true, children };
  root.traverseVisible = (callback) => {
    const visit = (object) => {
      if (object.visible === false) return;
      callback(object);
      for (const child of object.children || []) visit(child);
    };
    visit(root);
  };
  return root;
}
function lod(update, extra = {}) {
  return { visible: true, isLOD: true, autoUpdate: true, update, ...extra };
}
test('updates visible automatic LODs with the actual camera', () => {
  const camera = { zoom: 1.4 }, calls = [];
  const root = scene([lod(c => calls.push(c)), lod(c => calls.push(c))]);
  assert.equal(updateAutomaticLods(root, camera), 2);
  assert.deepEqual(calls, [camera, camera]);
});
test('does not run ordinary game hooks or manually selected LODs', () => {
  const unexpected = () => assert.fail('unexpected update');
  const root = scene([
    { visible: true, update: unexpected },
    lod(unexpected, { autoUpdate: false }),
    lod(unexpected, { isLOD: false })
  ]);
  assert.equal(updateAutomaticLods(root, {}), 0);
});
test('does not update hidden objects or descendants of hidden groups', () => {
  const unexpected = () => assert.fail('hidden LOD updated');
  const root = scene([
    lod(unexpected, { visible: false }),
    { visible: false, children: [lod(unexpected)] }
  ]);
  assert.equal(updateAutomaticLods(root, {}), 0);
});
test('selection happens before traversing the chosen detail children', () => {
  const near = lod(() => assert.fail('deselected near level traversed'));
  const far = lod(() => {});
  const parent = lod(() => { near.visible = false; far.visible = true; },
    { children: [near, far] });
  assert.equal(updateAutomaticLods(scene([parent]), {}), 2);
});
test('camera changes are delegated every frame, never cached by scene identity', () => {
  const calls = [], root = scene([lod(c => calls.push(c))]);
  const first = {}, second = {};
  updateAutomaticLods(root, first);
  updateAutomaticLods(root, second);
  assert.deepEqual(calls, [first, second]);
});
test('BLACKWATER invokes the selector after matrices and before extracting faces', () => {
  const source = readFileSync(new URL('../webapp/src/games/blackwater/compatibility.ts', import.meta.url), 'utf8');
  assert.match(source, /import \{ updateAutomaticLods \} from '\.\.\/tirana-landmarks\/automaticLods\.mjs'/);
  const matrices = source.indexOf('camera.matrixWorldInverse.copy(camera.matrixWorld).invert();');
  const select = source.indexOf('updateAutomaticLods(scene, camera);');
  const collect = source.indexOf('const collect=');
  assert.ok(matrices >= 0 && select > matrices && collect > select);
  assert.equal(source.match(/updateAutomaticLods\(scene, camera\)/g).length, 1);
});
