import {roadsidePoint,clearRoadSegment} from './streetSafety.mjs';
import {forceWeaponFor} from './uploadedWeapons.mjs';
/** Fixed patrol routes, not officers teleported around the camera. */
export function createFootPatrols(world,spawn,count=32) {
  const routes=[];
  const roads=world.roads.filter(r=>!r.walk&&!r.bridge&&!r.tunnel&&Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1])>24)
    .sort((a,b)=>Math.hypot(a.a[0]-spawn.x,a.a[1]-spawn.z)-Math.hypot(b.a[0]-spawn.x,b.a[1]-spawn.z));
  for(const r of roads){
    const middle={x:(r.a[0]+r.b[0])/2,z:(r.a[1]+r.b[1])/2};
    if(routes.some(path=>Math.hypot(path[0].x-middle.x,path[0].z-middle.z)<90))continue;
    const a=roadsidePoint({x:r.a[0]*.8+r.b[0]*.2,z:r.a[1]*.8+r.b[1]*.2},.45,true);
    const b=roadsidePoint({x:r.a[0]*.2+r.b[0]*.8,z:r.a[1]*.2+r.b[1]*.8},.45,true);
    if(!a||!b||!clearRoadSegment([a.x,a.z],[b.x,b.z],.45))continue;
    routes.push([a,b]);if(routes.length>=Math.ceil(count/2))break;
  }
  return routes.flatMap((path,i)=>[0,1].map(seat=>({
    id:`foot-patrol-${i}-${seat}`,kind:'police',role:'street-patrol',forceCharacter:i%4===1?'traffic_officer':'patrol_officer',
    squadId:`foot-patrol-${i}`,motion:'walk',x:path[seat].x,z:path[seat].z,heading:0,speed:0,
    health:100,weapon:forceWeaponFor('patrol_officer',seat),path,pathIndex:1-seat,nextShot:0,downUntil:0,
    patrol:true,anim:'walk'
  }))).slice(0,count);
}
