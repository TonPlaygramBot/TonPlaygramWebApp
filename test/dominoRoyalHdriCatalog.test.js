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

test('Domino Royal keeps 8K HDRI for 120 Hz quality profile on mobile and desktop', () => {
  const script = readFileSync(DOMINO_PUBLIC_SCRIPT, 'utf8');

  assert.match(
    script,
    /case\s+'uhd120':\s*\n\s*return\s+'8k';/,
    'Expected uhd120 HDRI resolution to resolve to 8k'
  );

  assert.doesNotMatch(
    script,
    /IS_HIGH_REFRESH_MOBILE\s*\?\s*\['4k',\s*'2k'\]/,
    'Expected no mobile-only HDRI downgrade for uhd120'
  );
});
