import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applySnookerTableModelParam,
  resolveSnookerGlbFitTransform,
  resolveSnookerGlbPocketLayout,
  resolveSnookerTableModel,
  usesProceduralSnookerTableRailDecor,
  TABLE_MODEL_CLASSIC,
  TABLE_MODEL_OPENSOURCE,
  TABLE_MODEL_OPENSOURCE_GLB_URL
} from '../webapp/src/pages/Games/snookerTableModel.js';

describe('snooker table model selection', () => {
  test('resolveSnookerTableModel defaults to the open-source GLB table', () => {
    assert.equal(resolveSnookerTableModel(null), TABLE_MODEL_OPENSOURCE);
    assert.equal(resolveSnookerTableModel(''), TABLE_MODEL_OPENSOURCE);
    assert.equal(resolveSnookerTableModel('invalid'), TABLE_MODEL_OPENSOURCE);
  });

  test('resolveSnookerTableModel accepts opensource value case-insensitively', () => {
    assert.equal(resolveSnookerTableModel('opensource'), TABLE_MODEL_OPENSOURCE);
    assert.equal(resolveSnookerTableModel('OpenSource'), TABLE_MODEL_OPENSOURCE);
  });

  test('applySnookerTableModelParam always writes a safe tableModel param', () => {
    const params = new URLSearchParams();
    applySnookerTableModelParam(params, 'opensource');
    assert.equal(params.get('tableModel'), TABLE_MODEL_OPENSOURCE);

    applySnookerTableModelParam(params, 'unknown');
    assert.equal(params.get('tableModel'), TABLE_MODEL_OPENSOURCE);
  });

  test('resolveSnookerGlbFitTransform uniformly maps GLB bed bounds onto the game playfield', () => {
    const transform = resolveSnookerGlbFitTransform(
      { x: 2, y: 0.5, z: 4 },
      { x: 10, y: 1, z: 20 }
    );
    assert.deepEqual(transform.scale, { x: 5, y: 5, z: 5 });
  });

  test('resolveSnookerGlbFitTransform preserves original GLB table shape by default', () => {
    const transform = resolveSnookerGlbFitTransform(
      { x: 2, y: 1, z: 5 },
      { x: 12, y: 1, z: 20 }
    );
    assert.deepEqual(transform.scale, { x: 6, y: 6, z: 6 });
  });


  test('resolveSnookerGlbPocketLayout maps pockets to exact GLB playfield mouth sizes', () => {
    const layout = resolveSnookerGlbPocketLayout({ x: 1.778, z: 3.569 }, { y: 0.12 });

    assert.equal(layout.mapping, 'glb-bed-to-game-playfield-pocket-mouths');
    assert.equal(layout.pockets.length, 6);
    assert.equal(layout.cornerRadius.toFixed(4), '0.0415');
    assert.equal(layout.middleRadius.toFixed(4), '0.0435');
    assert.deepEqual(layout.pockets.map((pocket) => pocket.id), ['BL', 'BR', 'TL', 'TR', 'ML', 'MR']);
    assert.equal(layout.pockets[0].x, -1.778 / 2 + 0.0415);
    assert.equal(layout.pockets[0].z, -3.569 / 2 + 0.0415);
    assert.equal(layout.pockets[4].x, -1.778 / 2 + 0.0435);
    assert.equal(layout.pockets[4].z, 0);
  });

  test('Snooker Champion scene does not build a procedural table mesh fallback', async () => {
    const source = await readFile('webapp/src/pages/Games/SnookerRoyalProvided.jsx', 'utf8');
    assert.equal(source.includes('snooker-champion-procedural-cloth'), false);
    assert.equal(source.includes('proceduralTableMeshes'), false);
    assert.match(source, /mapping = 'glb-bed-to-game-playfield'/);
  });



  test('Snooker Royal table maps procedural pocket hardware to the GLB pocket layout', async () => {
    const source = await readFile('webapp/src/pages/Games/SnookerRoyal.jsx', 'utf8');

    assert.match(source, /resolveSnookerGlbPocketLayout\(\{ x: PLAY_W, z: PLAY_H \}\)/);
    assert.match(source, /const pocketMouthRadius = isMiddlePocket \? SIDE_POCKET_RADIUS : POCKET_TOP_R/);
    assert.match(source, /const pocketDropGeometry = createPocketDropGeometry\(pocketMouthRadius\)/);
    assert.match(source, /new THREE\.Mesh\(pocketDropGeometry\.ringGeometry, pocketGuideMaterial\)/);
  });

  test('Snooker Champion overlays exact GLB pocket hardware and capture mapping', async () => {
    const source = await readFile('webapp/src/pages/Games/SnookerRoyalProvided.jsx', 'utf8');

    assert.match(source, /resolveSnookerGlbPocketLayout\(/);
    assert.match(source, /addSnookerChampionGlbPocketHardware\(tableGroup, pocketPositions\)/);
    assert.match(source, /glb-exact-pocket-net/);
    assert.match(source, /glb-exact-chrome-holder-ring/);
    assert.match(source, /glb-exact-leather-drop-strap/);
    assert.match(source, /OFFICIAL_SNOOKER_POCKET_CORNER_MOUTH_M = 0\.083/);
    assert.match(source, /OFFICIAL_SNOOKER_POCKET_MIDDLE_MOUTH_M = 0\.087/);
  });

  test('uses procedural rail decor only for the classic table model', () => {
    assert.equal(usesProceduralSnookerTableRailDecor('classic'), true);
    assert.equal(usesProceduralSnookerTableRailDecor('opensource'), false);
    assert.equal(usesProceduralSnookerTableRailDecor('unknown'), false);
  });

  test('uses the Pooltool snooker_generic GLB source', () => {
    assert.match(
      TABLE_MODEL_OPENSOURCE_GLB_URL,
      /pooltool\/models\/table\/snooker_generic\/snooker_generic\.glb$/
    );
  });
});
