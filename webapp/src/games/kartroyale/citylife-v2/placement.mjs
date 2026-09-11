/** Race decoration only. Coordinates and physics remain in the existing WORLD frame. */
export const LIMITS=Object.freeze({normal:3,battery:1,enter:45,leave:70,parallel:1});
export const GROUPS=Object.freeze([
 ['albanian_ambulance','paramedic_red','paramedic_navy'],
 ['albanian_fire_engine','firefighter_rescue','firefighter_operator'],
 ['civilian_student'],['civilian_worker'],['civilian_courier'],['civilian_business'],['civilian_local']
].map(Object.freeze));
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const point=p=>Array.isArray(p)?{x:p[0],z:p[1]}:p;
export function segmentDistance(p,a,b){
 a=point(a);b=point(b);const dx=b.x-a.x,dz=b.z-a.z,d=dx*dx+dz*dz;
 const t=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/d)):0;
 return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);
}
export function inPolygon(p,poly){
 if(!Array.isArray(poly)||poly.length<3)return false;
 let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=point(poly[i]),b=point(poly[j]);
  if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)yes=!yes;
 }return yes;
}
const edgeDistance=(p,poly)=>Math.min(...poly.map((a,i)=>segmentDistance(p,a,poly[(i+1)%poly.length])));
export function safeSite(p,radius,track,world){
 if(!finite(p)||!Number.isFinite(radius)||radius<=0||!Number.isFinite(track.width)||track.width<=0||!Array.isArray(track.points)||track.points.length<3)return false;
 const pts=track.points;if(!pts.every(finite))return false;
 // Include the closing edge, not just the nearest sample. Never put decor in the race corridor.
 if(pts.some((a,i)=>segmentDistance(p,a,pts[(i+1)%pts.length])<track.width/2+radius+2))return false;
 for(const b of world.buildings||[]){const poly=b.p;if(!Array.isArray(poly)||poly.length<3)continue;if(inPolygon(p,poly)||edgeDistance(p,poly)<radius+.4)return false;}
 for(const water of world.water||[]){
  if(Array.isArray(water)){if(inPolygon(p,water)||edgeDistance(p,water)<radius+1)return false;}
  else if(water?.line?.some((a,i)=>i>0&&segmentDistance(p,water.line[i-1],a)<Number(water.width||6)/2+radius+1))return false;
 }
 for(const r of world.roads||[]){if(r.walk)continue;if(segmentDistance(p,r.a,r.b)<Number(r.w||8)/2+radius+.5)return false;}
 // Require actual mapped pedestrian paving; absence of a safe site means skip, not move the city.
 return (world.areas||[]).some(poly=>inPolygon(p,poly)&&edgeDistance(p,poly)>radius+.4)||
  (radius<1&&(world.roads||[]).some(r=>r.walk&&!['private','no'].includes(r.access)&&segmentDistance(p,r.a,r.b)<Math.max(0,Number(r.w||2)/2-radius)));
}
export function makeSites(track,world){
 if(!track?.points?.length)return [];const pts=track.points,sites=[];
 for(let g=0;g<GROUPS.length;g++){
  const ids=GROUPS[g];
  for(let attempt=0;attempt<24;attempt++){
   const i=(Math.floor(g*pts.length/GROUPS.length)+Math.floor(attempt/2)*Math.max(1,Math.floor(pts.length/31)))%pts.length;
   const a=pts[i],b=pts[(i+1)%pts.length];if(!finite(a)||!finite(b))continue;
   const d=Math.hypot(b.x-a.x,b.z-a.z);if(d<.01)continue;
   const tx=(b.x-a.x)/d,tz=(b.z-a.z)/d,side=attempt%2?1:-1,nx=-tz*side,nz=tx*side;
   const offset=track.width/2+(ids.length>1?12:5),x=a.x+nx*offset,z=a.z+nz*offset;
   const candidates=ids.map((asset,k)=>({asset,x:x+(k?nx*6+tx*(k===1?1:-1):0),z:z+(k?nz*6+tz*(k===1?1:-1):0),radius:k===0&&ids.length>1?5.3:.65,yaw:k===0&&ids.length>1?Math.atan2(-tz,tx):Math.atan2(-nx,-nz)}));
   if(candidates.every(p=>safeSite(p,p.radius,track,world)&&sites.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>p.radius+q.radius+1))){sites.push(...candidates);break;}
  }
 }
 return sites;
}
export function selectSites(sites,eye,battery=false){
 if(!finite(eye))return [];
 return sites.filter(p=>Math.hypot(p.x-eye.x,p.z-eye.z)<LIMITS.enter).sort((a,b)=>Math.hypot(a.x-eye.x,a.z-eye.z)-Math.hypot(b.x-eye.x,b.z-eye.z)).slice(0,battery?LIMITS.battery:LIMITS.normal);
}
