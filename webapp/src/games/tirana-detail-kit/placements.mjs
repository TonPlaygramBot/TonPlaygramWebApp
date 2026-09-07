import {RECIPES} from './recipes.mjs';
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
export function inside(x,z,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
const clear=(x,z,poly,r=1.6)=>[-r,0,r].every(dx=>[-r,0,r].every(dz=>inside(x+dx,z+dz,poly)));
/** Original decorative detailing at mapped buildings; not a survey of appliances.
 * No new buildings, arbitrary monuments or lake geometry are invented here. */
export function createDetailPlacements(world,excluded=new Set()){
  const result=[],roof=['rooftop-ac','water-tank','solar-heater','vent-bank','roof-hatch','vent-stack'];
  for(const b of world.buildings){
    if(b.special||excluded.has(String(b.id))||!Number.isFinite(b.h)||b.h<6||b.h>65||!b.p?.length)continue;
    const seed=hash(b.id),xs=b.p.map(p=>p[0]),zs=b.p.map(p=>p[1]);
    const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;
    if(clear(x,z,b.p))result.push({id:`${b.id}:roof`,asset:roof[seed%roof.length],x,z,y:b.h+.04,yaw:0,buildingId:String(b.id)});
    // At most one detailed facade per building, chosen from its longest edge.
    let edge=-1,length=0;
    for(let i=0;i<b.p.length;i++){const a=b.p[i],c=b.p[(i+1)%b.p.length],len=Math.hypot(c[0]-a[0],c[1]-a[1]);if(len>length){edge=i;length=len;}}
    if(length<7||length>65)continue;
    const a=b.p[edge],c=b.p[(edge+1)%b.p.length],dx=(c[0]-a[0])/length,dz=(c[1]-a[1])/length,mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2;
    let nx=-dz,nz=dx;if(inside(mx+nx*.3,mz+nz*.3,b.p)){nx=-nx;nz=-nz;}
    if(inside(mx+nx*.2,mz+nz*.2,b.p))continue;
    const yaw=Math.atan2(nx,nz),facade=(asset,px,py,pz,n)=>result.push({id:`${b.id}:${n}`,asset,x:px,z:pz,y:py,yaw,buildingId:String(b.id)});
    // Above street level only: avoid covering an existing door or blocking roads.
    for(let floor=0;floor<Math.min(3,Math.floor((b.h-4)/3.3));floor++){
      facade('window-frame',mx+nx*.16,3.6+floor*3.3,mz+nz*.16,`window:${floor}`);
      if(seed%4===0)facade('balcony',mx+nx*.15,3.3+floor*3.3,mz+nz*.15,`balcony:${floor}`);
      if(seed%3===0)facade('downpipe',mx+dx*2.1+nx*.2,3.3+floor*3.3,mz+dz*2.1+nz*.2,`pipe:${floor}`);
    }
  }
  return result;
}
/** Complete clusters per building preserve windows/pipes on one facade. */
export function selectNearby(placements,target,battery=false){
  if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.z))return [];
  const radius=battery?80:170,maxBuildings=battery?12:35,groups=new Map();
  for(const p of placements){const d=Math.hypot(p.x-target.x,p.z-target.z);if(d>radius)continue;const group=groups.get(p.buildingId)||{d,items:[]};group.d=Math.min(d,group.d);group.items.push(p);groups.set(p.buildingId,group);}
  return [...groups.values()].sort((a,b)=>a.d-b.d).slice(0,maxBuildings).flatMap(g=>g.items).filter(p=>RECIPES[p.asset]);
}
