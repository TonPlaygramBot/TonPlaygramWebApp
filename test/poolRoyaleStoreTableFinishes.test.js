import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import {
  POOL_ROYALE_OPTION_LABELS,
  POOL_ROYALE_STORE_ITEMS
} from '../webapp/src/config/poolRoyaleInventoryConfig.js';

test('Pool Royale store exposes new oak veneer and carbon fiber table finishes', () => {
  const expectedOptionIds = [
    'oakVeneer01Honey',
    'oakVeneer01SmokedWalnut',
    'oakVeneer01GraphiteBrown',
    'oakVeneer01RoseTaupe',
    'oakVeneer01MatteBlack',
    'carbonFiberMatteDarkGrey'
  ];

  const tableFinishLabels = POOL_ROYALE_OPTION_LABELS.tableFinish || {};
  const storeOptionIds = new Set(
    POOL_ROYALE_STORE_ITEMS
      .filter((item) => item.type === 'tableFinish')
      .map((item) => item.optionId)
  );

  expectedOptionIds.forEach((optionId) => {
    assert.equal(typeof tableFinishLabels[optionId], 'string');
    assert.ok(tableFinishLabels[optionId].length > 0);
    assert.ok(storeOptionIds.has(optionId));
  });
});
