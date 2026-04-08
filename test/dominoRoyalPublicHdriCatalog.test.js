import fs from 'node:fs';
import { POOL_ROYALE_HDRI_VARIANTS } from '../webapp/src/config/poolRoyaleInventoryConfig.js';

const dominoScriptPath = `${process.cwd()}/webapp/public/domino-royal-game.js`;

function parseDominoHdriIds(scriptSource) {
  const blockMatch = scriptSource.match(
    /const POOL_ROYALE_HDRI_VARIANTS = Object\.freeze\(\[(.*?)\]\);/s
  );
  if (!blockMatch) return [];
  const idMatches = blockMatch[1].matchAll(/id:\s*'([^']+)'/g);
  return Array.from(idMatches, (match) => match[1]);
}

describe('Domino Royal public script HDRI catalog', () => {
  test('includes every shared Pool Royale HDRI id so owned inventory entries can render', () => {
    const scriptSource = fs.readFileSync(dominoScriptPath, 'utf8');
    const dominoHdriIds = new Set(parseDominoHdriIds(scriptSource));

    POOL_ROYALE_HDRI_VARIANTS.forEach((variant) => {
      expect(dominoHdriIds.has(variant.id)).toBe(true);
    });
  });
});
