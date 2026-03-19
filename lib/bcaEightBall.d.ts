export type BcaEightBallState = any;
export type BcaEightBallShot = any;
export type BcaEightBallResult = any;
export class BcaEightBall {
  constructor();
  state: BcaEightBallState;
  shotTaken(shot: BcaEightBallShot): BcaEightBallResult;
}
export default BcaEightBall;
