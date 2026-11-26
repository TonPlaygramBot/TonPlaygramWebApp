export const MOTOR: Readonly<Record<string, number>>;
export function jumpBlockedReason(body: Pick<import('./StreetSimulation.mjs').BodyState, 'crouched' | 'grounded' | 'groundAt' | 'vy'>, now: number, floorGap: number): '' | 'Stand before jumping' | 'In the air';
export function createBody(
  yaw?: number
): import('./StreetSimulation.mjs').BodyState;
export function cancelActions(
  p: import('../shared/engine.mjs').Player,
  b: import('./StreetSimulation.mjs').BodyState
): void;
