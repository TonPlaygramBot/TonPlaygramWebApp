import type { AnimationAction } from 'three';
export class ClipTransitions {
  constructor(duration?: number);
  reset(actions: AnimationAction[]): void;
  select(action?: AnimationAction | null, initialPhase?: number): void;
  update(dt: number): void;
}
