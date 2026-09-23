import {drivingScale} from './drivingScale.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
const approach=(v,to,rate,dt)=>v+(to-v)*(1-Math.exp(-rate*dt));
/** Fixed-size integration keeps braking, direction changes and collision checks
 * stable on a missed mobile frame. `contact` resolves actual world/car contacts
 * after every <= 1/120 s movement; the solver never teleports past thin walls. */
export function driveVehicle(car,input,delta,contact=()=>{}){
 const dt=clamp(finite(delta),0,.1);if(!dt)return;
 const tune=drivingScale(car),steps=Math.ceil(dt*120),step=dt/steps;
 const steer=clamp(finite(input.x),-1,1),pedal=clamp(finite(input.y),-1,1);
 if(!Number.isFinite(car.vx)||!Number.isFinite(car.vz)||(!car.vx&&!car.vz&&Math.abs(car.speed||0)>.01)){
  car.vx=-Math.sin(car.heading)*finite(car.speed);car.vz=-Math.cos(car.heading)*finite(car.speed);
 }
 car.steering=finite(car.steering);car.yawRate=finite(car.yawRate);
 const before=finite(car.speed);
 for(let i=0;i<steps;i++){
  if(car.destroyed||car.burning){car.speed=car.vx=car.vz=car.yawRate=0;break;}
  const fx=-Math.sin(car.heading),fz=-Math.cos(car.heading),rx=Math.cos(car.heading),rz=-Math.sin(car.heading);
  let forward=car.vx*fx+car.vz*fz,lateral=car.vx*rx+car.vz*rz;
  const speed=Math.abs(forward),opposite=pedal*forward<-.03;
  // Holding gas + brake while turning asks for a controlled handbrake slide.
  // Brake alone is always a straight service brake, including stale input.
  const handbrake=input.brake===true&&pedal>.15&&Math.abs(steer)>.2&&forward>6;
  const braking=input.brake===true||opposite;
  const throttle=braking?0:Math.abs(pedal);
  const torque=1-.55*Math.min(1,speed/tune.maximum)**1.5;
  const drag=.12+speed*speed*.00075;
  const deceleration=(braking?(handbrake?5:tune.braking):throttle?drag:1.05+drag)*step;
  if(braking||!throttle)forward=Math.sign(forward)*Math.max(0,speed-deceleration);
  else forward=clamp(forward+pedal*tune.acceleration*torque*step-Math.sign(forward)*drag*step,-tune.reverse,tune.maximum);
  // Reversing requires the vehicle to reach rest first; the opposite pedal
  // cannot turn an emergency stop into reverse during the same substep.
  if(speed<.015&&!braking)forward=pedal*tune.acceleration*step;
  car.steering=approach(car.steering,steer,Math.abs(steer)<.02?10:7,step);
  const sensitivity=1/(1+(speed/14)**1.45);
  car.steerAngle=car.steering*tune.steer*sensitivity;
  const requested=-Math.tan(car.steerAngle)*forward/tune.wheelbase;
  const turnLimit=Math.min(1.35,(tune.grip*(handbrake?1.15:1))/Math.max(speed,2));
  car.yawRate=approach(car.yawRate,clamp(requested,-turnLimit,turnLimit),handbrake?5:8,step);
  car.heading=Math.atan2(Math.sin(car.heading+car.yawRate*step),Math.cos(car.heading+car.yawRate*step));
  // Rotate the existing momentum into the new vehicle frame, then recover
  // lateral grip progressively instead of snapping velocity to the nose.
  const turn=car.yawRate*step;
  lateral=(lateral*Math.cos(turn)+forward*Math.sin(turn))*Math.exp(-(handbrake?1.65:tune.grip*.86)*step);
  if(input.brake&&speed<.15)lateral*=Math.exp(-18*step);
  const nextFx=-Math.sin(car.heading),nextFz=-Math.cos(car.heading);
  car.vx=nextFx*forward+Math.cos(car.heading)*lateral;
  car.vz=nextFz*forward-Math.sin(car.heading)*lateral;
  car.speed=forward;car.slip=Math.atan2(lateral,Math.max(2,Math.abs(forward)));
  car.handbraking=handbrake;car.braking=braking;
  car.x+=car.vx*step;car.z+=car.vz*step;
  contact(car);
  if(tune.kind==='bus')car.trailerHeading=(car.trailerHeading??car.heading)+Math.atan2(Math.sin(car.heading-(car.trailerHeading??car.heading)),Math.cos(car.heading-(car.trailerHeading??car.heading)))*(1-Math.exp(-step*Math.max(.35,Math.abs(car.speed)/7)));
 }
 car.acceleration=(car.speed-before)/dt;
 const fraction=Math.abs(car.speed)/tune.maximum;
 car.gear=car.speed<-.05?-1:Math.abs(car.speed)<.12?0:clamp(1+Math.floor(fraction*6),1,6);
 car.rpm=car.gear<=0?900:Math.round(1400+clamp(fraction*6-(car.gear-1),0,1)*4900);
}
