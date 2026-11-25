/** Screen-coordinate joystick: right is right; upward displacement is forward. */
export function screenStick(dx, dy, radius=44, deadzone=0) {
  if (![dx,dy,radius].every(Number.isFinite) || radius <= 0) return {x:0,y:0};
  const length=Math.hypot(dx,dy),zone=Number.isFinite(deadzone)?Math.max(0,Math.min(.3,deadzone)):0;
  const amount=Math.min(1,length/radius);
  if(amount<=zone)return {x:0,y:0};
  const scaled=(amount-zone)/(1-zone);
  return {x:dx/length*scaled,y:-dy/length*scaled};
}
