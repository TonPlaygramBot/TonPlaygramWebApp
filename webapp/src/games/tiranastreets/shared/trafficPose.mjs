import {drivingScale} from './drivingScale.mjs';
const turn=value=>Math.atan2(Math.sin(value),Math.cos(value));
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));

/** Turn the visible body only when the lane follower actually travels. The
 * steering output is shared by original GLB wheels and the seated driver's
 * hands; a stopped queue must not spin its cars toward the next waypoint. */
export function updateTrafficPose(car,desired,distance,dt){
  if(!(dt>0)||!Number.isFinite(dt)||!Number.isFinite(desired))return;
  const tune=drivingScale(car),moving=Number.isFinite(distance)&&distance>0;
  const before=car.heading;
  const blend=1-Math.exp(-dt*(tune.kind==='bus'?3:6));
  const rotation=moving?turn(desired-before)*blend*Math.min(1,distance/.12):0;
  car.heading=turn(before+rotation);
  car.yawRate=rotation/dt;
  const target=moving?clamp(Math.atan(-rotation*tune.wheelbase/Math.max(distance,.01)),-tune.steer,tune.steer):0;
  car.steerAngle=(car.steerAngle||0)+(target-(car.steerAngle||0))*(1-Math.exp(-10*dt));
  car.steering=clamp(car.steerAngle/tune.steer,-1,1);
}
