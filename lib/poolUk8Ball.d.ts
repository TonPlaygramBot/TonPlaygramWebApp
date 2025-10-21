export type UkPoolState = any;
export type UkPoolShot = any;
export type UkPoolShotResult = any;
export interface UkPoolRules {
  [key: string]: unknown;
}
export const DEFAULT_RULES: UkPoolRules;
export class UkPool {
  constructor(rules?: UkPoolRules);
  state: UkPoolState;
  startBreak(): void;
  shotTaken(shot: UkPoolShot): UkPoolShotResult;
}
