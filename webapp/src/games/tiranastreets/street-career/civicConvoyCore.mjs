/** Authored game itinerary; these are not real movements or a real timetable.
 * Regional destinations stop at the playable road boundary. */
export const CIVIC_STOPS = Object.freeze([
  {id:'parliament',label:'Parlamenti',x:353,z:175,wait:32},
  {id:'prime-minister',label:'Kryeministria',x:151,z:638,wait:42},
  {id:'surrel',label:'Drejtimi Surrel',x:3480,z:120,wait:26},
  {id:'rinas',label:'Drejtimi Rinas · kufiri i hartës',x:-4720,z:-3300,wait:34}
].map(Object.freeze));
export const CIVIC_VEHICLES = Object.freeze([
  {id:'bike-1',forceVehicle:'shqiponja_bike',offset:0},
  {id:'bike-2',forceVehicle:'shqiponja_bike',offset:6},
  {id:'lead-police',forceVehicle:'shqiponja_compact',offset:14},
  {id:'s-class',collectionVehicle:'benz',offset:24},
  {id:'suv-1',collectionVehicle:'range',offset:34},
  {id:'suv-2',collectionVehicle:'range',offset:44},
  {id:'suv-3',collectionVehicle:'range',offset:54},
  {id:'rear-police',forceVehicle:'shqiponja_compact',offset:64},
  {id:'bike-3',forceVehicle:'shqiponja_bike',offset:72},
  {id:'bike-4',forceVehicle:'shqiponja_bike',offset:78}
].map(Object.freeze));
export function itineraryStop(leg) {
  // Every third complete cycle uses the airport direction instead of Surrel.
  const cycle=Math.floor(Math.max(0,leg)/4),slot=Math.max(0,leg)%4;
  return CIVIC_STOPS[[0,1,cycle%3===2?3:2,1][slot]];
}
export function measuredPath(points) {
  const path=[];let length=0;
  for(const p of points){
    if(!p||![p.x,p.z].every(Number.isFinite))continue;
    const previous=path.at(-1),distance=previous?Math.hypot(p.x-previous.x,p.z-previous.z):0;
    if(previous&&distance<.001)continue;
    length+=distance;path.push({x:p.x,z:p.z,distance:length});
  }
  return {points:path,length};
}
export function pathPose(path,distance) {
  const points=path.points;if(!points.length)return null;
  const d=Math.max(0,Math.min(path.length,distance));
  let i=1;while(i<points.length-1&&points[i].distance<d)i++;
  const a=points[Math.max(0,i-1)],b=points[Math.min(i,points.length-1)];
  const span=b.distance-a.distance,t=span>0?(d-a.distance)/span:0;
  return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,heading:Math.atan2(-(b.x-a.x),-(b.z-a.z))};
}
export function pathTail(path,distance,length=100) {
  const start=Math.max(0,distance-length),first=pathPose(path,start),last=pathPose(path,distance);
  if(!first||!last)return [];
  return [first,...path.points.filter(p=>p.distance>start&&p.distance<distance),last];
}
