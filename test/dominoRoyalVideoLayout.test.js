import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_SCRIPT = path.resolve(__dirname, '../webapp/public/domino-royal-game.js');
const ARENA = path.resolve(__dirname, '../webapp/src/pages/Games/DominoRoyalArena.jsx');

test('Domino Royal bottom video frame matches the Murlan Royale avatar size', () => {
  const script = fs.readFileSync(PUBLIC_SCRIPT, 'utf8');
  const arena = fs.readFileSync(ARENA, 'utf8');

  expect(script).toContain('const MURLAN_BOTTOM_AVATAR_FRAME_REM = 3.25 * 0.98;');
  expect(script).toContain('candidate.style.width = size;');
  expect(script).toContain('candidate.style.height = size;');
  expect(arena).toContain('width: 3.185rem !important;');
  expect(arena).toContain('height: 3.185rem !important;');
});

test('Domino Royal centers the opponent at the top in a two-player match', () => {
  const script = fs.readFileSync(PUBLIC_SCRIPT, 'utf8');

  expect(script).toContain('} else if (N === 2) {');
  expect(script).toContain('x = rect.left + rect.width * 0.5;');
  expect(script).toContain('rect.height * HEAD_TO_HEAD_OPPONENT_TOP_RATIO');
});
