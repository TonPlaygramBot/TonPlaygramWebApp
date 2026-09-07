import { BowlingPhysics, FIXED_STEP, pinSpots } from './physics.mjs';
export const ALL_PINS = Object.freeze(pinSpots().map((p) => p.id));
export const APPROACH_MS = 1150;
export const RESULT_MS = 2400;
export const REPLAY_HZ = 24;
const round = (n) => Math.round(n * 100000) / 100000;
export function sanitizeShot(value) {
  if (!value || typeof value !== 'object') return null;
  const { aim, hook, power } = value;
  if (
    ![aim, hook, power].every(
      (v) => typeof v === 'number' && Number.isFinite(v)
    )
  )
    return null;
  if (Math.abs(aim) > 1.2 || Math.abs(hook) > 1 || power < 35 || power > 100)
    return null;
  return { aim: round(aim), hook: round(hook), power: round(power) };
}
function bodyFrame(body) {
  return [
    body.position.x,
    body.position.y,
    body.position.z,
    body.quaternion.x,
    body.quaternion.y,
    body.quaternion.z,
    body.quaternion.w
  ].map(round);
}
/** Actual physics, never a client pin-count or win claim. Used identically by both workers. */
export function simulateRoll({ shot, standing = ALL_PINS }) {
  const input = sanitizeShot(shot);
  if (
    !input ||
    !Array.isArray(standing) ||
    !standing.length ||
    standing.length > 10 ||
    new Set(standing).size !== standing.length ||
    standing.some((id) => !ALL_PINS.includes(id))
  )
    throw Error('invalid_roll');
  const physics = new BowlingPhysics();
  physics.resetRack(standing);
  physics.launch(input);
  const frames = [],
    stride = 7 * (standing.length + 1);
  const capture = () =>
    frames.push([
      ...bodyFrame(physics.ball),
      ...physics.pins.flatMap((p) => bodyFrame(p.body))
    ]);
  capture();
  let nextCapture = 1 / REPLAY_HZ;
  while (physics.elapsed < 8.05) {
    physics.step(FIXED_STEP);
    if (physics.elapsed + 1e-8 >= nextCapture) {
      capture();
      nextCapture += 1 / REPLAY_HZ;
    }
    if (physics.isSettled()) break;
  }
  const result = {
    input,
    ids: [...standing],
    hz: REPLAY_HZ,
    stride,
    frames,
    standing: physics.standingIds(),
    gutter: physics.gutter,
    durationMs: Math.ceil((frames.length / REPLAY_HZ) * 1000)
  };
  result.knocked = standing.length - result.standing.length;
  physics.dispose();
  return result;
}
export function chooseAiShot(
  standing,
  difficulty = 'club',
  random = Math.random
) {
  const spots = pinSpots().filter((p) => standing.includes(p.id));
  if (!spots.length) return { aim: 0.055, hook: 0, power: 76 };
  let aim = 0.06;
  if (standing.length < 10) {
    const clusters = spots
      .map((p) => ({
        p,
        near: spots.filter((q) => Math.abs(q.x - p.x) < 0.22)
      }))
      .sort((a, b) => b.near.length - a.near.length || b.p.z - a.p.z);
    aim =
      clusters[0].near.reduce((sum, p) => sum + p.x, 0) /
      clusters[0].near.length;
  }
  const spread = { casual: 0.17, club: 0.075, pro: 0.027 }[difficulty] ?? 0.075;
  return {
    aim: Math.max(-1.2, Math.min(1.2, aim + (random() - 0.5) * spread * 2)),
    hook: (random() - 0.5) * 0.09,
    power: 72 + random() * 16
  };
}
