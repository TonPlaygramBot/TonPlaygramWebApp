import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildingSurfaceUV } from '../webapp/src/games/tirana-environment/buildingSurfaceUV.mjs';

test('vertical facade UVs retain elevation and metric scale in every orientation', () => {
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI / 4, -Math.PI / 3]) {
    const nx = Math.cos(angle), nz = Math.sin(angle);
    const origin = buildingSurfaceUV(12, 2, -9, nx, 0, nz);
    const above = buildingSurfaceUV(12, 6, -9, nx, 0, nz);
    const across = buildingSurfaceUV(12 - nz * 4, 2, -9 + nx * 4, nx, 0, nz);
    assert.ok(Math.abs(above[1] - origin[1] - 1) < 1e-10);
    assert.ok(Math.abs(across[0] - origin[0] - 1) < 1e-10);
    assert.equal(above[0], origin[0]);
  }
});
test('roof mapping and invalid tile sizes are explicit', () => {
  assert.deepEqual(buildingSurfaceUV(8, 12, -4, 0, 1, 0), [2, -1]);
  assert.deepEqual(buildingSurfaceUV(8, 0, -4, 0, -1, 0), [2, -1]);
  for (const size of [0, -1, NaN, Infinity]) assert.throws(() => buildingSurfaceUV(0, 0, 0, 1, 0, 0, size), RangeError);
});
test('reused plaster textures match bundled CC0 provenance hashes', () => {
  const base = new URL('../webapp/public/assets/tirana-streets/', import.meta.url);
  const sources = JSON.parse(readFileSync(new URL('materials/sources.json', base), 'utf8'));
  const plaster = sources.filter(s => s.file.includes('plastered_wall_02'));
  assert.equal(plaster.length, 3);
  for (const source of plaster) {
    assert.equal(source.license, 'CC0-1.0');
    assert.equal(createHash('sha256').update(readFileSync(new URL(source.file, base))).digest('hex'), source.sha256);
  }
});
test('real extruded shell has non-degenerate wall texture triangles without moving vertices', async () => {
  const T = await import('../webapp/node_modules/three/build/three.module.js');
  const shape = new T.Shape([[0, 0], [8, 0], [12, -4], [2, -7]].map(([x, z]) => new T.Vector2(x, z)));
  const geometry = new T.ExtrudeGeometry(shape, { depth: 12, bevelEnabled: false, steps: 1 });
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
  const before = Array.from(position.array);
  let walls = 0;
  for (let i = 0; i < position.count; i += 3) {
    if (Math.abs(normal.getY(i)) > .5) continue;
    const uv = [0, 1, 2].map(offset => {
      const n = i + offset;
      return buildingSurfaceUV(position.getX(n), position.getY(n), position.getZ(n), normal.getX(n), normal.getY(n), normal.getZ(n));
    });
    const twiceArea = (uv[1][0] - uv[0][0]) * (uv[2][1] - uv[0][1]) - (uv[2][0] - uv[0][0]) * (uv[1][1] - uv[0][1]);
    assert.ok(Math.abs(twiceArea) > .01);
    walls++;
  }
  assert.equal(walls, 8);
  assert.deepEqual(Array.from(position.array), before);
  geometry.dispose();
});
