import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARENA_COMPONENT = path.resolve(
  __dirname,
  '../webapp/src/pages/Games/DominoRoyalArena.jsx'
);

describe('Domino Royal lightweight presentation', () => {
  const source = fs.readFileSync(ARENA_COMPONENT, 'utf8');
  const gameSource = fs.readFileSync(
    path.resolve(__dirname, '../webapp/public/domino-royal-game.js'),
    'utf8'
  );

  test('contains no human character implementation or avatar service connections', () => {
    expect(gameSource).not.toContain('Domino Royal seated human characters');
    expect(gameSource).not.toContain('DOMINO_CHARACTER_THEMES');
    expect(gameSource).not.toContain('runDominoCharacterAction');
    expect(gameSource).not.toContain('SkeletonUtils');
    expect(source).not.toContain('models.readyplayer.me');
    expect(source).not.toContain('avatars.readyplayer.me');
  });

  test('contains no voice commentary implementation', () => {
    expect(source).not.toMatch(/voiceCommentary|speechSynthesis/i);
    expect(gameSource).not.toMatch(/voiceCommentary|speechSynthesis/i);
  });
});
