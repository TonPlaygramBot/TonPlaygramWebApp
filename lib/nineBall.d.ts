export type NineBallState = any;
export type NineBallShot = any;
export type NineBallResult = any;
export class NineBall {
  constructor();
  state: NineBallState;
  rack(): void;
  shotTaken(shot: NineBallShot): NineBallResult;
}
