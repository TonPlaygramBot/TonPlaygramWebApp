import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALBANIAN_61_ID,
  arePoolVariantsCompatible,
  isAlbanian61Variant,
  resolvePoolLobbyVariant
} from '../webapp/src/config/poolRoyaleVariants.js';
import { getVariantThumbnail } from '../webapp/src/config/gameAssets.js';

test('Albanian 61 links and online metadata aliases resolve to the same ruleset', () => {
  for (const alias of ['albanian61', 'Albanian 61', 'albanian-61', '61', '61_points', 'rotation61', 'race61']) {
    assert.equal(isAlbanian61Variant(alias), true);
    assert.equal(resolvePoolLobbyVariant(alias), ALBANIAN_61_ID);
    assert.equal(arePoolVariantsCompatible(alias, ALBANIAN_61_ID), true);
  }
  assert.equal(resolvePoolLobbyVariant('9-ball'), '9ball');
  assert.equal(resolvePoolLobbyVariant('uk'), 'uk');
  assert.equal(resolvePoolLobbyVariant(undefined), 'uk');
  assert.equal(isAlbanian61Variant('8ball'), false);
});

test('61-point players cannot enter legacy or other-rule online queues', () => {
  for (const other of ['', undefined, 'uk', 'american', '8ball', '9ball']) {
    assert.equal(arePoolVariantsCompatible(ALBANIAN_61_ID, other), false);
    assert.equal(arePoolVariantsCompatible(other, ALBANIAN_61_ID), false);
  }
  assert.equal(arePoolVariantsCompatible('', 'uk'), true);
  assert.equal(arePoolVariantsCompatible('8ball', '9ball'), false);
});

test('61-point lobby provides a numbered full-rack thumbnail', () => {
  assert.equal(getVariantThumbnail('poolroyale', ALBANIAN_61_ID), getVariantThumbnail('poolroyale', 'american'));
  assert.ok(getVariantThumbnail('poolroyale', ALBANIAN_61_ID));
});
