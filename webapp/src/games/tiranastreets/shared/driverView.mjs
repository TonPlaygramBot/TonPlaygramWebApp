import {collectionVehicleFor} from './vehicleCollection.mjs';

/** Canonical car space: +X screen-right, +Y up, -Z forward. Seats are metres.
 * Original collection GLBs use +X forward; convert their authored seat socket.
 */
export function driverSocket(car) {
  const asset=collectionVehicleFor({collectionVehicle:car.collectionVehicle||car.racingAsset});
  if(asset) {
    const [forward,height,left]=asset.driverSeat;
    return {x:left,y:Math.min(height+.58,asset.height-.12)+.03,z:-forward,
      width:asset.width,length:asset.length,open:false};
  }
  const bike=/bike|motorcycle/.test(car.forceVehicle||car.model||'')||['apex','oobi','oodi','ooli','oopi','buggy'].includes(car.racingAsset);
  const truck=/van|suv|truck|armored|military|brabus-g|defender|shota/.test(car.forceVehicle||car.racingAsset||car.model||'')||car.service==='ambulance';
  return {x:bike?0:truck?-.48:-.38,y:bike?1.48:truck?1.8:1.19,z:truck?-.35:.08,
    width:truck?2.2:1.85,length:truck?5.2:4.4,open:bike};
}
export function driverEye(car) {
  const seat=driverSocket(car),c=Math.cos(car.heading),s=Math.sin(car.heading);
  return {x:car.x+seat.x*c+seat.z*s,y:seat.y,z:car.z-seat.x*s+seat.z*c};
}
/** Keep portrait field of view stable; speed does not turn the windshield into
 * a zoom effect. The small acceleration response never moves the eye out of cab.
 */
export function driverFov(aspect) {return aspect<.8?78:68;}
