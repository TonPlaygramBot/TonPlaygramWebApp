import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOMINO_PUBLIC_SCRIPT = path.resolve(__dirname, '../webapp/public/domino-royal-game.js');

function readNumericConstant(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9.]+);`));
  if (!match) throw new Error(`Missing ${name} constant`);
  return Number(match[1]);
}

test('Domino Royal seated human characters stay readable while appearing smaller on screen', () => {
  const source = fs.readFileSync(DOMINO_PUBLIC_SCRIPT, 'utf8');
  const baseScale = readNumericConstant(source, 'DOMINO_CHARACTER_PROPORTION_SCALE');
  const humanBoost = readNumericConstant(source, 'DOMINO_HUMAN_CHARACTER_SCALE_BOOST');

  expect(baseScale).toBeGreaterThanOrEqual(2.5);
  expect(baseScale + humanBoost).toBeGreaterThanOrEqual(3.3);
});
