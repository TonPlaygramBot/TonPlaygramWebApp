import { findSnookerRespot } from '../webapp/src/pages/Games/snookerRoyalRespot';

const spots = { yellow: [-2, -6], green: [2, -6], brown: [0, -6], blue: [0, 0], pink: [0, 4], black: [0, 8] };
const ball = (x: number, y: number) => ({ active: true, pos: { x, y } });
const find = (color: string, balls: ReturnType<typeof ball>[], reserved: { x: number; z: number }[] = []) =>
  findSnookerRespot(color, spots, balls, reserved, 0.5, 10);

test('a potted colour returns to its own vacant spot', () => {
  expect(find('PINK', [])).toEqual({ x: 0, z: 4 });
});
test('an occupied own spot uses the highest-value vacant spot', () => {
  expect(find('PINK', [ball(0, 4)])).toEqual({ x: 0, z: 8 });
});
test('multiple respots respect positions already reserved', () => {
  expect(find('PINK', [ball(0, 4)], [{ x: 0, z: 8 }])).toEqual({ x: 0, z: 0 });
});
test('when all spots are occupied, placement stays on the colour longitudinal line', () => {
  const balls = Object.values(spots).map(([x, y]) => ball(x, y));
  const result = find('BLUE', balls)!;
  expect(result.x).toBe(0);
  expect(result.z).toBeGreaterThan(0);
  expect(result.z).toBeLessThan(2);
  for (const b of balls) expect(Math.hypot(result.x - b.pos.x, result.z - b.pos.y)).toBeGreaterThanOrEqual(1.01);
});
test('black can be placed towards pink when blocked against the black cushion', () => {
  const balls = Object.values(spots).map(([x, y]) => ball(x, y));
  balls.push(ball(0, 9), ball(0, 10));
  const result = find('BLACK', balls)!;
  expect(result.x).toBe(0);
  expect(result.z).toBeLessThan(8);
  for (const b of balls) expect(Math.hypot(result.x - b.pos.x, result.z - b.pos.y)).toBeGreaterThanOrEqual(1.01);
});
test('an impossible placement never returns an occupied fallback spot', () => {
  const balls = Object.values(spots).map(([x, y]) => ball(x, y));
  for (let z = -10; z <= 10; z += 0.5) balls.push(ball(0, z));
  expect(find('BLACK', balls)).toBeNull();
});
