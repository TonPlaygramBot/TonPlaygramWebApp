import * as T from 'three';
import {canStyleBuilding,districtFinish} from './districtBuildingPalette.mjs';

/** Central renderer shells already have their own material and texture family.
 * Apply a bounded wall-only multiplier in buffer data to keep all merge keys,
 * draw calls, materials and UVs unchanged. Normalized bytes cost 3 B/vertex. */
export function colorCentralFacade(geo:T.BufferGeometry,b:any,base:number){
 const normal=geo.getAttribute('normal'), colors=new Uint8Array(normal.count*3);
 const finish=canStyleBuilding(b)?districtFinish(b.p,b.id):null;
 if(finish?.strength){
  const tint=new T.Color(base), hue=new T.Color(finish.color);
  // Preserve base luminance more than hue, avoiding over-darkening PBR plaster.
  const mix=.39*finish.strength;
  const intensity=1-.10*finish.strength;
  for(let i=0;i<normal.count;i++){
   const roof=Math.abs(normal.getY(i))>.5;
   colors[i*3]=roof?255:Math.round(255*Math.max(.68,Math.min(1,intensity+mix*(hue.r-tint.r))));
   colors[i*3+1]=roof?255:Math.round(255*Math.max(.68,Math.min(1,intensity+mix*(hue.g-tint.g))));
   colors[i*3+2]=roof?255:Math.round(255*Math.max(.68,Math.min(1,intensity+mix*(hue.b-tint.b))));
  }
 }else colors.fill(255);
 geo.setAttribute('color',new T.Uint8BufferAttribute(colors,3,true));
}
