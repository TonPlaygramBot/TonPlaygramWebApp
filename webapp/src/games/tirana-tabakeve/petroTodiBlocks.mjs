import {facadeEdges} from '../tirana-city-source/sourceCore.mjs';

const anchors=Object.freeze([
 // The Petro Nini storefront podium and taller wing are separate mapped shells.
 {id:'620369881',levels:9,label:'Petro Nini / Dalip Zavalani',towards:[958,218],finish:0xc8b9a5,trim:0xe0d8c9},
 {id:'736721581',levels:10,label:'Todi Shkurti 2',towards:[1202,204],finish:0xc4c5be,trim:0xdddcd2},
 {id:'682723386',levels:11,label:'Todi Shkurti 4',towards:[1203,240],finish:0xcbc4b6,trim:0xe7decf},
 {id:'548100908',levels:9,label:'Kompleksi Grand',towards:[1462,414],finish:0xc7b8a7,trim:0xe5dbca},
]);
/** Retain the existing OSM footprint and height. Choose only existing edges
 * facing the street-side reference point; exact trim and bay finish are art. */
export function petroTodiBlockFacades(buildings) {
 const wanted=new Set(anchors.map(a=>a.id));
 const byId=new Map();
 for(const b of buildings){const id=String(b.id);if(wanted.has(id))byId.set(id,b);}
 return anchors.flatMap(anchor=>{
  const b=byId.get(anchor.id);
  if(!b?.p?.length||Number(b.tags?.['building:levels'])!==anchor.levels||!Number.isFinite(b.h))return [];
  const edges=facadeEdges(b.p).filter(e=>{
   const dx=anchor.towards[0]-e.x,dz=anchor.towards[1]-e.z;
   return e.length>=7&&Math.hypot(dx,dz)<85&&e.nx*dx+e.nz*dz>4;
  });
  const edge=edges.sort((a,b)=>b.length-a.length)[0];
  return edge?[{...anchor,x:edge.x,z:edge.z,h:b.h,edge}]:[];
 });
}
export function petroTodiBlockParts(block) {
 const {id,edge:e,h,levels,finish,trim}=block;
 const result=[];
 const box=(s,y,w,hh,d,color,offset)=>result.push({
  x:e.a[0]+e.ux*s+e.nx*offset,z:e.a[1]+e.uz*s+e.nz*offset,
  y,w,h:hh,d,color,yaw:e.yaw,buildingId:id,model:'box',
 });
 const floor=h/levels;
 // Base glass remains in the existing facade layer. These lightweight bands
 // and panels are external architectural trim, not another shell or collider.
 for(let i=1;i<levels;i++){
  const y=i*floor;
  box(e.length/2,y,e.length-.36,.16,.14,trim,.11);
  for(const frac of [.24,.72]){
   box(e.length*frac,y+.77,.32,1.32,.11,finish,.11);
  }
 }
 box(e.length/2,h-.38,e.length-.34,.26,.17,trim,.12);
 return result;
}
