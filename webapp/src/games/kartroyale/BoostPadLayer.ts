import * as T from 'three';
import { boostPads } from './arcadeRules.mjs';
import type { Track } from './simulation.mjs';
/** Flat event markings sit above the unchanged city road surface. */
export function createBoostPadLayer(track:Track){
  const group=new T.Group();group.name='Race boost strips';
  const pads=boostPads(track),geometry=new T.BoxGeometry(1,.025,1);
  // All road pads cost two draw calls, even on the longer circuits.
  const floors=new T.InstancedMesh(geometry,new T.MeshStandardMaterial({color:'#0b597c',emissive:'#09507d',emissiveIntensity:.8,roughness:.5}),pads.length);
  const arrows=new T.InstancedMesh(geometry,new T.MeshBasicMaterial({color:'#72edff',toneMapped:false}),pads.length*6);
  const frame=new T.Object3D(),piece=new T.Object3D(),matrix=new T.Matrix4();
  pads.forEach((pad,i)=>{
    frame.position.set(pad.x,.145,pad.z);frame.rotation.y=pad.yaw;frame.updateMatrix();
    piece.position.set(0,0,0);piece.rotation.set(0,0,0);piece.scale.set(pad.width,1,pad.length);piece.updateMatrix();
    floors.setMatrixAt(i,matrix.multiplyMatrices(frame.matrix,piece.matrix));
    for(let row=0;row<3;row++)for(let side=0;side<2;side++){
      const sign=side?1:-1;
      piece.scale.set(pad.width*.42,1,.24);piece.rotation.y=sign*.38;
      piece.position.set(sign*pad.width*.19,.018,-1.7+row*1.6);piece.updateMatrix();
      arrows.setMatrixAt(i*6+row*2+side,matrix.multiplyMatrices(frame.matrix,piece.matrix));
    }
  });
  floors.computeBoundingSphere();arrows.computeBoundingSphere();group.add(floors,arrows);
  return group;
}
