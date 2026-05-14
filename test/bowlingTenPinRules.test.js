import {
  addTenPinRoll,
  frameComplete,
  getLegalTenPinMax,
  recomputePlayerTotals
} from '../webapp/src/pages/Games/bowlingTenPinRules.js';

const makePlayer = () => ({
  name: 'P1',
  total: 0,
  frames: Array.from({ length: 10 }, () => ({ rolls: [], cumulative: null }))
});

const rollMany = (player, rolls) =>
  rolls.map((pins) => addTenPinRoll(player, pins));

describe('official ten-pin bowling rules', () => {
  test('scores a perfect game as 300 with 10th-frame bonus strikes', () => {
    const player = makePlayer();
    const decisions = rollMany(player, Array(12).fill(10));

    expect(player.total).toBe(300);
    expect(player.frames[9].rolls).toEqual([10, 10, 10]);
    expect(decisions.at(-1).gameFinished).toBe(true);
  });

  test('scores spare bonuses and keeps cumulative frames pending until bonus roll arrives', () => {
    const player = makePlayer();
    addTenPinRoll(player, 5);
    addTenPinRoll(player, 5);

    expect(player.frames[0].cumulative).toBeNull();

    addTenPinRoll(player, 3);
    addTenPinRoll(player, 4);

    expect(player.frames[0].cumulative).toBe(13);
    expect(player.frames[1].cumulative).toBe(20);
    expect(player.total).toBe(20);
  });

  test('limits legal pinfall to the standing rack in normal frames and 10th-frame partial racks', () => {
    const player = makePlayer();
    addTenPinRoll(player, 8);
    addTenPinRoll(player, 8);

    expect(player.frames[0].rolls).toEqual([8, 2]);

    player.frames[9].rolls = [10, 7];
    expect(getLegalTenPinMax(player.frames[9], 9, 2)).toBe(3);
  });

  test('keeps open 10th frames to two rolls and strike/spare 10th frames to three rolls', () => {
    const open = { rolls: [4, 5], cumulative: null };
    const strikeBonus = { rolls: [10, 4], cumulative: null };
    const spareBonus = { rolls: [4, 6], cumulative: null };

    expect(frameComplete(open, 9)).toBe(true);
    expect(frameComplete(strikeBonus, 9)).toBe(false);
    expect(frameComplete(spareBonus, 9)).toBe(false);

    strikeBonus.rolls.push(3);
    spareBonus.rolls.push(8);
    expect(frameComplete(strikeBonus, 9)).toBe(true);
    expect(frameComplete(spareBonus, 9)).toBe(true);
  });

  test('scores all nines as 90 open-frame game', () => {
    const player = makePlayer();
    player.frames.forEach((frame) => frame.rolls.push(9, 0));
    recomputePlayerTotals(player);

    expect(player.total).toBe(90);
    expect(player.frames[9].cumulative).toBe(90);
  });
});
