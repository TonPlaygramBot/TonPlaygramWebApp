import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveTableSize as resolveClubTableSize } from '../webapp/src/config/snookerClubTables.js';
import { resolveTableSize as resolveRoyalTableSize } from '../webapp/src/config/snookerRoyalTables.js';

describe('Snooker Royal physical table specs', () => {
  test('defaults to an official 12ft snooker playing area', () => {
    const table = resolveClubTableSize();

    assert.equal(table.id, '12ft');
    assert.deepEqual(table.playfield, { widthMm: 3569, heightMm: 1778 });
    assert.equal(table.ballDiameterMm, 52.5);
    assert.equal(table.ballDiameterToleranceMm, 0.05);
  });

  test('keeps Snooker Royal table metadata on snooker pockets and balls', () => {
    const table = resolveRoyalTableSize();

    assert.equal(table.id, '12ft');
    assert.deepEqual(table.playfield, { widthMm: 3569, heightMm: 1778 });
    assert.equal(table.ballDiameterMm, 52.5);
    assert.equal(table.ballDiameterToleranceMm, 0.05);
    assert.deepEqual(table.pocketMouthMm, { corner: 83, side: 87 });
    assert.equal(table.pocketTemplate, 'WPBSA-authorised snooker cushion template');
  });

  test('Snooker Royal scene uses official snooker dimensions instead of Pool Royale sizing', async () => {
    const source = await readFile('webapp/src/pages/Games/SnookerRoyal.jsx', 'utf8');

    assert.match(source, /const WIDTH_REF = 3569;/);
    assert.match(source, /const HEIGHT_REF = 1778;/);
    assert.match(source, /const TARGET_RATIO = WIDTH_REF \/ HEIGHT_REF;/);
    assert.match(source, /const BALL_D_REF = 52\.5;/);
    assert.match(source, /const BALL_SIZE_SCALE = 1;/);
    assert.match(source, /const CORNER_MOUTH_REF = 83;/);
    assert.match(source, /const SIDE_MOUTH_REF = 87;/);
    assert.doesNotMatch(source, /const BALL_D_REF = 57\.15;/);
    assert.doesNotMatch(source, /const TARGET_RATIO = 1\.83;/);
  });
});
