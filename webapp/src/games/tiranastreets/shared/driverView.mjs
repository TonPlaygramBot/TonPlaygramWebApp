import {groundHeight} from '../../tirana-east/terrainCore.mjs';
import {collectionVehicleFor} from './vehicleCollection.mjs';
import {FORCE_VEHICLE_BOUNDS,forceVehicleFor} from './albanianForces.mjs';

/** Canonical car space: +X screen-right, +Y up, -Z forward. Seats are metres.
 * Original collection GLBs use +X forward; convert their authored seat socket.
 */
export function driverSocket(car) {
  if(car.model==='tirana-bus')return {x:-.64,y:2.05,z:-7.7,width:2.55,length:18,open:false};
  const asset=collectionVehicleFor({collectionVehicle:car.collectionVehicle||car.racingAsset});
  if(asset) {
    const [forward,height,left]=asset.driverSeat;
    return {x:left,y:Math.min(height+.58,asset.height-.12)+.03,z:-forward,
      width:asset.width,length:asset.length,open:false};
  }
  const force=forceVehicleFor(car),bounds=FORCE_VEHICLE_BOUNDS.find(b=>b.id===force?.id);
  if(bounds){
    const bike=force.id.includes('bike'),van=force.id.includes('van');
    return {x:bike?0:-bounds.w*.22,y:bike?1.48:van?Math.min(2.12,bounds.h-.4):1.22,
      z:bike?0:van?-bounds.d*.23:.04,width:bounds.w,length:bounds.d,open:bike};
  }
  const bike=/bike|motorcycle/.test(car.forceVehicle||car.model||'')||['apex','oobi','oodi','ooli','oopi','buggy'].includes(car.racingAsset);
  const truck=/van|suv|truck|armored|military|brabus-g|defender|shota/.test(car.forceVehicle||car.racingAsset||car.model||'')||car.service==='ambulance';
  return {x:bike?0:truck?-.48:-.38,y:bike?1.48:truck?1.8:1.19,z:truck?-.35:.08,
    width:truck?2.2:1.85,length:truck?5.2:4.4,open:bike};
}
export function driverEye(car, sample=groundHeight) {
  const seat=driverSocket(car),c=Math.cos(car.heading),s=Math.sin(car.heading);
  const offset=onSupport({x:seat.x*c+seat.z*s,y:seat.y,z:-seat.x*s+seat.z*c},car,sample);
  return {x:car.x+offset.x,y:offset.y+sample(car.x,car.z),z:car.z+offset.z};
}
/** Same sampled support plane as the exterior. The eye and dashboard must tilt
 * together on hills; otherwise even a correct seat socket leaves the cabin. */
function onSupport(v,car,sample){
  if(sample(car.x,car.z)<=0)return v;
  const nx=(sample(car.x-2,car.z)-sample(car.x+2,car.z))/4;
  const nz=(sample(car.x,car.z-2)-sample(car.x,car.z+2))/4;
  const length=Math.hypot(nx,1,nz),x=nx/length,y=1/length,z=nz/length;
  const cross={x:x*v.y,y:-x*v.x-z*v.z,z:z*v.y};
  return {x:v.x+cross.x+x*cross.y/(1+y),y:v.y+cross.y+(-x*cross.x-z*cross.z)/(1+y),z:v.z+cross.z+z*cross.y/(1+y)};
}
export function driverDirection(car,yaw=car.heading,pitch=0,sample=groundHeight){
  return onSupport({x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)},car,sample);
}
export function driverUp(car,sample=groundHeight){return onSupport({x:0,y:1,z:0},car,sample);}
/** Keep portrait field of view stable; speed does not turn the windshield into
 * a zoom effect. The small acceleration response never moves the eye out of cab.
 */
export function driverFov(aspect) {return aspect<.8?78:68;}
