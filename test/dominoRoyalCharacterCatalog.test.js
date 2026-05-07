import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MURLAN_CHARACTER_THEMES } from '../webapp/src/config/murlanCharacterThemes.js';

const DOMINO_PUBLIC_SCRIPT = 'webapp/public/domino-royal-game.js';

function readDominoCharacterBlock() {
  const script = readFileSync(DOMINO_PUBLIC_SCRIPT, 'utf8');
  const match = script.match(/const DOMINO_CHARACTER_THEMES = Object\.freeze\(\[(.*?)\]\s*\.map/s);
  assert.ok(match, 'Expected Domino public script to declare DOMINO_CHARACTER_THEMES');
  return match[1];
}

test('Domino Royal public character catalog includes every Murlan Royale human character', () => {
  const block = readDominoCharacterBlock();
  const dominoIds = new Set(Array.from(block.matchAll(/id:\s*'([^']+)'/g), (entry) => entry[1]));
  const missingIds = MURLAN_CHARACTER_THEMES.map((theme) => theme.id).filter((id) => !dominoIds.has(id));

  assert.deepEqual(
    missingIds,
    [],
    `Domino public character catalog is missing Murlan human ids: ${missingIds.join(', ')}`
  );
});

test('Domino Royal assigns random non-duplicate seated human themes before loading seats', () => {
  const script = readFileSync(DOMINO_PUBLIC_SCRIPT, 'utf8');

  assert.match(script, /function reshuffleDominoCharacterThemesForSeats/);
  assert.match(script, /dominoCharacterThemeOrder = availableThemes\.slice\(0, Math\.max\(1, Math\.min\(seatCount, availableThemes\.length\)\)\)/);
  assert.match(script, /reshuffleDominoCharacterThemesForSeats\(chairs\.length\)/);
});

test('Domino Royal character materials use Poly Haven cloth PBR texture sets', () => {
  const script = readFileSync(DOMINO_PUBLIC_SCRIPT, 'utf8');
  const textureIds = Array.from(script.matchAll(/clothTexture:\s*'([^']+)'/g), (entry) => entry[1]);

  assert.equal(textureIds.length, MURLAN_CHARACTER_THEMES.length);
  assert.ok(new Set(textureIds).size >= 4, 'Expected multiple cloth texture choices for seated humans');
  assert.match(script, /polyHavenTextureSet\('bi_stretch', '1k'\)/);
  assert.match(script, /loadDominoCharacterClothTextureSet/);
});
