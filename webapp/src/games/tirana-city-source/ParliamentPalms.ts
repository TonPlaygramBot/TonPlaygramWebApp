import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
/** Two fan palms beside the public entrance, based on city-parliament.jpg.
 * Authored dimensions; static material batches, no per-frame leaf objects. */
export function parliamentPalms(){
 const root=new T.Group();root.name='Parliament entrance fan palms';
 const parts:T.BufferGeometry[][]=[[],[],[]];
 for(const [x,height] of [[-12,3.6],[12,4.8]]){
  const trunk=new T.CylinderGeometry(.12,.19,height-.6,9).translate(x,(height-.6)/2+.6,1.5);parts[0].push(trunk.toNonIndexed());trunk.dispose();
  const planter=new T.BoxGeometry(1.8,.65,1.6).translate(x,.325,1.5);parts[2].push(planter.toNonIndexed());planter.dispose();
  const positions:number[]=[];
  for(let leaf=0;leaf<14;leaf++){
   const angle=leaf*2.399,r=1.1+(leaf%3)*.22;
   const start=new T.Vector3(x,height-.15,1.5),hub=new T.Vector3(x+Math.cos(angle)*r*.55,height+(leaf%3)*.2,1.5+Math.sin(angle)*r*.55);
   const right=new T.Vector3(-Math.sin(angle),0,Math.cos(angle));
   for(let finger=0;finger<11;finger++){
    const spread=(finger-5)/5;
    const tip=hub.clone().add(new T.Vector3(Math.cos(angle)*r*.6,-.25-Math.abs(spread)*.12,Math.sin(angle)*r*.6)).addScaledVector(right,spread*.65);
    const shoulder=hub.clone().addScaledVector(right,spread*.29);
    positions.push(...start.toArray(),...shoulder.clone().addScaledVector(right,-.06).toArray(),...tip.toArray(),...start.toArray(),...tip.toArray(),...shoulder.clone().addScaledVector(right,.06).toArray());
   }
  }
  const leaves=new T.BufferGeometry();leaves.setAttribute('position',new T.Float32BufferAttribute(positions,3));leaves.computeVertexNormals();leaves.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));parts[1].push(leaves);
 }
 const materials=[new T.MeshStandardMaterial({color:0x776047,roughness:1}),new T.MeshStandardMaterial({color:0x496640,roughness:.95,side:T.DoubleSide}),new T.MeshStandardMaterial({color:0x9a7465,roughness:.94})];
 parts.forEach((geometries,i)=>{const mesh=new T.Mesh(mergeGeometries(geometries,false)!,materials[i]);geometries.forEach(g=>g.dispose());mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);});
 root.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false;});return root;
}
