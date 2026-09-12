import * as T from 'three';
import { boostPads } from './arcadeRules.mjs';
import type { Track } from './simulation.mjs';
/** Flat event markings sit above the unchanged city road surface. */
export function createBoostPadLayer(track:Track){
  const group=new T.Group();group.name='Race boost strips';
  const pads=boostPads(track),base=new T.MeshStandardMaterial({color:'#0b597c',emissive:'#09507d',emissiveIntensity:.6,roughness:.5});
  const bright=new T.MeshBasicMaterial({color:'#72edff',toneMapped:false});
  const geometry=new T.BoxGeometry(1,.025,1);
  for(const pad of pads){
    const g=new T.Group();g.position.set(pad.x,.145,pad.z);g.rotation.y=pad.yaw;
    const floor=new T.Mesh(geometry,base);floor.scale.set(pad.width,1,4);g.add(floor);
    for(let row=0;row<3;row++)for(const side of [-1,1]){
      const arrow=new T.Mesh(geometry,bright);arrow.scale.set(pad.width*.42,1,.18);arrow.rotation.y=side*.38;arrow.position.set(side*pad.width*.19,.018,-1.2+row*1.05);g.add(arrow);
    }
    group.add(g);
  }
  return group;
}
