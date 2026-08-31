import { readFile } from 'node:fs/promises';

describe('Chess Battle Royal presentation', () => {
  let source;

  beforeAll(async () => {
    source = await readFile('webapp/src/pages/Games/ChessBattleRoyal.jsx', 'utf8');
  });

  test('contains no seated human character implementation', () => {
    expect(source).not.toMatch(/humanCharacter|loadSeatedHuman|seatedHumanActors/i);
  });

  test('contains no voice commentary implementation', () => {
    expect(source).not.toMatch(/commentary|speechSynthesis|textToSpeech/i);
  });
});
