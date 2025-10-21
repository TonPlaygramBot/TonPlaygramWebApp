export type AmericanBilliardsState = any;
export type AmericanBilliardsShot = any;
export type AmericanBilliardsResult = any;
export class AmericanBilliards {
  constructor();
  state: AmericanBilliardsState;
  rack(): void;
  shotTaken(shot: AmericanBilliardsShot): AmericanBilliardsResult;
}
