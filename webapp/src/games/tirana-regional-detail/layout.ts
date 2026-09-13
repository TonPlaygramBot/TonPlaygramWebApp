import { facadeEdges } from '../tirana-city-source/sourceCore.mjs';
import { containsPoint } from '../tirana-landmarks/nativeLocations.mjs';
import { buildingGround } from '../tirana-east/terrainCore.mjs';
import { housingProfile } from '../tirana-east/housingCore.mjs';
export type Detail = { model: string; x: number; y: number; z: number; yaw: number; sx: number; sy: number };
// Source-frame focus areas. Radii select visual detail, never move mapped geometry.
export const REGIONS = [
  { id: 'farke', x: 4900, z: 2100, radius: 1800 },
  { id: 'surrel', x: 7331.41, z: -528.61, radius: 1800 },
  { id: 'studenti', x: 1313.55, z: 895.19, radius: 650 },
  { id: 'njesia-2', x: 959.78, z: 181.98, radius: 260 },
  { id: 'depo-ujit', x: 2440, z: 590, radius: 850 },
  { id: 'grand-budi', x: 1300, z: 450, radius: 580 }
];
export function regionAt(x: number, z: number) {
  return REGIONS.map(r => ({ r, d: Math.hypot(x-r.x,z-r.z)/r.radius })).filter(v => v.d < 1).sort((a,b) => a.d-b.d)[0]?.r.id;
}
/** Finite facade operations. Roof items require a genuinely interior flat roof point. */
export function buildingDetails(b: any): Detail[] {
  const result: Detail[] = [], base = buildingGround(b);
  const edges = facadeEdges(b.p).filter((e: any) => e.length > 3).sort((a: any,b: any) => b.length-a.length).slice(0,4);
  const add = (model:string,x:number,y:number,z:number,yaw=0,sx=1,sy=1) => result.push({model,x,y:y+base,z,yaw,sx,sy});
  const dressed = !!housingProfile(b);
  for (const [index,e] of edges.entries()) {
    const place = (model:string,u:number,y:number,offset=.06,sx=1,sy=1) => add(model,e.a[0]+e.ux*u+e.nx*offset,y,e.a[1]+e.uz*u+e.nz*offset,e.yaw,sx,sy);
    place('plinth',e.length/2,0,.1,e.length);
    place('gutter',e.length/2,b.h-.08,.17,e.length);
    place('downpipe',.22,0,.15,1,b.h);
    const floors = Math.max(1,Math.min(8,Math.round(b.levels||b.h/3.2))), step=b.h/floors;
    const bays = Math.min(6,Math.floor(e.length/3.6));
    for(let floor=0;floor<floors;floor++)for(let col=0;col<bays;col++){
      const u=(col+.5)*e.length/bays,y=step*floor+Math.min(1.65,step*.52);
      if(y+.95>b.h)continue;
      if(!dressed)place('window',u,y);
      if(floor>0&&col%3===1&&!dressed)place('balcony',u,y-.93,.1);
      if(floor>0&&col%3===0)place('ac',u+.95,y-.45,.08);
    }
    if(index===0&&!dressed&&b.h<14)place('porch',e.length/2,0);
  }
  const x=b.p.reduce((s:number,p:number[])=>s+p[0]/b.p.length,0),z=b.p.reduce((s:number,p:number[])=>s+p[1]/b.p.length,0);
  if(b.roofShape==='flat' && !b.holes?.length && containsPoint(x,z,b.p))add('tank',x,b.h+.04,z);
  return result;
}
