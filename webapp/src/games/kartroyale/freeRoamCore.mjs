import { resolveObstacleContact } from './collisions.mjs';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const inside=(x,z,p)=>{let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
function closest(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return {x:a[0]+dx*t,z:a[1]+dz*t,yaw:Math.atan2(dx,dz)};}

/** Free driving owns an indexed city collision world. A race never receives
 * this context, so input packets cannot disable gates or track boundaries. */
export function createDrivingWorld(world) {
  const size=64,roads=new Map(),solids=new Map();
  const index=(grid,item,points,pad=0)=>{
    const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
    for(let x=Math.floor((Math.min(...xs)-pad)/size);x<=Math.floor((Math.max(...xs)+pad)/size);x++)
      for(let z=Math.floor((Math.min(...zs)-pad)/size);z<=Math.floor((Math.max(...zs)+pad)/size);z++){
        const key=x+':'+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(item);
      }
  };
  const query=(grid,x,z,radius)=>{
    const found=new Set();for(let a=Math.floor((x-radius)/size);a<=Math.floor((x+radius)/size);a++)for(let b=Math.floor((z-radius)/size);b<=Math.floor((z+radius)/size);b++)for(const item of grid.get(a+':'+b)||[])found.add(item);return [...found];
  };
  for(const r of world.roads)if(!r.tunnel&&!r.bridge&&!r.layer&&r.highway!=='steps'&&r.w>=2.4)index(roads,r,[r.a,r.b]);
  for(const b of world.buildings)index(solids,{outer:b.p,holes:[]},b.p,2);
  for(const water of world.waterAreas||[])for(const p of water.polygons)index(solids,p,p.outer,2);
  const near=(x,z,radius=96)=>{
    let best=null;
    for(const road of query(roads,x,z,radius)){
      const p=closest(x,z,road.a,road.b),distance=Math.hypot(x-p.x,z-p.z);
      if(!best||distance<best.distance)best={...p,distance,width:road.w,name:road.name||''};
    }return best;
  };
  const contact=(r,p,dt)=>{
    const ring=p.outer;
    // Holes are dry islands, not solid water.
    if(p.holes?.some(h=>inside(r.x,r.z,h)))return;
    const within=inside(r.x,r.z,ring);let point=null,distance=Infinity;
    for(let i=0;i<ring.length;i++){const n=closest(r.x,r.z,ring[i],ring[(i+1)%ring.length]),d=Math.hypot(r.x-n.x,r.z-n.z);if(d<distance){distance=d;point=n;}}
    const radius=Math.max(1.08,(r.bodyWidth||1.72)*.65);
    if(!within&&distance>=radius)return;
    let nx=(r.x-point.x)/Math.max(distance,.0001),nz=(r.z-point.z)/Math.max(distance,.0001);
    if(within){nx=-nx;nz=-nz;}
    if(distance<.0001){nx=Math.cos(point.yaw);nz=-Math.sin(point.yaw);}
    resolveObstacleContact(r,nx,nz,within?radius+distance:radius-distance,dt);
  };
  return {
    mode:'free-roam',bounds:world.bounds,
    nearestRoad:near,
    nearbyRoads(x,z,radius=240){return query(roads,x,z,radius).filter(r=>Math.min(Math.hypot(r.a[0]-x,r.a[1]-z),Math.hypot(r.b[0]-x,r.b[1]-z))<radius+80);},
    recover(r){const p=r.roamRecovery||near(r.x,r.z,256);if(p){r.x=p.x;r.z=p.z;r.yaw=r.velocityYaw=p.yaw;}},
    move(r,oldX,oldZ,dt){
      const dx=r.x-oldX,dz=r.z-oldZ,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.45));
      r.x=oldX;r.z=oldZ;r.wallContact=false;
      for(let i=0;i<steps;i++){
        r.x+=dx/steps;r.z+=dz/steps;
        for(let pass=0;pass<2;pass++)for(const p of query(solids,r.x,r.z,2))contact(r,p,dt/steps);
        const [x0,z0,x1,z1]=world.bounds;
        const x=clamp(r.x,x0+2,x1-2),z=clamp(r.z,z0+2,z1-2);
        if(x!==r.x||z!==r.z){r.x=x;r.z=z;r.speed=0;}
      }
      const p=near(r.x,r.z);
      if(p&&p.distance<Math.max(1,p.width/2-1.3)&&!r.wallContact)r.roamRecovery={x:p.x,z:p.z,yaw:p.yaw};
      return p;
    }
  };
}
