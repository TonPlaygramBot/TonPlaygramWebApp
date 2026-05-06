const assert = require('node:assert/strict');
const {
  normalizeSnookerTableModel,
  setSnookerTableModelParam,
  SNOOKER_TABLE_MODEL_CLASSIC,
  SNOOKER_TABLE_MODEL_OPENSOURCE
} = require('../webapp/src/pages/Games/snookerTableModel.js');

test('normalizeSnookerTableModel keeps only supported values', () => {
  assert.equal(normalizeSnookerTableModel('opensource'), SNOOKER_TABLE_MODEL_OPENSOURCE);
  assert.equal(normalizeSnookerTableModel('OpenSource'), SNOOKER_TABLE_MODEL_OPENSOURCE);
  assert.equal(normalizeSnookerTableModel('classic'), SNOOKER_TABLE_MODEL_CLASSIC);
  assert.equal(normalizeSnookerTableModel('unknown'), SNOOKER_TABLE_MODEL_CLASSIC);
  assert.equal(normalizeSnookerTableModel(null), SNOOKER_TABLE_MODEL_CLASSIC);
});

test('setSnookerTableModelParam writes normalized query value', () => {
  const params = new URLSearchParams();
  setSnookerTableModelParam(params, 'opensource');
  assert.equal(params.get('tableModel'), SNOOKER_TABLE_MODEL_OPENSOURCE);

  setSnookerTableModelParam(params, 'bad-value');
  assert.equal(params.get('tableModel'), SNOOKER_TABLE_MODEL_CLASSIC);
});
