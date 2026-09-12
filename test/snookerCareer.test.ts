import { SnookerRoyalRules } from '../src/rules/SnookerRoyalRules';
import {
  calendar,
  createCareer,
  enterEvent,
  completeCareerFrame,
  frameId,
  nextSeason,
  saveCheckpoint,
  loadCareer,
  saveCareer,
  rankingPoints,
  careerAimError
} from '../webapp/src/games/snooker/career';
import { resolveSnookerLaunchOptions } from '../webapp/src/games/snooker/launchOptions';
const rules = new SnookerRoyalRules();
const win = (winner: 'A' | 'B' = 'A') => ({
  ...rules.getInitialFrame('You', 'Rival'),
  frameOver: true,
  winner
});

test('lobby choices reach the snooker rules, table and multiplayer mode', () => {
  expect(
    resolveSnookerLaunchOptions(
      '?mode=online&type=tournament&tableSize=10ft&accountId=42&name=Alex'
    )
  ).toMatchObject({
    variantKey: 'snooker',
    mode: 'online',
    playType: 'tournament',
    tableSizeKey: '10ft',
    accountId: '42',
    playerName: 'Alex'
  });
  expect(
    resolveSnookerLaunchOptions('?mode=unknown&variant=american').variantKey
  ).toBe('snooker');
});
test('a best-of-three requires two frames and ignores duplicated or stale results', () => {
  const initial = enterEvent(createCareer());
  const next = completeCareerFrame(initial, frameId(initial), win());
  expect(next.match!.frames).toEqual([1, 0]);
  expect(next.match!.round).toBe(0);
  expect(completeCareerFrame(next, frameId(initial), win())).toBe(next);
  const advance = completeCareerFrame(next, frameId(next), win());
  expect(advance.match!.round).toBe(1);
  expect(advance.match!.frames).toEqual([0, 0]);
  expect(advance.draw![0].every((p) => Boolean(p.winner))).toBe(true);
  expect(initial.match!.frames).toEqual([0, 0]);
});
test('a final loss awards runner-up credits, completes the draw and advances calendar', () => {
  let c = enterEvent(createCareer());
  for (let i = 0; i < 4; i++) c = completeCareerFrame(c, frameId(c), win());
  expect(c.match!.bestOf).toBe(5);
  for (let i = 0; i < 3; i++) c = completeCareerFrame(c, frameId(c), win('B'));
  expect(c.match).toBeUndefined();
  expect(c.eventIndex).toBe(1);
  expect(c.lastResult!.finish).toBe('Runner-up');
  expect(c.lastResult!.champion).not.toBe('player');
  expect(c.titles).toBe(0);
  expect(rankingPoints(c)).toBe(500);
});
test('full season promotion, longer professional formats and rolling ranking expiry', () => {
  let c = createCareer();
  for (let e = 0; e < 4; e++) {
    c = enterEvent(c);
    while (c.match) c = completeCareerFrame(c, frameId(c), win());
  }
  expect(c.titles).toBe(4);
  expect(nextSeason(c).tier).toBe('qualifying');
  expect(calendar('professional')[3].rounds).toEqual([9, 11, 19]);
  c.season = 3;
  expect(rankingPoints(c)).toBe(0);
});
test('checkpoints preserve ball positions and frame state across save/reload', () => {
  const c = enterEvent(createCareer());
  const frame = rules.getInitialFrame('You', 'Rival');
  const saved = saveCheckpoint(c, frameId(c), frame, [
    { id: 'cue', pos: { x: 12, y: 34 }, active: true }
  ]);
  let raw = '';
  const storage = {
    setItem: (_: string, v: string) => {
      raw = v;
    },
    getItem: () => raw
  };
  expect(saveCareer(saved, storage)).toBe(true);
  expect(loadCareer(storage).match!.checkpoint).toEqual(
    saved.match!.checkpoint
  );
  expect(saveCheckpoint(saved, 'stale', frame, [])).toBe(saved);
  expect(loadCareer({ getItem: () => '{invalid' }).season).toBe(1);
  expect(
    saveCareer(saved, {
      setItem: () => {
        throw Error('quota');
      }
    })
  ).toBe(false);
});
test('opponent error stays bounded and improves on the professional tour', () => {
  const c = enterEvent(createCareer());
  const club = Math.abs(careerAimError(c, () => 1));
  c.tier = 'professional';
  expect(Math.abs(careerAimError(c, () => 1))).toBeLessThan(club);
  expect(club).toBeLessThan(0.018);
});
