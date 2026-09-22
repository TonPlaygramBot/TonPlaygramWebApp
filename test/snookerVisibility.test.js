import { isSnookerObstructed } from '../webapp/src/utils/snookerVisibility.js';

const cue = { id: 'cue', pos: { x: 0, y: 0 }, active: true };
const ball = (id, x, y) => ({ id, pos: { x, y }, active: true });
const check = (balls, extra = {}) => isSnookerObstructed({ cue, balls: [cue, ...balls], ballOn: ['RED'], ballRadius: 1, ...extra });

test('an unobstructed red is not a snooker', () => {
  expect(check([ball('red_1', 12, 0), ball('black', 5, 5)])).toBe(false);
});

test('blocking one extreme edge counts even when the centre is visible', () => {
  expect(check([ball('red_1', 12, 0), ball('black', 6, 2.6)])).toBe(true);
});

test('render material colors do not override actual ball identities', () => {
  expect(check([{ ...ball('red_1', 12, 0), color: 0xff0000 },
    { ...ball('black', 6, 2.6), color: '#222222' }])).toBe(true);
});

test('a second red with both edges visible defeats the snooker', () => {
  expect(check([ball('red_1', 12, 0), ball('red_2', 0, -12), ball('black', 6, 2.6)])).toBe(false);
});

test('another ball on cannot snooker the target', () => {
  expect(check([ball('red_1', 12, 0), ball('red_2', 6, 0)])).toBe(false);
});

test('a ball behind the target cannot obstruct the first contact', () => {
  expect(check([ball('red_1', 12, 0), ball('black', 16, 0)])).toBe(false);
});

test('no free ball inferred from a scratched cue or unproven D placements', () => {
  const balls = [ball('red_1', 12, 0), ball('black', 6, 0)];
  expect(check(balls)).toBe(true);
  expect(check(balls, { ballInHand: true })).toBe(false);
  expect(check(balls, { cue: { ...cue, active: false } })).toBe(false);
});

test('ordered colours use only the actual ball on and ignore removed blockers', () => {
  expect(check([ball('yellow', 12, 0), ball('red_1', 6, 0)], { ballOn: ['YELLOW'] })).toBe(true);
  expect(check([ball('yellow', 12, 0), { ...ball('red_1', 6, 0), active: false }], { ballOn: ['YELLOW'] })).toBe(false);
});
