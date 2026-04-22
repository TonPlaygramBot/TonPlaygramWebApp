import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { POOL_ROYALE_HDRI_VARIANTS } from '../webapp/src/config/poolRoyaleInventoryConfig.js';

const DOMINO_PUBLIC_SCRIPT = 'webapp/public/domino-royal-game.js';

function readDominoHdriIdsFromPublicScript() {
  const script = readFileSync(DOMINO_PUBLIC_SCRIPT, 'utf8');
  const match = script.match(/const POOL_ROYALE_HDRI_VARIANTS = Object\.freeze\(\[(.*?)\]\);/s);
  assert.ok(match, 'Expected Domino public script to declare POOL_ROYALE_HDRI_VARIANTS');
  const arrayBody = match[1];
  return new Set(Array.from(arrayBody.matchAll(/id:\s*'([^']+)'/g), (entry) => entry[1]));
}

test('Domino Royal public HDRI catalog includes every shared Pool Royale HDRI id', () => {
  const dominoHdriIds = readDominoHdriIdsFromPublicScript();
  const missingIds = POOL_ROYALE_HDRI_VARIANTS.map((variant) => variant.id).filter(
    (id) => !dominoHdriIds.has(id)
  );

  assert.deepEqual(
    missingIds,
    [],
    `Domino public catalog is missing shared HDRI ids: ${missingIds.join(', ')}`
  );
});
