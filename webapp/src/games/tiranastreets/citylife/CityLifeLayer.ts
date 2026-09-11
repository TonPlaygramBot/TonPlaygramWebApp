import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CityLifeCore,BUDGETS,type NPC,type Point,type LifeEvent} from './CityLifeCore';
const BASE='/assets/tirana-citylife/v1/';
type Actor={root:T.Object3D;mixer:T.AnimationMixer;clip:string;actions:Map<string,T.AnimationAction>;asset:string;gun?:T.Object3D};
/** Scene-owned resource cache. Clones share mesh/texture resources; skeletons do not. */
export class CityLifeLayer{
 readonly group=new T.Group();readonly errors:string[]=[];
 private failed=new Set<string>();private cache=new Map<string,Promise<GLTF>>();private sources=new Set<GLTF>();private actors=new Map<string,Actor>();private pending=new Set<string>();
 private far=new Map<string,T.InstancedMesh>();private farPending=new Set<string>();private vehicles=new Map<number,T.Object3D>();private vehiclePending=new Set<number>();
 private fire=new Map<number,T.Mesh>();private effects:{object:T.Object3D;ttl:number}[]=[];private dead=false;
 private frustum=new T.Frustum();private projection=new T.Matrix4();private dummy=new T.Object3D();private clock={value:0};
 private gunGeo=new T.BoxGeometry(.035,.075,.16);private gunMat=new T.MeshStandardMaterial({color:0x242a30,roughness:.45,metalness:.55});
 constructor(readonly core:CityLifeCore,readonly scene:T.Scene){scene.add(this.group);this.group.name='Tirana CityLife v1';}
 private load(id:string){let p=this.cache.get(id);if(!p){p=new GLTFLoader().loadAsync(BASE+id+'.glb').then(g=>{if(this.dead){this.disposeSource(g);throw Error('Layer disposed');}this.sources.add(g);return g;}).catch(e=>{this.failed.add(id);throw e;});this.cache.set(id,p);}return p;}
 private fail(id:string,e:unknown){const text=`${id}: ${e instanceof Error?e.message:String(e)}`;if(!this.errors.includes(text))this.errors.push(text);}
 private release(key:string){const a=this.actors.get(key);if(!a)return;a.mixer.stopAllAction();a.mixer.uncacheRoot(a.root);a.root.removeFromParent();a.root.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)(o as T.SkinnedMesh).skeleton.dispose();});this.actors.delete(key);}
 private actor(key:string,asset:string){
  if(this.failed.has(asset+'_lod1'))return;const old=this.actors.get(key);if(old?.asset===asset)return old;if(old)this.release(key);if(this.pending.has(key))return;
  this.pending.add(key);this.load(asset+'_lod1').then(g=>{
   if(this.dead)return;const root=cloneSkeleton(g.scene),mixer=new T.AnimationMixer(root);const actions=new Map(g.animations.map(c=>[c.name,mixer.clipAction(c)]));actions.get('Idle')?.play();
   root.traverse(o=>{if((o as T.Mesh).isMesh){o.castShadow=true;o.receiveShadow=false;}});this.group.add(root);this.actors.set(key,{root,mixer,actions,clip:'Idle',asset});
  }).catch(e=>this.fail(asset,e)).finally(()=>this.pending.delete(key));
 }
 private pose(a:Actor,p:Point,heading:number,clip:string,dt:number,down=false){
  a.root.visible=true;a.root.position.set(p.x,down?.16:0,p.z);a.root.rotation.set(down?-Math.PI/2:0,heading,0);
  if(clip!==a.clip){a.actions.get(a.clip)?.fadeOut(.16);a.actions.get(clip)?.reset().fadeIn(.16).play();a.clip=clip;}a.mixer.update(dt);
 }
 private createFar(asset:string){
  if(this.failed.has(asset+'_lod2')||this.farPending.has(asset)||this.far.has(asset))return;this.farPending.add(asset);
  this.load(asset+'_lod2').then(g=>{
   if(this.dead)return;const root=cloneSkeleton(g.scene),mixer=new T.AnimationMixer(root);const idle=g.animations.find(c=>c.name==='Idle');if(idle){mixer.clipAction(idle).play();mixer.update(0);}root.updateMatrixWorld(true);
   const parts:T.BufferGeometry[]=[];
   root.traverse(o=>{const mesh=o as T.SkinnedMesh;if(!mesh.isMesh)return;const original=mesh.geometry;const geo=original.index?original.toNonIndexed():original.clone();const pos=geo.getAttribute('position');const v=new T.Vector3();
    // Bone weights belong to indexed geometry: deform there before unindexing.
    const base=original.clone(),bp=base.getAttribute('position');if(mesh.isSkinnedMesh)mesh.skeleton.update();for(let i=0;i<bp.count;i++){v.fromBufferAttribute(bp,i);if(mesh.isSkinnedMesh){mesh.applyBoneTransform(i,v);}v.applyMatrix4(mesh.matrixWorld);bp.setXYZ(i,v.x,v.y,v.z);}const baked=base.index?base.toNonIndexed():base;const out=baked.clone();out.deleteAttribute('skinIndex');out.deleteAttribute('skinWeight');out.deleteAttribute('uv');out.deleteAttribute('normal');
    const mat=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material) as T.MeshStandardMaterial;const color=mat.color?.clone()||new T.Color(0x999999);if(/skin/i.test(mat.name))color.set(0xc69a7b);if(/hair/i.test(mat.name))color.set(0x392c25);if(/boot/i.test(mat.name))color.set(0x242527);
    const colors=new Float32Array(out.getAttribute('position').count*3);for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}out.setAttribute('color',new T.BufferAttribute(colors,3));out.computeVertexNormals();parts.push(out);geo.dispose();base.dispose();if(baked!==base)baked.dispose();
   });
   const merged=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());mixer.stopAllAction();mixer.uncacheRoot(root);root.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)(o as T.SkinnedMesh).skeleton.dispose();});if(!merged)return;
   merged.setAttribute('crowdPhase',new T.InstancedBufferAttribute(new Float32Array(128),1));merged.setAttribute('crowdMoving',new T.InstancedBufferAttribute(new Float32Array(128),1));
   const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:.88});mat.onBeforeCompile=shader=>{shader.uniforms.cityTime=this.clock;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float cityTime; attribute float crowdPhase; attribute float crowdMoving;').replace('#include <begin_vertex>','#include <begin_vertex>\nfloat gait=sin(cityTime*7.0+crowdPhase+step(0.0,position.x)*3.14159)*crowdMoving; transformed.z+=gait*.095*(1.0-smoothstep(.45,1.03,position.y)); transformed.y+=abs(gait)*.014;');};mat.customProgramCacheKey=()=> 'citylife-far-v1';
   const inst=new T.InstancedMesh(merged,mat,128);inst.instanceMatrix.setUsage(T.DynamicDrawUsage);inst.frustumCulled=false;inst.count=0;this.far.set(asset,inst);this.group.add(inst);
  }).catch(e=>this.fail(asset,e)).finally(()=>this.farPending.delete(asset));
 }
 handle(e:LifeEvent){
  if(e.type==='shot'&&e.from&&e.to){const geo=new T.BufferGeometry().setFromPoints([new T.Vector3(e.from.x,1.3,e.from.z),new T.Vector3(e.to.x,1.3,e.to.z)]);const line=new T.Line(geo,new T.LineBasicMaterial({color:0xffce72}));this.group.add(line);this.effects.push({object:line,ttl:.065});}
 }
 private vehicle(id:number,asset:string){
  if(this.failed.has(asset)||this.vehicles.has(id)||this.vehiclePending.has(id))return;this.vehiclePending.add(id);
  this.load(asset).then(g=>{if(this.dead||!this.core.units.has(id))return;const root=g.scene.clone(true);root.traverse(o=>{if((o as T.Mesh).isMesh)o.castShadow=true;});this.group.add(root);this.vehicles.set(id,root);}).catch(e=>this.fail(asset,e)).finally(()=>this.vehiclePending.delete(id));
 }
 update(dt:number,camera:T.Camera){
  if(this.dead)return;this.clock.value=this.core.time;camera.updateMatrixWorld();this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.projection);
  const budget=BUDGETS[this.core.quality],eye=camera.position;const visible=[...this.core.npcs.values()].filter(n=>n.state!=='treated'&&Math.hypot(n.p.x-eye.x,n.p.z-eye.z)<budget.radius&&this.frustum.intersectsSphere(new T.Sphere(new T.Vector3(n.p.x,1,n.p.z),1.2))).sort((a,b)=>Math.hypot(a.p.x-eye.x,a.p.z-eye.z)-Math.hypot(b.p.x-eye.x,b.p.z-eye.z));
  const keep=new Set<string>();const farCounts=new Map<string,number>();
  for(let index=0;index<visible.length;index++){
   const n=visible[index],asset='civilian_'+n.role,key='npc:'+n.id,close=index<budget.near&&Math.hypot(n.p.x-eye.x,n.p.z-eye.z)<24;
   if(close){keep.add(key);const a=this.actor(key,asset);if(a){const moving=n.at<n.path.length;this.pose(a,n.p,n.heading,n.hp<=0?'Idle':moving?(n.state==='flee'||n.state==='chase'?'Run':'Walk'):'Idle',dt,n.hp<=0);
     const armed=n.armed&&['draw','aim'].includes(n.state);if(armed&&!a.gun){const gun=new T.Mesh(this.gunGeo,this.gunMat);gun.name='Fictional NPC sidearm';const hand=a.root.getObjectByName('hand.R')||a.root.getObjectByName('wrist.R')||a.root.getObjectByName('wristR')||a.root.getObjectByName('handR');if(hand){hand.add(gun);gun.position.set(0,.035,.025);a.gun=gun;}}if(a.gun)a.gun.visible=armed;
    }else this.createFar(asset);
   }else{
    this.createFar(asset);const inst=this.far.get(asset);if(!inst)continue;const count=farCounts.get(asset)||0;if(count>=128)continue;
    this.dummy.position.set(n.p.x,n.hp<=0?.16:0,n.p.z);this.dummy.rotation.set(n.hp<=0?-Math.PI/2:0,n.heading,0);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();inst.setMatrixAt(count,this.dummy.matrix);(inst.geometry.getAttribute('crowdPhase')as T.InstancedBufferAttribute).setX(count,n.id*.71);(inst.geometry.getAttribute('crowdMoving')as T.InstancedBufferAttribute).setX(count,n.at<n.path.length&&n.hp>0?1:0);farCounts.set(asset,count+1);
   }
  }
  for(const [asset,inst]of this.far){inst.count=farCounts.get(asset)||0;inst.instanceMatrix.needsUpdate=true;inst.geometry.getAttribute('crowdMoving').needsUpdate=true;inst.geometry.getAttribute('crowdPhase').needsUpdate=true;}
  for(const u of this.core.units.values()){
   this.vehicle(u.id,u.kind==='medical'?'albanian_ambulance_lod1':'albanian_fire_engine');const v=this.vehicles.get(u.id);if(v){v.position.set(u.p.x,0,u.p.z);v.rotation.y=u.heading-Math.PI/2;v.traverse(o=>{if(o.name.startsWith('Wheel_'))o.rotation.z-=(u.state==='working'?0:dt*(u.kind==='medical'?9/.375:7/.51));if(o.name.startsWith('Beacon_Blue'))o.visible=(Math.floor(this.core.time*8)+(o.userData.flashGroup||0))%2===0;});}
   u.crew.forEach((c,index)=>{const key=`crew:${u.id}:${index}`;keep.add(key);const asset=u.kind==='medical'?(index?'paramedic_navy':'paramedic_red'):(index?'firefighter_operator':'firefighter_rescue');const a=this.actor(key,asset);if(a)this.pose(a,c.p,c.heading,c.state==='walk'?'Walk':'Idle',dt);});
  }
  for(const [id,v]of this.vehicles)if(!this.core.units.has(id)){v.removeFromParent();this.vehicles.delete(id);}
  for(const [key]of this.actors)if(!keep.has(key))this.release(key);
  for(const i of this.core.incidents.values()){
   if(i.kind!=='fire'||i.intensity<=0||i.status==='resolved')continue;let flame=this.fire.get(i.id);if(!flame){flame=new T.Mesh(new T.ConeGeometry(.9,2.2,7),new T.MeshBasicMaterial({color:0xff8422,transparent:true,opacity:.65,depthWrite:false}));this.fire.set(i.id,flame);this.group.add(flame);}flame.position.set(i.p.x,i.intensity*.9,i.p.z);flame.scale.setScalar(i.intensity*(.94+Math.sin(this.core.time*13)*.08));
  }
  for(const [id,f]of this.fire){const i=this.core.incidents.get(id);if(!i||i.intensity<=0||i.status==='resolved'){f.removeFromParent();f.geometry.dispose();(f.material as T.Material).dispose();this.fire.delete(id);}}
  for(const e of this.effects){e.ttl-=dt;if(e.ttl<=0){e.object.removeFromParent();const l=e.object as T.Line;l.geometry.dispose();(l.material as T.Material).dispose();}}this.effects=this.effects.filter(e=>e.ttl>0);
 }
 private disposeSource(g:GLTF){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();g.scene.traverse(o=>{const m=o as T.Mesh;if(!m.isMesh)return;geometries.add(m.geometry);for(const mat of Array.isArray(m.material)?m.material:[m.material]){materials.add(mat);for(const value of Object.values(mat))if(value instanceof T.Texture)textures.add(value);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
 dispose(){if(this.dead)return;this.dead=true;for(const key of this.actors.keys())this.release(key);for(const i of this.far.values()){i.geometry.dispose();(i.material as T.Material).dispose();}for(const g of this.sources)this.disposeSource(g);for(const f of this.fire.values()){f.geometry.dispose();(f.material as T.Material).dispose();}for(const e of this.effects){const o=e.object as T.Line;o.geometry.dispose();(o.material as T.Material).dispose();}this.gunGeo.dispose();this.gunMat.dispose();this.group.removeFromParent();this.group.clear();this.cache.clear();this.sources.clear();this.far.clear();this.vehicles.clear();}
}
