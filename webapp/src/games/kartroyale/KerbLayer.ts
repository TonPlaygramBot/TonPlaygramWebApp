import * as T from 'three';
import type {Track} from './simulation.mjs';
import {trackSurface} from './tyreBarrierCore.mjs';

/** Use the same asphalt union as the tyres: inside kerbs must not keep the
 * crossed spurs left behind by a folded centreline offset at an apex. */
export function createKerbLayer(track:Track) {
  const group=new T.Group();group.name='Joined circuit kerbs';
  const geometry=new T.BoxGeometry(.55,.14,1),material=new T.MeshStandardMaterial({roughness:.8});
  const batches=new Map<string,{x:number;z:number;yaw:number;length:number;stripe:number}[]>();
  for(const polygon of trackSurface(track).polygons)for(const ring of polygon){
    let distance=0;
    for(let i=0;i<ring.length-1;i++){
      const a=ring[i],b=ring[i+1],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      if(length<.002)continue;
      const count=Math.ceil(length/1.5),piece=length/count;
      for(let j=0;j<count;j++){
        const t=(j+.5)/count,x=a[0]+dx*t-dz/length*.08,z=a[1]+dz*t+dx/length*.08;
        const key=`${Math.floor(x/64)},${Math.floor(z/64)}`;if(!batches.has(key))batches.set(key,[]);
        batches.get(key)!.push({x,z,yaw:Math.atan2(dx,dz),length:piece,stripe:Math.floor((distance+(j+.5)*piece)/3)%2});
      }
      distance+=length;
    }
  }
  const dummy=new T.Object3D(),colors=[new T.Color(track.accent),new T.Color('#e7e6d9')];
  for(const batch of batches.values()){
    const mesh=new T.InstancedMesh(geometry,material,batch.length);
    batch.forEach((p,i)=>{dummy.position.set(p.x,.15,p.z);dummy.rotation.y=p.yaw;dummy.scale.set(1,1,p.length+.018);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,colors[p.stripe]);});
    mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);
  }
  return group;
}
