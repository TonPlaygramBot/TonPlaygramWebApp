import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Immediate exterior masses from the Blender author's metre dimensions.
 * Windows/ornament arrive separately; a slow download never removes the building. */
export function mosqueShell() {
  const stone:T.BufferGeometry[]=[],lead:T.BufferGeometry[]=[];
  const box=(x:number,y:number,z:number,w:number,h:number,d:number)=>stone.push(new T.BoxGeometry(w,h,d).translate(x,y,z));
  const dome=(x:number,y:number,z:number,r:number,h:number)=>lead.push(new T.SphereGeometry(r,16,8,0,Math.PI*2,0,Math.PI/2).scale(1,h/r,1).translate(x,y,z));
  box(0,.35,0,60,.7,78);box(0,7.4,14,55,13.4,46);box(0,17,14,41,6,36);
  box(-23,5.2,-23,9,9.8,28);box(23,5.2,-23,9,9.8,28);box(0,5.2,-33,38,9.8,8);
  box(0,.8,-22,38,.15,21);
  stone.push(new T.CylinderGeometry(13.3,13.3,4.2,24).translate(0,22.1,14));
  dome(0,24.2,14,13.5,9.3);
  for(const [x,z] of [[-15,14],[15,14],[0,29],[0,-1]])dome(x,18.7,z,9.1,6.4);
  for(const x of [-18,18])for(const z of [29,-1])dome(x,15.8,z,5.2,3.8);
  for(const x of [-15,-7.5,0,7.5,15])dome(x,10.2,-32,3.7,2.5);
  for(const x of [-23,23])for(const z of [-15,-23])dome(x,10.2,z,3.7,2.5);
  for(const x of [-26,26])for(const z of [34,-7]){
    stone.push(new T.CylinderGeometry(1.38,2.35,10.35,8).translate(x,5.825,z));
    stone.push(new T.CylinderGeometry(.82,1.38,33.5,12).translate(x,26.75,z));
    for(const y of [22,31,39.5])stone.push(new T.CylinderGeometry(2.04,1.5,1.2,12).translate(x,y,z));
    lead.push(new T.ConeGeometry(1.1,6.7,12).translate(x,46.65,z));
  }
  const group=new T.Group();group.name='Namazgah complete startup shell';
  for(const [parts,color] of [[stone,0xe8e0ca],[lead,0x52636d]] as const){
    const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());
    if(!geometry)throw Error('Cannot build Namazgah startup shell');
    const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.8}));mesh.receiveShadow=true;group.add(mesh);
  }
  return group;
}
