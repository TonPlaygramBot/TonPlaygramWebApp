import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
const loader=new GLTFLoader();
export async function getModel(file:string,track?:(n:number)=>void){
  return loader.loadAsync('worlds/'+file+'.glb',e=>{if(e.total&&track)track(e.loaded/e.total)});
}
export function setMeshes(root:T.Object3D,casts=true){
  root.traverse(o=>{if(!(o instanceof T.Mesh))return;o.castShadow=casts;o.receiveShadow=true;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    for(const m of mats){if(m.map)m.map.anisotropy=4}
  });
}
function footprint(){
  const c=document.createElement('canvas');c.width=c.height=48;const ctx=c.getContext('2d')!;
  const r=ctx.createRadialGradient(24,24,1,24,24,24);r.addColorStop(0,'rgba(17,20,18,.60)');r.addColorStop(.52,'rgba(19,22,19,.36)');r.addColorStop(1,'rgba(15,18,16,0)');ctx.fillStyle=r;ctx.fillRect(0,0,48,48);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const m=new T.MeshBasicMaterial({map:tex,depthWrite:false,transparent:true,polygonOffset:true,polygonOffsetFactor:-2,side:T.DoubleSide});
  const mesh=new T.Mesh(new T.PlaneGeometry(.90,1.28),m);mesh.rotation.x=-Math.PI/2;mesh.position.set(.02,.035,-.12);return mesh;
}
export const forwardOffset={hero:0,guard:0};
export class Actor{
  root=new T.Group();model:T.Object3D;mixer:T.AnimationMixer;private actions:Record<string,T.AnimationAction>={};private active='';height=1.80;
  constructor(gltf:any,which:'hero'|'guard'){
    this.model=clone(gltf.scene);setMeshes(this.model);this.root.add(this.model,footprint());
    const box=new T.Box3().setFromObject(this.model,true);const h=box.max.y-box.min.y;
    const scale=1.8/Math.max(.01,h);this.model.scale.multiplyScalar(scale);
    this.model.position.y-=box.min.y*scale;this.model.rotation.y+=forwardOffset[which];
    this.mixer=new T.AnimationMixer(this.model);for(const clip of gltf.animations){this.actions[clip.name.toLowerCase()]=this.mixer.clipAction(clip)}
    this.motion('idle');
  }
  motion(name:'idle'|'walk'|'run'){
    if(name===this.active)return;const key=Object.keys(this.actions).find(x=>x.includes(name))??Object.keys(this.actions)[0];if(!key)return;
    this.actions[this.active]?.fadeOut(.18);this.actions[key].reset().fadeIn(.18).play();this.active=key;
  }
  tick(dt:number){this.mixer.update(dt)}
  dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model)}
}
export function disposeScene(root:T.Object3D){
  const geo=new Set<T.BufferGeometry>(),mats=new Set<T.Material>(),tex=new Set<T.Texture>();
  root.traverse(obj=>{const o=obj as T.Mesh;if(o.geometry)geo.add(o.geometry);if(o.material){const list=Array.isArray(o.material)?o.material:[o.material];list.forEach(m=>{mats.add(m);Object.values(m).forEach(val=>{if(val instanceof T.Texture)tex.add(val)})})}if((o as T.SkinnedMesh).isSkinnedMesh)(o as T.SkinnedMesh).skeleton.dispose()});geo.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());tex.forEach(t=>t.dispose());
}
