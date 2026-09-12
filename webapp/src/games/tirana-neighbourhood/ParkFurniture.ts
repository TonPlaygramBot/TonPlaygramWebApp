import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {NEIGHBOURHOOD} from './data.mjs';
import {nearbyIndex} from '../tirana-street-life/streetModels.mjs';
import {disposeWeaponResources} from '../tiranastreets/weaponModelResources';

/** Benches use mapped OSM points. No invented bust likeness or monument name. */
export class ParkFurniture {
 readonly group=new T.Group();
 private near=nearbyIndex(NEIGHBOURHOOD.places.filter(p=>p.point&&p.tags.amenity==='bench').map(p=>({id:p.id,x:p.point[0],z:p.point[1],heading:Number(p.tags.direction)||0})));
 private meshes:T.InstancedMesh[]=[];
 private source?:T.Group;
 private dead=false;
 private requested=false;
 private dummy=new T.Object3D();
 constructor(){this.group.name='Tirana:OSM-park-benches';}
 update(viewer:{x:number;z:number},battery:boolean){
  const points=this.near(viewer,battery?110:200,battery?24:48);
  if(points.length&&!this.requested){this.requested=true;void this.load();}
  for(const mesh of this.meshes){mesh.count=0;for(const p of points){this.dummy.position.set(p.x,.07,p.z);this.dummy.rotation.set(0,-p.heading*Math.PI/180,0);this.dummy.updateMatrix();mesh.setMatrixAt(mesh.count++,this.dummy.matrix);}mesh.instanceMatrix.needsUpdate=true;}
 }
 private async load(){
  try{
   const gltf=await new GLTFLoader().loadAsync('/assets/tirana-streets/realism/park-bench.glb');
   if(this.dead){disposeWeaponResources([gltf.scene]);return;}this.source=gltf.scene;gltf.scene.updateMatrixWorld(true);
   const parts=new Map<T.Material,T.BufferGeometry[]>();
   gltf.scene.traverse(o=>{if(!(o instanceof T.Mesh)||Array.isArray(o.material))return;
    const g=o.geometry.clone().applyMatrix4(o.matrixWorld),geo=g.index?g.toNonIndexed():g;if(geo!==g)g.dispose();
    if(!parts.has(o.material))parts.set(o.material,[]);parts.get(o.material)!.push(geo);
   });
   for(const [material,geos] of parts){const geometry=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());if(!geometry)continue;
    const mesh=new T.InstancedMesh(geometry,material,48);mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;this.meshes.push(mesh);this.group.add(mesh);
   }
  }catch(error){if(!this.dead)console.warn('Park furniture unavailable',error);}
 }
 dispose(){this.dead=true;this.meshes.forEach(m=>m.geometry.dispose());if(this.source)disposeWeaponResources([this.source]);this.group.clear();this.group.removeFromParent();}
}
