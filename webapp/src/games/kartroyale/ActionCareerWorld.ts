import * as T from 'three';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {normalizePlayableHuman} from '../tiranastreets/street-career/humanoidRig.mjs';
import {HumanoidAnimation} from '../tiranastreets/street-career/humanoidAnimation.mjs';
import {LivingVisuals} from '../tiranastreets/livingVisuals';
import type {NPC} from '../tiranastreets/shared/engine.mjs';
import type {ActionCareerState} from './actionCareer.mjs';
import type {Racer} from './simulation.mjs';

type Human={root:T.Group;model:T.Group;animation:HumanoidAnimation;badge?:T.Mesh;materials:T.Material[]};

/** The same loaded Turi skin used by kart drivers supplies the full-size foot
 * player and opponents. Geometry and original PBR textures remain source-owned;
 * skeletons, material instances and effects belong to this mission only. */
export class ActionCareerWorld {
 readonly group=new T.Group();
 private player:Human;
 private enemies=new Map<string,Human>();
 private source:T.Group;
 private weapons=new LivingVisuals(false);
 private ring:T.Mesh;
 private beacon:T.Mesh;
 private warning:T.InstancedMesh;
 private traces:T.LineSegments;
 private bullets:T.InstancedMesh;
 private transform=new T.Object3D();
 private firstPerson=false;
 private disposed=false;
 constructor(source:T.Group){
  this.source=source;this.group.name='Racing Royal action career';this.player=this.human('Turi on foot',false);this.group.add(this.player.root);
  const cyan=new T.MeshBasicMaterial({color:'#74edff',transparent:true,opacity:.8,depthWrite:false});
  this.ring=new T.Mesh(new T.RingGeometry(2.45,2.7,40).rotateX(-Math.PI/2),cyan);
  this.beacon=new T.Mesh(new T.CylinderGeometry(.1,.1,4,6),new T.MeshBasicMaterial({color:'#74edff',transparent:true,opacity:.35,depthWrite:false}));
  this.warning=new T.InstancedMesh(new T.RingGeometry(.65,.82,24).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'#ff5158',transparent:true,opacity:.9,depthWrite:false}),8);this.warning.frustumCulled=false;
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(16*6),3));
  this.traces=new T.LineSegments(geometry,new T.LineBasicMaterial({color:'#ffe293',transparent:true,opacity:.95}));this.traces.frustumCulled=false;
  this.bullets=new T.InstancedMesh(new T.SphereGeometry(.1,6,4),new T.MeshBasicMaterial({color:'#ff5e42'}),20);this.bullets.frustumCulled=false;
  this.warning.count=0;this.bullets.count=0;this.traces.geometry.setDrawRange(0,0);
  this.group.add(this.ring,this.beacon,this.warning,this.traces,this.bullets);
 }
 private human(name:string,enemy:boolean):Human{
  const root=new T.Group(),model=normalizePlayableHuman(clone(this.source),1.76) as T.Group,materials:T.Material[]=[];
  root.name=name;root.userData.rigPoseOwner='racing-action';root.add(model);
  model.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=o.receiveShadow=true;o.frustumCulled=false;const copies=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const copy=m.clone();materials.push(copy);return copy;});o.material=Array.isArray(o.material)?copies:copies[0];}});
  let badge:T.Mesh|undefined;
  if(enemy){badge=new T.Mesh(new T.OctahedronGeometry(.18),new T.MeshBasicMaterial({color:'#ff5158'}));badge.position.y=2.05;root.add(badge);}
  return {root,model,animation:new HumanoidAnimation(root,model),badge,materials};
 }
 setFirstPerson(value:boolean){this.firstPerson=value;}
 update(state:ActionCareerState,racer:Racer,dt:number){
  if(this.disposed)return;
  const a=state.actor,time=state.elapsed;
  this.player.root.visible=state.mode==='onfoot'&&!this.firstPerson;
  this.player.root.position.set(a.x,a.groundY+a.jumpHeight+.03,a.z);this.player.root.rotation.set(0,a.yaw,0);
  const n={id:'racing-player',kind:'gang',downUntil:0,x:a.x,z:a.z,y:a.groundY+a.jumpHeight,heading:a.yaw+Math.PI,health:a.health,speed:a.speed,weapon:'assaultRifleAttack',motion:'walk',anim:state.reload>0?'reload':'aim',firedAt:state.firedAt,reloadAt:state.reload>0?time+state.reload:0} as NPC;
  if(state.mode==='onfoot'){this.player.animation.update(n,time,dt,a.speed);this.weapons.pose(n.id,this.player.root,n,time);}
  for(const e of state.enemies){
   let human=this.enemies.get(e.id);if(!human){human=this.human(`Rival ${e.id}`,true);this.enemies.set(e.id,human);this.group.add(human.root);}
   const active=e.health>0;
   human.root.position.set(e.x,e.groundY+.03,e.z);human.root.rotation.set(active?0:-Math.PI/2,e.yaw,0);if(human.badge)human.badge.visible=active;
   // Defeated rivals lie down with no gore. Their original texture stays intact.
   if(active){const enemy={...n,id:e.id,x:e.x,z:e.z,y:e.groundY,heading:e.yaw+Math.PI,health:e.health,speed:0,firedAt:e.firedAt,reloadAt:0,anim:'aim'} as NPC;human.animation.update(enemy,time,dt,0);this.weapons.pose(e.id,human.root,enemy,time);}else this.weapons.forget(e.id);
  }
  const target=state.stage==='drive'?state.park:state.stage==='return'?{x:racer.x,z:racer.z,groundY:racer.groundY||0}:state.stage==='extract'?state.extraction:state.package;
  this.ring.position.set(target.x,target.groundY+.12,target.z);this.beacon.position.set(target.x,target.groundY+2.1,target.z);this.ring.visible=this.beacon.visible=state.status==='active'&&state.stage!=='clear';
  let count=0;
  for(const e of state.enemies){if(e.health<=0||e.warning<=0||count>=8)continue;this.transform.position.set(e.aimX,a.groundY+.11,e.aimZ);const size=1+.18*Math.sin(time*20);this.transform.scale.setScalar(size);this.transform.updateMatrix();this.warning.setMatrixAt(count++,this.transform.matrix);}
  this.warning.count=count;this.warning.instanceMatrix.needsUpdate=true;
  const positions=this.traces.geometry.getAttribute('position') as T.BufferAttribute;count=0;
  for(const shot of state.shots.slice(-16)){positions.setXYZ(count*2,shot.x,shot.y,shot.z);positions.setXYZ(count*2+1,shot.toX,shot.toY,shot.toZ);count++;}
  this.traces.geometry.setDrawRange(0,count*2);positions.needsUpdate=true;
  count=0;for(const p of state.projectiles.slice(-20)){this.transform.position.set(p.x,p.y,p.z);this.transform.scale.setScalar(1);this.transform.updateMatrix();this.bullets.setMatrixAt(count++,this.transform.matrix);}
  this.bullets.count=count;this.bullets.instanceMatrix.needsUpdate=true;
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;
  // Remove first: the host's world teardown must not walk shared Turi geometry.
  this.group.removeFromParent();this.weapons.dispose();
  for(const human of [this.player,...this.enemies.values()]){
   human.animation.dispose();const skeletons=new Set<T.Skeleton>();human.model.traverse(o=>{if(o instanceof T.SkinnedMesh)skeletons.add(o.skeleton);});for(const s of skeletons)s.dispose();for(const m of human.materials)m.dispose();
   if(human.badge){human.badge.geometry.dispose();(human.badge.material as T.Material).dispose();}
  }
  const materials=new Set<T.Material>();for(const mesh of [this.ring,this.beacon,this.warning,this.traces,this.bullets]){mesh.geometry.dispose();for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(m);}for(const m of materials)m.dispose();
  this.warning.dispose();this.bullets.dispose();
  this.enemies.clear();this.group.clear();
 }
}
