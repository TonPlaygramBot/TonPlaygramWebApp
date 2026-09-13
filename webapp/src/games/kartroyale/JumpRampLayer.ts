import * as T from 'three';
import type {Track} from './simulation.mjs';
import {jumpRamps} from './jumpRamps.mjs';
import {surfaceHeight} from './racingSurface.mjs';

/** A sloped deck, solid sides and bright chevrons, batched into one draw. */
export function createJumpRampLayer(track:Track){
  const group=new T.Group();group.name='Boost jump ramps';
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const dark=new T.Color('#283d48'),blue=new T.Color('#49daf3'),edge=new T.Color('#f4ce58');
  const quad=(r:any,points:number[][],color:T.Color)=>{
    const base=positions.length/3,s=Math.sin(r.yaw),c=Math.cos(r.yaw);
    for(const [x,y,z] of points){const wx=r.x+c*x+s*z,wz=r.z-s*x+c*z;positions.push(wx,surfaceHeight(track,wx,wz)+.14+y,wz);colors.push(color.r,color.g,color.b);}
    indices.push(base,base+2,base+1,base+1,base+2,base+3);
  };
  for(const r of jumpRamps(track)){
    const w=r.width/2,l=r.length/2;
    for(let i=0;i<10;i++){
      const z=-l+i,y=r.height*i/10,y2=r.height*(i+1)/10;
      quad(r,[[-w,y,z],[w,y,z],[-w,y2,z+1],[w,y2,z+1]],dark);
      for(const side of [-1,1]){
        quad(r,[[side*w,0,z],[side*w,y,z],[side*w,0,z+1],[side*w,y2,z+1]],i%2?dark:edge);
        quad(r,[[side*w,y+.01,z],[side*(w-.16),y+.01,z],[side*w,y2+.01,z+1],[side*(w-.16),y2+.01,z+1]],edge);
      }
    }
    quad(r,[[-w,0,l],[w,0,l],[-w,r.height,l],[w,r.height,l]],dark);
    for(const z of [-2.8,0,2.8])for(const side of [-1,1]){
      const x=side*r.width*.32,top=(along:number)=>r.height*(along/r.length+.5)+.02;
      quad(r,[[x,top(z-.7),z-.7],[x,top(z-.35),z-.35],[0,top(z+.2),z+.2],[0,top(z+.55),z+.55]],blue);
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.72}));mesh.receiveShadow=true;group.add(mesh);return group;
}
