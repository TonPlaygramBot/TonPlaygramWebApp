import * as T from 'three';
import {sourceBuildingColour} from './buildingAppearance';
/** Direct footprint walls/roofs: no extrusion objects, window planes or trim boxes. */
export function appendBuildingShell(b:any,positions:number[],colors:number[]){
 const outer=b.p.map((p:number[])=>new T.Vector2(p[0],p[1]));
 const holes=(b.holes||[]).map((ring:number[][])=>ring.map(p=>new T.Vector2(p[0],p[1])));
 const faces=T.ShapeUtils.triangulateShape(outer,holes);
 const points=[...outer,...holes.flat()];
 const low=b.minHeight||0,high=Math.max(low+.1,b.h);
 const color=sourceBuildingColour(b);
 const triangle=(a:number[],c:number[],d:number[],shade:number)=>{
  positions.push(...a,...c,...d);for(let i=0;i<3;i++)colors.push(color.r*shade,color.g*shade,color.b*shade);
 };
 for(const face of faces){
  const [a,c,d]=face.map(i=>points[i]);
  if((c.x-a.x)*(d.y-a.y)-(c.y-a.y)*(d.x-a.x)>0)triangle([a.x,high,a.y],[d.x,high,d.y],[c.x,high,c.y],.72);
  else triangle([a.x,high,a.y],[c.x,high,c.y],[d.x,high,d.y],.72);
 }
 for(const [index,ring] of [b.p,...(b.holes||[])].entries()){
  const area=ring.reduce((n:number,a:number[],i:number)=>{const c=ring[(i+1)%ring.length];return n+a[0]*c[1]-c[0]*a[1];},0);
  const reverse=(area>0)===(index===0);
  for(let i=0;i<ring.length;i++){
   const a=ring[i],c=ring[(i+1)%ring.length],v=[[a[0],low,a[1]],[c[0],low,c[1]],[c[0],high,c[1]],[a[0],high,a[1]]];
   for(const face of reverse?[[0,2,1],[0,3,2]]:[[0,1,2],[0,2,3]])triangle(v[face[0]],v[face[1]],v[face[2]],.95);
  }
 }
}
export function shellGeometry(positions:number[],colors:number[]){
 const geo=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3)).setAttribute('color',new T.Float32BufferAttribute(colors,3));
 geo.computeVertexNormals();const p=geo.getAttribute('position'),n=geo.getAttribute('normal'),uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){uv[i*2]=(Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))/4;uv[i*2+1]=(Math.abs(n.getY(i))>.5?p.getZ(i):p.getY(i))/4;}
 geo.setAttribute('uv',new T.BufferAttribute(uv,2));geo.computeBoundingSphere();return geo;
}
