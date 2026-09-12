import {facadeEdges} from '../tirana-city-source/sourceCore.mjs';
import {hash} from './placementCore.mjs';
/** Match the streamed shell's window rhythm; never add floors or replace a
 * photo-specific landmark. Bay detail is architectural interpretation. */
export function facadeModules(b,{allowEstimatedHeight=false}={}){
 if(!b.p?.length||!Number.isFinite(b.h)||b.h<3||b.heightSource==='unknown'&&!b.levels&&!allowEstimatedHeight||b.tags?.building==='construction'||b.tags?.construction)return [];
 const modules=[],seed=hash(b.id),residential=['apartments','residential'].includes(b.tags?.building);
 const edges=facadeEdges(b.p);if(!edges.length)return [];
 const front=edges.reduce((a,b)=>a.length>b.length?a:b);
 for(const [i,e] of edges.entries()){
  const columns=Math.min(24,Math.floor(e.length/4));if(!columns)continue;
  for(let y=Math.max((b.minHeight||0)+1.7,4.7),floor=0;y<b.h-1;y+=3.2,floor++)for(let j=0;j<columns;j++){
   const u=(j+.5)*e.length/columns,x=e.a[0]+e.ux*u,z=e.a[1]+e.uz*u;
   const base={x,z,y,yaw:Math.atan2(e.nx,e.nz),buildingId:b.id};
   modules.push({...base,model:'window_bay'});
   if(residential&&e.length>11&&j%3===1&&(seed+i)%3!==0)modules.push({...base,model:'balcony_bay'});
   else if(residential&&(j+floor+seed)%5===0)modules.push({...base,x:x+e.ux*1.22,z:z+e.uz*1.22,y:y-.25,model:'air_conditioner'});
  }
  if((b.minHeight||0)<.2&&e===front&&e.length>5)modules.push({x:e.a[0]+e.ux*e.length/2,z:e.a[1]+e.uz*e.length/2,y:1.25,yaw:Math.atan2(e.nx,e.nz),buildingId:b.id,model:'entrance_bay'});
 }
 return modules;
}
