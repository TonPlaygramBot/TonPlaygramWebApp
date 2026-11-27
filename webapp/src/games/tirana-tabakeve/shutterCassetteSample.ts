import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {BRIDGE} from './quarterCore.mjs';

export const TABAKEVE_SHUTTER_URL='/assets/tirana-streets/environment/tabakeve-shutter-cassette-v1.glb';
type Box={buildingId: string; x:number;y:number;z:number;yaw:number;w:number;h:number;d:number;model:string};
type Viewer={x:number;z:number};
const site='409325648';
const near=(to:Viewer,a:Viewer)=>Math.hypot(a.x-to.x,a.z-to.z);
/** Recognize only the existing narrow upper cover, not glass, side trims, signs, or entries. */
export function selectCassetteSample(parts:readonly Box[]) {
  return parts.filter(p=>String(p.buildingId)===site&&p.model==='box'&&p.w===2.45&&p.h===.11&&p.d===.58)
    .sort((a,b)=>near(BRIDGE,a)-near(BRIDGE,b)||a.y-b.y||a.x-b.x||a.z-b.z).slice(0,2);
}
function disposeScene(scene:T.Object3D) {
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
  scene.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);
    for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);
      for(const v of Object.values(m))if(v instanceof T.Texture)textures.add(v);
    }
  }});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}
/** Lazy single batch. The previous covers continue drawing until the sample is ready. */
export function createQuarterCassetteSample(load=async()=> (await new GLTFLoader().loadAsync(TABAKEVE_SHUTTER_URL)).scene) {
  const group=new T.Group();group.name='Tabakëve: representative shutter cassette sample';
  const dummy=new T.Object3D(),bounds=new T.Vector3();
  let mesh:T.InstancedMesh|undefined,source:T.Object3D|undefined,started=false,dead=false;
  let ready:Promise<boolean>|undefined;
  function update(viewer:Viewer,parts:readonly Box[]):Set<Box> {
    const selected=alive()&&near(BRIDGE,viewer)<72?selectCassetteSample(parts):[];
    if(!started&&selected.length){
      started=true;ready=load().then(scene=>{
        const object=scene.getObjectByName('tabakeve_shutter_cassette');
        if(dead||!(object instanceof T.Mesh)||Array.isArray(object.material)){
          disposeScene(scene);return false;
        }
        const geometry=object.geometry;
        geometry.computeBoundingBox();
        const box=geometry.boundingBox;box?.getSize(bounds);
        if(!box||![bounds.x,bounds.y,bounds.z].every(v=>v>0&&Number.isFinite(v))){
          disposeScene(scene);return false;
        }
        const centre=box.getCenter(new T.Vector3());geometry.translate(-centre.x,-centre.y,-centre.z);
        source=scene;mesh=new T.InstancedMesh(geometry,object.material,2);mesh.name='Tabakëve: raised shutter cassette';
        mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;group.add(mesh);return true;
      },()=>false);
    }
    if(!mesh)return new Set();
    mesh.count=0;
    for(const p of selected){
      dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);
      // Same authored envelope, including the existing wall contact depth.
      dummy.scale.set(p.w/bounds.x,p.h/bounds.y,p.d/bounds.z);
      dummy.updateMatrix();mesh.setMatrixAt(mesh.count++,dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
    return new Set(selected);
  }
  const alive=()=>!dead;
  return {group,update,get ready(){return ready;},dispose(){
    if(dead)return;dead=true;
    if(mesh)mesh.dispose();if(source)disposeScene(source);
    group.clear();group.removeFromParent();
  }};
}
