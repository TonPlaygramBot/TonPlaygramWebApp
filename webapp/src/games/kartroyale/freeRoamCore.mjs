import { footprintRadius, resolveObstacleContact } from './collisions.mjs';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const inside=(x,z,p)=>{let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
function closest(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return {x:a[0]+dx*t,z:a[1]+dz*t,yaw:Math.atan2(dx,dz)};}

/** Shared, deterministic static collision world. Asset positions come from the
 * same registries as rendering; no GPU readbacks or scene traversal per step. */
export function createDrivingWorld(world) {
  const size=64,roads=new Map(),solids=new Map(),bridges=new Map();
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
  for(const road of world.roads)if(!road.tunnel&&road.highway!=='steps'&&road.w>=2.4){
    index(roads,road,[road.a,road.b],road.w/2);
    if(road.bridge)index(bridges,road,[road.a,road.b],road.w/2+1.25);
  }
  for(const b of world.buildings)if(!(b.minHeight>1.5))index(solids,{outer:b.p,holes:b.holes||[],material:'concrete',height:b.h||20},b.p);
  for(const water of world.waterAreas||[])for(const p of water.polygons)index(solids,{...p,material:'water'},p.outer);
  for(const p of world.waterPolygons||[])index(solids,{...p,material:'water'},p.outer);
  for(const t of world.trees||[]){
    const radius=t.radius??.3;
    index(solids,{x:t.x,z:t.z,radius,material:'tree',height:t.height||t.h||8},[[t.x,t.z]],radius);
  }
  for(const o of world.obstacles||[])index(solids,o,o.outer||(o.a?[o.a,o.b]:[[o.x,o.z]]),o.radius||0);
  const near=(x,z,radius=96,predicate=()=>true)=>{
    let best=null;
    for(const road of query(roads,x,z,radius)){
      const p=closest(x,z,road.a,road.b),distance=Math.hypot(x-p.x,z-p.z);
      if((!best||distance<best.distance)&&predicate(p,road))best={...p,distance,width:road.w,name:road.name||''};
    }return best;
  };
  const onBridge=(r,x=r.x,z=r.z)=>query(bridges,x,z,4).some(road=>{
    const p=closest(x,z,road.a,road.b),dx=road.b[0]-road.a[0],dz=road.b[1]-road.a[1],length=Math.hypot(dx,dz);
    const along=((x-road.a[0])*dx+(z-road.a[1])*dz)/length;
    return along>=-.1&&along<=length+.1&&Math.hypot(x-p.x,z-p.z)+footprintRadius(r,dz/length,-dx/length)<=road.w/2+1.2;
  });
  const contact=(r,o,dt)=>{
    if(o.material==='water'&&(onBridge(r)||(r.airborne&&r.jumpHeight>.35)))return;
    if(o.material!=='water'&&(r.jumpHeight||0)>(o.height??Infinity))return;
    let point,distance,within=false;
    if(o.outer){
      // Dry islands/courtyards are free space, but their edges still collide.
      within=inside(r.x,r.z,o.outer)&&!(o.holes||[]).some(h=>inside(r.x,r.z,h));
      distance=Infinity;
      for(const ring of [o.outer,...(o.holes||[])])for(let i=0;i<ring.length;i++){
        const p=closest(r.x,r.z,ring[i],ring[(i+1)%ring.length]),d=Math.hypot(r.x-p.x,r.z-p.z);
        if(d<distance){distance=d;point=p;}
      }
    }else{
      point=o.a?closest(r.x,r.z,o.a,o.b):{x:o.x,z:o.z,yaw:0};
      distance=Math.hypot(r.x-point.x,r.z-point.z);
    }
    if(!point)return;
    let nx=(r.x-point.x)/Math.max(distance,.0001),nz=(r.z-point.z)/Math.max(distance,.0001);
    if(within){nx=-nx;nz=-nz;}
    if(distance<.0001){nx=-Math.sin(r.velocityYaw);nz=-Math.cos(r.velocityYaw);}
    const radius=footprintRadius(r,nx,nz)+(o.radius||0);
    if(!within&&distance>=radius)return;
    resolveObstacleContact(r,nx,nz,within?radius+distance:radius-distance,dt,o.material||'concrete');
  };
  const clear=(r,p)=>{
    const probe={...r,x:p.x,z:p.z,yaw:p.yaw,velocityYaw:p.yaw,speed:0,waterRecovery:0,airborne:false,jumpHeight:0,wallContact:false};
    for(const o of query(solids,p.x,p.z,Math.max(4,r.bodyLength||0)))contact(probe,o,0);
    return !probe.wallContact;
  };
  return {
    mode:'free-roam',bounds:world.bounds,nearestRoad:near,
    nearbyRoads(x,z,radius=240){return query(roads,x,z,radius).filter(r=>{const p=closest(x,z,r.a,r.b);return Math.hypot(x-p.x,z-p.z)<radius;});},
    recover(r){
      const saved=r.roamRecovery,p=saved&&clear(r,saved)?saved:near(r.x,r.z,512,q=>clear(r,q));
      if(p){r.x=p.x;r.z=p.z;r.yaw=r.velocityYaw=p.yaw;r.roamRecovery={x:p.x,z:p.z,yaw:p.yaw};}
      r.speed=0;r.waterRecovery=0;r.wallContact=false;
    },
    move(r,oldX,oldZ,dt){
      const dx=r.x-oldX,dz=r.z-oldZ,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3)),step=dt/steps;
      let mx=dx/steps,mz=dz/steps;
      r.x=oldX;r.z=oldZ;r.wallContact=false;
      for(let i=0;i<steps;i++){
        r.x+=mx;r.z+=mz;
        for(let pass=0;pass<3;pass++)for(const o of query(solids,r.x,r.z,Math.max(4,r.bodyLength||0)))contact(r,o,step);
        const [x0,z0,x1,z1]=world.bounds;
        const x=clamp(r.x,x0+2,x1-2),z=clamp(r.z,z0+2,z1-2);
        if(x!==r.x||z!==r.z){r.x=x;r.z=z;r.speed=0;r.wallContact=true;}
        if(r.waterRecovery>0)break;
        // Finish the sweep using the post-impact velocity.
        if(r.wallContact){mx=Math.sin(r.velocityYaw)*r.speed*step;mz=Math.cos(r.velocityYaw)*r.speed*step;}
      }
      const p=near(r.x,r.z);
      if(p&&p.distance<Math.max(.1,p.width/2-1.3)&&!r.wallContact&&clear(r,p))r.roamRecovery={x:p.x,z:p.z,yaw:p.yaw};
      return p;
    }
  };
}
