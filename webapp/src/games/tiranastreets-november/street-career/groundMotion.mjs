// Animation-only response to actual collision-limited ground displacement.
import {MOTOR} from './playerCore.mjs';

const finite = value => Number.isFinite(value) ? value : 0;
const clamp = (n,min,max) => Math.min(max,Math.max(min,n));
export function groundMotion(previous, {speed: reported, travelX, travelZ, free, dt}) {
  if (!free) return {speed:0,moving:false,running:false};
  const actual = clamp(Math.min(finite(reported),Math.hypot(finite(travelX),finite(travelZ))),0,MOTOR.sprint);
  const seconds = clamp(finite(dt),0,.1);
  const old = finite(previous?.speed);
  const speed = actual === 0 ? 0 : actual + (old - actual)*Math.exp(-(actual>old?22:30)*seconds);
  const moving = speed > (previous?.moving ? .08 : .16);
  // A full normal walk stays on the walk clip. Allow the analog stick to
  // decelerate through the transition without toggling between clips.
  const running = moving && speed > (previous?.running ? MOTOR.walk+.04 : MOTOR.walk+.28);
  return {speed,moving,running};
}

export function groundCadence(speed, runningClip) {
  return clamp(finite(speed)/(runningClip?MOTOR.run:MOTOR.walk),.12,2.2);
}

export function stridePhase(time,duration) {
  if(!Number.isFinite(time)||!Number.isFinite(duration)||duration<=0)return 0;
  return ((time/duration)%1+1)%1;
}
