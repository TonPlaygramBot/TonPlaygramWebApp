import * as T from 'three';
import type {Track} from './simulation.mjs';
import {circuitSides} from './trackEdges.mjs';
import {ROAD_SURFACE_Y} from './roadFeel.mjs';

/** The surface used by both the game and portable preview. Every triangle
 * faces upward, including locally reversed faces at folded ribbon joins. */
export function createRaceSurfaceGeometry(track:Track) {
  const count=track.points.length,sides=circuitSides(track.points,track.width/2);
  const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let i=0;i<=count;i++)for(const side of ['left','right'] as const){
    const p=sides[side][i%count];positions.push(p.x,ROAD_SURFACE_Y,p.z);normals.push(0,1,0);uvs.push(p.x/3,p.z/3);
  }
  const triangle=(a:number,b:number,c:number)=>{
    const ax=positions[a*3],az=positions[a*3+2];
    const up=(positions[b*3+2]-az)*(positions[c*3]-ax)-(positions[b*3]-ax)*(positions[c*3+2]-az);
    if(up<0)indices.push(a,c,b);else indices.push(a,b,c);
  };
  for(let i=0;i<count;i++){const a=i*2;triangle(a,a+2,a+1);triangle(a+1,a+2,a+3);}
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
  return geometry;
}
