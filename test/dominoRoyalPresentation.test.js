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

  test('restores the shared seated human characters at every occupied chair', () => {
    expect(source).toContain('createRestoredSeatedHumanActor');
    expect(source).toContain('applySeatedHumanPose');
    expect(source).toContain('loadSeatedHumanTemplate');
    expect(source).toContain('__DOMINO_ROYAL_SEATED_HUMANS__');
    expect(gameSource).toContain('chairs.forEach((chair, visualSeatIndex) =>');
    expect(gameSource).toContain('LEGACY_DOMINO_HUMAN_HEIGHT = 1.13');
    expect(gameSource).toContain('restoreLegacyScale: true');
    expect(gameSource).toContain("runSeatedHumanDominoAction(current, 'placePiece')");
    expect(gameSource).toContain("runSeatedHumanDominoAction(human, 'placePiece')");
    expect(gameSource).toContain('seatHeight: STOOL_HEIGHT');
    expect(gameSource).toContain(
      "console.warn('Unable to restore Domino Royal seated humans', error)"
    );
  });

  test('does not connect the restored humans to external avatar services', () => {
    expect(source).not.toContain('models.readyplayer.me');
    expect(source).not.toContain('avatars.readyplayer.me');
  });

  test('contains no voice commentary implementation', () => {
    expect(source).not.toMatch(/voiceCommentary|speechSynthesis/i);
    expect(gameSource).not.toMatch(/voiceCommentary|speechSynthesis/i);
  });
});
