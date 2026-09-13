/** Brake to a stop, then keep the pedal held to engage reverse. AI braking
 * never selects reverse, and overlapping gas/brake fingers cannot engage it. */
export function drivePedals(r, input, dt) {
  const brake = input.brake === true;
  const held = brake && !input.throttle && !r.ai;
  r.brakeHold = held && Math.abs(r.speed) < .35
    ? Math.min(.45, (r.brakeHold || 0) + dt)
    : held && r.brakeHold >= .4 ? .45 : 0;
  r.reversing = input.reverse === true || (held && r.brakeHold >= .4);
  return { ...input, brake, reverse: r.reversing };
}
