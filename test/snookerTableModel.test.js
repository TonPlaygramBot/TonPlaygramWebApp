import assert from 'node:assert/strict';
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

  test('resolveSnookerGlbFitTransform maps GLB bounds exactly onto the procedural table', () => {
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
