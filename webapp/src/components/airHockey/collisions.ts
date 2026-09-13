type Point = { x: number; z: number };
type Rink = { w: number; h: number; goalW: number };

/** Only the two end openings score. Every corner is a solid rail. */
export function resolveAirHockeyRails(position: Point, velocity: Point, field: Rink, radius: number) {
  const side = field.w / 2 - radius;
  const end = field.h / 2 - radius;
  let bounced = false;
  if (Math.abs(position.x) > side) {
    const direction = Math.sign(position.x);
    position.x = direction * side;
    velocity.x = -direction * Math.abs(velocity.x);
    bounced = true;
  }
  if (Math.abs(position.z) > end) {
    if (Math.abs(position.x) <= field.goalW / 2 - radius) {
      return position.z < 0 ? 'north-goal' : 'south-goal';
    }
    const direction = Math.sign(position.z);
    position.z = direction * end;
    velocity.z = -direction * Math.abs(velocity.z);
    bounced = true;
  }
  return bounced ? 'rail' : null;
}
