import assert from 'node:assert/strict';
import {
  applySnookerTableModelParam,
  resolveSnookerTableModel,
  TABLE_MODEL_CLASSIC,
  TABLE_MODEL_OPENSOURCE,
  TABLE_MODEL_OPENSOURCE_GLB_URL,
  TABLE_MODEL_SHOWOOD,
  TABLE_MODEL_SHOWOOD_ASSET_URL
} from '../webapp/src/pages/Games/snookerTableModel.js';

describe('snooker table model selection', () => {
  test('resolveSnookerTableModel defaults to classic', () => {
    assert.equal(resolveSnookerTableModel(null), TABLE_MODEL_CLASSIC);
    assert.equal(resolveSnookerTableModel(''), TABLE_MODEL_CLASSIC);
    assert.equal(resolveSnookerTableModel('invalid'), TABLE_MODEL_CLASSIC);
  });

  test('resolveSnookerTableModel accepts opensource value case-insensitively', () => {
    assert.equal(resolveSnookerTableModel('opensource'), TABLE_MODEL_OPENSOURCE);
    assert.equal(resolveSnookerTableModel('OpenSource'), TABLE_MODEL_OPENSOURCE);
  });

  test('resolveSnookerTableModel accepts showood aliases case-insensitively', () => {
    assert.equal(resolveSnookerTableModel('showood'), TABLE_MODEL_SHOWOOD);
    assert.equal(resolveSnookerTableModel('Showood-Seven-Foot'), TABLE_MODEL_SHOWOOD);
  });

  test('applySnookerTableModelParam always writes a safe tableModel param', () => {
    const params = new URLSearchParams();
    applySnookerTableModelParam(params, 'opensource');
    assert.equal(params.get('tableModel'), TABLE_MODEL_OPENSOURCE);

    applySnookerTableModelParam(params, 'showood');
    assert.equal(params.get('tableModel'), TABLE_MODEL_SHOWOOD);

    applySnookerTableModelParam(params, 'unknown');
    assert.equal(params.get('tableModel'), TABLE_MODEL_CLASSIC);
  });

  test('uses the Pooltool snooker_generic and Showood GLB sources', () => {
    assert.match(
      TABLE_MODEL_OPENSOURCE_GLB_URL,
      /pooltool\/models\/table\/snooker_generic\/snooker_generic\.glb$/
    );
    assert.match(
      TABLE_MODEL_SHOWOOD_ASSET_URL,
      /pooltool\/models\/table\/seven_foot_showood\/seven_foot_showood_pbr\.glb$/
    );
  });
});
