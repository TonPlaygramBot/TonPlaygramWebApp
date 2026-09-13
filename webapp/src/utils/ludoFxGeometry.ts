import * as T from 'three';
/** Shared Ludo effect geometry without importing gifts or game UI. */
export function addFxSphere(group:T.Object3D,radius:number,position:readonly number[],color:T.ColorRepresentation,roughness=.45,metalness=.25,transparent=false,opacity=1){
 const mesh=new T.Mesh(new T.SphereGeometry(radius,16,16),new T.MeshStandardMaterial({color,roughness,metalness,transparent,opacity}));
 mesh.position.set(position[0],position[1],position[2]);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
}
