// The existing solver stores velocity per 60 Hz tick. A 120 Hz accumulator
// makes each simulation step exactly half a legacy tick, independent of graphics FPS.
export const SNOOKER_PHYSICS_STEP_MS = 1000 / 120;
export const SNOOKER_PHYSICS_STEP_SCALE = 0.5;
export type SnookerPhysicsClock = { remainderMs: number };
export function consumeSnookerPhysicsTime(
  clock: SnookerPhysicsClock,
  elapsedMs: number
) {
  const elapsed = Number.isFinite(elapsedMs)
    ? Math.max(0, Math.min(100, elapsedMs))
    : 0;
  const available = Math.max(0, clock.remainderMs || 0) + elapsed;
  const steps = Math.min(
    12,
    Math.floor((available + 1e-7) / SNOOKER_PHYSICS_STEP_MS)
  );
  clock.remainderMs = Math.max(0, available - steps * SNOOKER_PHYSICS_STEP_MS);
  return { steps, stepScale: SNOOKER_PHYSICS_STEP_SCALE, elapsedMs: elapsed };
}
