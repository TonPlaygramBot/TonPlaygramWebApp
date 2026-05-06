import assert from 'node:assert/strict';
import {
  applySnookerTableModelParam,
  resolveSnookerTableModel,
  TABLE_MODEL_CLASSIC,
  TABLE_MODEL_OPENSOURCE
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

  test('applySnookerTableModelParam always writes a safe tableModel param', () => {
    const params = new URLSearchParams();
    applySnookerTableModelParam(params, 'opensource');
    assert.equal(params.get('tableModel'), TABLE_MODEL_OPENSOURCE);

    applySnookerTableModelParam(params, 'unknown');
    assert.equal(params.get('tableModel'), TABLE_MODEL_CLASSIC);
  });
});
