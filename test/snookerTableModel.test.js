import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applySnookerTableModelParam,
  resolveSnookerGlbFitTransform,
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

  test('resolveSnookerGlbFitTransform maps GLB bounds exactly onto the game playfield', () => {
    const transform = resolveSnookerGlbFitTransform(
      { x: 2, y: 0.5, z: 4 },
      { x: 10, y: 1, z: 20 }
    );
    assert.deepEqual(transform.scale, { x: 5, y: 2, z: 5 });
  });

  test('resolveSnookerGlbFitTransform keeps width and depth independently exact', () => {
    const transform = resolveSnookerGlbFitTransform(
      { x: 2, y: 1, z: 5 },
      { x: 12, y: 1, z: 20 }
    );
    assert.deepEqual(transform.scale, { x: 6, y: 1, z: 4 });
  });

  test('Snooker Champion scene does not build a procedural table mesh fallback', async () => {
    const source = await readFile('webapp/src/pages/Games/SnookerRoyalProvided.jsx', 'utf8');
    assert.equal(source.includes('snooker-champion-procedural-cloth'), false);
    assert.equal(source.includes('proceduralTableMeshes'), false);
    assert.match(source, /mapping = 'glb-bed-to-game-playfield'/);
  });

  test('Snooker Champion scene enlarges the GLB table and tightens cushion mapping', async () => {
    const source = await readFile('webapp/src/pages/Games/SnookerRoyalProvided.jsx', 'utf8');
    assert.match(source, /SNOOKER_PLAYFIELD_SCALE = \(2\.86 \* WORLD_SCALE\)/);
    assert.match(source, /SNOOKER_TABLE_VISUAL_LENGTH_TRIM = 1\.18/);
    assert.match(source, /SNOOKER_CUSHION_COLLISION_SAFETY_INSET/);
    assert.match(source, /SNOOKER_PHYSICS_MAX_STEP = 1 \/ 480/);
  });

  test('Snooker Champion cue follow camera anchors to the human face', async () => {
    const source = await readFile('webapp/src/pages/Games/SnookerRoyalProvided.jsx', 'utf8');
    assert.match(source, /SNOOKER_FACE_CAMERA_FORWARD_OFFSET/);
    assert.match(source, /human\.faceCameraWorld = head\.clone\(\)/);
    assert.match(source, /humanFaceWorld: human\.faceCameraWorld/);
  });

  test('Snooker Champion shooting cue is parallel with the aim direction', async () => {
    const source = await readFile('webapp/src/pages/Games/SnookerRoyalProvided.jsx', 'utf8');
    assert.match(source, /const cueBackShoot = cueTipShoot\.clone\(\)\.addScaledVector\(aimForward, -CFG\.cueLength\)/);
  });

  test('Snooker Champion freezes the cue stick at cue-ball impact', async () => {
    const source = await readFile('webapp/src/pages/Games/SnookerRoyalProvided.jsx', 'utf8');
    assert.match(source, /let impactCueBack = null, impactCueTip = null/);
    assert.match(source, /impactCueBack = cueBackShoot\.clone\(\)/);
    assert.match(source, /impactCueTip = cueTipShoot\.clone\(\)/);
    assert.match(source, /didHit && impactCueBack \? impactCueBack : cueBackShoot/);
    assert.match(source, /didHit && impactCueTip \? impactCueTip : cueTipShoot/);
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
