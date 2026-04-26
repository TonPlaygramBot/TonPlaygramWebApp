export type BilardoShqipState = any;
export type BilardoShqipShot = any;
export type BilardoShqipResult = any;

export class BilardoShqipRules {
  constructor(options?: { targetScore?: number });
  state: BilardoShqipState;
  shotTaken(shot: BilardoShqipShot): BilardoShqipResult;
}

export default BilardoShqipRules;
