import * as T from 'three';
import {sampleCircuitDistance} from './circuitMetrics.mjs';
import {surfaceHeight} from './racingSurface.mjs';
import type {Track} from './simulation.mjs';
/** Flush road furniture cannot become an invisible obstacle. Two instanced
 * draws add reflectors and drainage without hundreds of scene nodes. */
export function createRacingRoadside(track:Track){
 const group=new T.Group();group.name='Racing road edge reflectors and drainage';
 const count=Math.min(500,Math.floor(track.length/12)),matrix=new T.Object3D();
 const studs=new T.InstancedMesh(new T.BoxGeometry(.09,.018,.22),new T.MeshStandardMaterial({color:'#f7e8af',roughness:.45,metalness:.2}),count*2);
 const drains=new T.InstancedMesh(new T.BoxGeometry(.25,.014,.55),new T.MeshStandardMaterial({color:'#3f4547',roughness:.86,metalness:.5}),Math.ceil(count/4)*2);
 let at=0;
 for(let i=0;i<count;i++){
  const p=sampleCircuitDistance(track,(i+.5)*track.length/count),width=track.points[p.index].width??track.width;
  for(const side of [-1,1]){
   const offset=side*(width*.5-.13),x=p.x+Math.cos(p.yaw)*offset,z=p.z-Math.sin(p.yaw)*offset;
   matrix.position.set(x,surfaceHeight(track,x,z)+.14,z);matrix.rotation.set(0,p.yaw,0);matrix.updateMatrix();
   studs.setMatrixAt(i*2+Number(side===1),matrix.matrix);
   if(i%4===0){matrix.position.y-=.008;matrix.updateMatrix();drains.setMatrixAt(at++,matrix.matrix);}
  }
 }
 drains.count=at;studs.computeBoundingSphere();drains.computeBoundingSphere();group.add(studs,drains);return group;
}
