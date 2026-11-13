import * as T from 'three';
type Point={x:number;z:number};
/** Retain the GPU allocation while routes change; follow terrain elevation. */
export function updateNavigationLine(line:T.Line|null,points:readonly Point[],height:(x:number,z:number)=>number):T.Line|null{
 const valid=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z));
 if(valid.length<2){if(line){line.visible=false;line.geometry.setDrawRange(0,0);}return line;}
 line??=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:0xddf67d,transparent:true,opacity:.85}));
 const geometry=line.geometry;let position=geometry.getAttribute('position') as T.BufferAttribute;
 if(!position||position.count<valid.length){
  geometry.dispose();
  position=new T.BufferAttribute(new Float32Array(Math.max(64,2**Math.ceil(Math.log2(valid.length)))*3),3);
  position.setUsage(T.DynamicDrawUsage);geometry.setAttribute('position',position);
 }
 valid.forEach((p,i)=>position.setXYZ(i,p.x,height(p.x,p.z)+.24,p.z));
 const firstY=position.getY(0);
 for(let i=valid.length;i<position.count;i++)position.setXYZ(i,valid[0].x,firstY,valid[0].z);
 position.needsUpdate=true;geometry.setDrawRange(0,valid.length);geometry.computeBoundingSphere();line.visible=true;return line;
}
/** The route end is the last drawn vertex, never the unused buffer capacity. */
export function navigationLineEnd(line:T.Line|null){
 if(!line?.visible)return null;
 const position=line.geometry.getAttribute('position');
 const count=Math.min(position?.count||0,line.geometry.drawRange.count);
 return count>=2?{x:position.getX(count-1),y:position.getY(count-1),z:position.getZ(count-1)}:null;
}
