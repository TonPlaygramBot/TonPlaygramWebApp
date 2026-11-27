import {buildingGround} from '../tirana-east/terrainCore.mjs';
import * as T from 'three';
import {cityFacadeClass} from './facadePhotomaterials';
import {sourceBuildingColour,windowRows} from './buildingAppearance';
import {housingProfile} from '../tirana-east/housingCore.mjs';
import {wallWindowProjection,windowVertex} from './wallWindows.mjs';
/** Direct footprint walls/roofs: no extrusion objects, window planes or trim boxes. */
export function appendBuildingShell(b:any,positions:number[],colors:number[],facades?:number[],windows?:number[]){
 const outer=b.p.map((p:number[])=>new T.Vector2(p[0],p[1]));
 const holes=(b.holes||[]).map((ring:number[][])=>ring.map(p=>new T.Vector2(p[0],p[1])));
 const faces=T.ShapeUtils.triangulateShape(outer,holes);
 const points=[...outer,...holes.flat()];
 const base=buildingGround(b),low=base+(b.minHeight||0),high=base+Math.max((b.minHeight||0)+.1,b.h);
 const wallColor=sourceBuildingColour(b),roofColor=sourceBuildingColour(b,false);
 const wallFacade=facades ? cityFacadeClass(b.tags) : 0;
 const rows=windows&&!housingProfile(b)?windowRows(b):[];
 const triangle=(a:number[],c:number[],d:number[],shade:number,facade=0,color=roofColor,bays=[0,0,0,0,0,0,0,0,0,0,0,0])=>{
  if(facades)facades.push(facade,facade,facade);
  if(windows)windows.push(...bays);
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
   const span=rows.length?wallWindowProjection(b,rows,Math.hypot(c[0]-a[0],c[1]-a[1])):null;
   const uv=span?v.map((point,j)=>windowVertex(span,j===1||j===2?1:0,point[1]-base)):null;
   for(const face of reverse?[[0,2,1],[0,3,2]]:[[0,1,2],[0,2,3]])triangle(v[face[0]],v[face[1]],v[face[2]],.95,wallFacade,wallColor,uv?[...uv[face[0]],...uv[face[1]],...uv[face[2]]]:undefined);
  }
 }
}
export function shellGeometry(positions:number[],colors:number[],facades?:number[],windows?:number[]){
 const geo=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3)).setAttribute('color',new T.Float32BufferAttribute(colors,3));
 if(facades)geo.setAttribute('cityFacadeClass',new T.Uint8BufferAttribute(facades,1));
 if(windows)geo.setAttribute('cityWindow',new T.Uint16BufferAttribute(windows,4,true));
 geo.computeVertexNormals();const p=geo.getAttribute('position'),n=geo.getAttribute('normal'),uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){uv[i*2]=(Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))/4;uv[i*2+1]=(Math.abs(n.getY(i))>.5?p.getZ(i):p.getY(i))/4;}
 geo.setAttribute('uv',new T.BufferAttribute(uv,2));geo.computeBoundingSphere();return geo;
}
