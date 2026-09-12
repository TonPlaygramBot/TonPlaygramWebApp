export const MOTOR: Readonly<Record<string, number>>;
export function createBody(
  yaw?: number
): import('./StreetSimulation.mjs').BodyState;
export function cancelActions(
  p: import('../shared/engine.mjs').Player,
  b: import('./StreetSimulation.mjs').BodyState
): void;
