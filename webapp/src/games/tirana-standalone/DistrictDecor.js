import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {LANA_TREE,FIXTURES} from './district.mjs';

const caps={tree:2,'water-tank':9,'park-bench':6};
const sphere=(a,b,r)=>(a.x-b.x)**2+(a.z-b.z)**2<r*r;
function nearest(places,viewer,kind,r,cap){
  return places.filter(p=>p.kind===kind&&sphere(p,viewer,r)).sort((a,b)=>((a.x-viewer.x)**2+(a.z-viewer.z)**2)-((b.x-viewer.x)**2+(b.z-viewer.z)**2)).slice(0,cap);
}
class Batches{
  group=new T.Group();
  mesh=[];
  scratch=new T.Object3D();
  multiply=new T.Matrix4();
  constructor(source,root,kind){
    source.updateMatrixWorld(true);
    let neutral=new T.Matrix4();
    if(kind==='tree'){
      const box=new T.Box3().setFromObject(root),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
      const width=Math.max(size.x,size.z);
      if(width<=0||size.y<=0)throw Error('Tree source has invalid bounds');
      neutral.makeScale(1/width,1/size.y,1/width).multiply(new T.Matrix4().makeTranslation(-center.x,-box.min.y,-center.z));
    }
    root.traverse(o=>{
      if(!o.isMesh||o.isSkinnedMesh)return;
      const inst=new T.InstancedMesh(o.geometry,o.material,caps[kind]);
      inst.count=0;inst.frustumCulled=false;inst.receiveShadow=true;
      inst.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(inst);
      this.mesh.push({inst,identity:neutral.clone().multiply(o.matrixWorld)});
    });
    if(!this.mesh.length)throw Error('No static primitives for '+kind);
    this.group.name='Civilian district '+kind;
  }
  update(places,battery){
    for(let i=0;i<places.length;i++){
      const p=places[i];
      this.scratch.position.set(p.x,p.y,p.z);this.scratch.rotation.y=p.yaw;
      this.scratch.scale.set(p.crown||1,p.height||1,p.crown||1);this.scratch.updateMatrix();
      for(const o of this.mesh)o.inst.setMatrixAt(i,this.multiply.multiplyMatrices(this.scratch.matrix,o.identity));
    }
    for(const {inst} of this.mesh){
      inst.count=places.length;inst.instanceMatrix.needsUpdate=true;
      // Tree visuals are not paid twice for dynamic shadow draws.
      inst.castShadow=!battery&&this.group.name.endsWith('tank');
    }
  }
  dispose(){
    for(const {inst} of this.mesh)inst.dispose();
    this.group.removeFromParent();
  }
}
export class DistrictDecor {
  constructor(scene,placements,assets,disposeScene){
    this.scene=scene;this.places=placements;this.assets=assets;this.disposeScene=disposeScene;
    this.templates=[];this.batches=new Map();this.failed=new Set();this.last={x:Infinity,z:Infinity};this.requested=new Set();this.loader=new GLTFLoader();
  }
  request(key,path,kinds){
    if(this.requested.has(key)||this.failed.has(key)||this.dead)return;
    this.requested.add(key);
    this.loader.load(path,({scene})=>{
      if(this.dead){this.disposeScene(scene);return;}
      this.templates.push(scene);
      for(const kind of kinds){const root=kind==='tree'?scene:scene.getObjectByName(kind);if(!root)continue;
        try{const b=new Batches(scene,root,kind);this.batches.set(kind,b);this.scene.add(b.group);}catch{}
      }
      this.last={x:Infinity,z:Infinity};
    },undefined,()=>this.failed.add(key));
  }
  update(viewer,battery){
    if(this.battery===battery&&sphere(this.last,viewer,9))return;
    this.last={x:viewer.x,z:viewer.z};this.battery=battery;
    if(viewer.x<-105&&!battery&&this.places.some(p=>p.kind==='tree'&&sphere(p,viewer,85)))this.request('tree',this.assets+LANA_TREE,['tree']);
    if(viewer.x<-120&&this.places.some(p=>p.kind!=='tree'&&sphere(p,viewer,100)))this.request('fixtures',FIXTURES,['water-tank','park-bench']);
    for(const [kind,b] of this.batches){
      const list=battery&&kind==='tree'?[]:nearest(this.places,viewer,kind,battery?45:kind==='tree'?74:88,battery?Math.min(3,caps[kind]):caps[kind]);
      b.update(list,battery);
    }
  }
  dispose(){
    this.dead=true;
    for(const b of this.batches.values())b.dispose();
    for(const t of this.templates)this.disposeScene(t);
  }
}
