import {nearbyObstacles, rayBox} from './physics.mjs';
import {battleGround} from './terrain.mjs';
import {ORIGIN} from './layout.mjs';
import {terrainRay} from '../../tirana-east/terrainCore.mjs';

/** Surface normal on the exact collision hull, including courtyard walls.
 * Normals face the incoming ray; an interior/invalid contact has no decal. */
export function obstacleHitNormal(point, direction, obstacle) {
  const y=point.y-battleGround(obstacle.x,obstacle.z);
  let gap=Math.abs(y-obstacle.h),normal={x:0,y:1,z:0};
  const bottom=Math.abs(y-(obstacle.footprint?0:obstacle.minY||0));
  if(bottom<gap){gap=bottom;normal={x:0,y:-1,z:0};}
  if(obstacle.footprint){
    for(const ring of [obstacle.footprint,...(obstacle.holes||[])])for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],length2=dx*dx+dz*dz;
      if(length2<1e-10)continue;
      const t=Math.max(0,Math.min(1,((point.x-a[0])*dx+(point.z-a[1])*dz)/length2));
      const distance=Math.hypot(point.x-a[0]-dx*t,point.z-a[1]-dz*t);
      if(distance<gap){gap=distance;const length=Math.sqrt(length2);normal={x:dz/length,y:0,z:-dx/length};}
    }
  }else{
    const c=Math.cos(obstacle.rot||0),s=Math.sin(obstacle.rot||0),dx=point.x-obstacle.x,dz=point.z-obstacle.z;
    const x=c*dx-s*dz,z=s*dx+c*dz;
    if(Math.abs(Math.abs(x)-obstacle.w/2)<gap){gap=Math.abs(Math.abs(x)-obstacle.w/2);normal={x:Math.sign(x)*c,y:0,z:-Math.sign(x)*s};}
    if(Math.abs(Math.abs(z)-obstacle.d/2)<gap){gap=Math.abs(Math.abs(z)-obstacle.d/2);normal={x:Math.sign(z)*s,y:0,z:Math.sign(z)*c};}
  }
  if(gap>.035)return null;
  if(normal.x*direction.x+normal.y*direction.y+normal.z*direction.z>0)normal={x:-normal.x,y:-normal.y,z:-normal.z};
  return normal;
}

/** Reuses the physics broad phase; a shot never scans every building in Tirana. */
export function traceBattleSurface(origin,direction,range,obstacles) {
  let distance=range,obstacle=null,kind='air',normal=null;
  const endX=origin.x+direction.x*range,endZ=origin.z+direction.z*range;
  for(const candidate of nearbyObstacles((origin.x+endX)/2,(origin.z+endZ)/2,Math.hypot(endX-origin.x,endZ-origin.z)/2+.1,obstacles)){
    const hit=rayBox(origin,direction,candidate);
    if(hit<distance){distance=hit;obstacle=candidate;kind='wall';}
  }
  const ground=terrainRay({...origin,x:origin.x+ORIGIN.x,z:origin.z+ORIGIN.z},direction,distance);
  if(ground!==null&&ground<distance){distance=ground;obstacle=null;kind='ground';}
  const point={x:origin.x+direction.x*distance,y:origin.y+direction.y*distance,z:origin.z+direction.z*distance};
  if(obstacle)normal=obstacleHitNormal(point,direction,obstacle);
  if(kind==='ground'){
    const x=battleGround(point.x-.2,point.z)-battleGround(point.x+.2,point.z),z=battleGround(point.x,point.z-.2)-battleGround(point.x,point.z+.2),length=Math.hypot(x,.4,z);
    normal={x:x/length,y:.4/length,z:z/length};
  }
  return {distance,point,kind,normal};
}
