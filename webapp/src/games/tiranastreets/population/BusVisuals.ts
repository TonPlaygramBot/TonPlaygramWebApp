import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import type {State,Car,Point} from '../shared/engine.mjs';
import {disposeWeaponResources,clearWeaponInstance} from '../weaponModelResources';
type BusActor={root:T.Group;rear?:T.Object3D;passengers:T.Group;doors:T.Object3D[];wheels:T.Object3D[];driver:T.Group};
/** Shared 18 m bus asset; only the nearest buses have animated occupants. */
export class BusVisuals {
 readonly group=new T.Group();private source?:T.Group;private actors=new Map<string,BusActor>();private dead=false;
 readonly ready:Promise<void>;readonly errors:string[]=[];
 private box=new T.BoxGeometry(1,1,1);private sphere=new T.SphereGeometry(1,10,8);
 private skins=[0xbe8e70,0x9d6d4c,0xe6b997,0x795339,0xc79875,0xad7c55,0xd5a684,0xa27555].map(color=>new T.MeshStandardMaterial({color,roughness:.85}));
 private shirts=[0x245578,0x9c493b,0x2d6145,0xb28e3c,0x785781,0x414951].map(color=>new T.MeshStandardMaterial({color,roughness:.92}));
 constructor(){this.group.name='Tirana articulated transit';this.ready=new GLTFLoader().loadAsync('/assets/tirana-streets/population/tirana-articulated-bus.glb').then(g=>{if(this.dead){disposeWeaponResources([g.scene]);return;}this.source=g.scene;this.source.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});}).catch(e=>{this.errors.push(String(e));console.warn('Tirana bus asset unavailable',e);});}
 private person(face:number,shirt:number){const p=new T.Group();const body=new T.Mesh(this.box,this.shirts[shirt%6]);body.scale.set(.40,.52,.24);body.position.y=.23;const head=new T.Mesh(this.sphere,this.skins[face%8]);head.scale.set(.115+(face%3)*.008,.16,.13);head.position.set(0,.64,0);p.add(body,head);return p;}
 update(state:State,p:Point,dt:number,battery=false,firstPersonId?:string|null){
  if(this.dead||!this.source)return;
  const selected=[...state.cars,...state.traffic].filter(c=>c.model==='tirana-bus'&&(c.id===firstPersonId||Math.hypot(c.x-p.x,c.z-p.z)<(battery?150:280))).sort((a,b)=>Number(b.id===firstPersonId)-Number(a.id===firstPersonId)||Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)).slice(0,battery?4:8);
  const keep=new Set(selected.map(c=>c.id));for(const [id,a]of this.actors)if(!keep.has(id)){clearWeaponInstance(a.root);a.root.removeFromParent();this.actors.delete(id);}
  for(const car of selected){let a=this.actors.get(car.id);if(!a){const root=clone(this.source) as T.Group;root.name=car.id;const passengers=new T.Group(),driver=this.person((car.livery||0)*2,4);driver.position.set(-.64,1,-7.7);root.add(driver,passengers);
    for(const info of car.passengers||[]){const person=this.person(info.face,info.shirt),row=Math.floor(info.seat/2);person.position.set(info.seat%2?.8:-.8,1,-5.7+row*1.05);passengers.add(person);}
    const doors:T.Object3D[]=[],wheels:T.Object3D[]=[];root.traverse(o=>{if(o.name.startsWith('Door_')){o.userData.rest=o.position.clone();doors.push(o);}if(o.name.startsWith('Wheel'))wheels.push(o);});
    a={root,rear:root.getObjectByName('ArticulatedRear'),passengers,doors,wheels,driver};this.actors.set(car.id,a);this.group.add(root);
   }
   a.root.position.set(car.x,.03,car.z);a.root.rotation.y=car.heading;
   if(a.rear)a.rear.rotation.y=T.MathUtils.clamp(Math.atan2(Math.sin((car.trailerHeading??car.heading)-car.heading),Math.cos((car.trailerHeading??car.heading)-car.heading)),-.5,.5);
   a.passengers.visible=Math.hypot(car.x-p.x,car.z-p.z)<90||car.id===firstPersonId;a.driver.visible=!car.driver;
   for(const wheel of a.wheels)wheel.rotateZ(-car.speed*dt/.51);
   for(const door of a.doors){const rest=door.userData.rest as T.Vector3;door.position.z=T.MathUtils.lerp(door.position.z,rest.z+(car.doorsUntil?door.name.endsWith('_1')?.45:-.45:0),Math.min(1,dt*5));}
  }
 }
 dispose(){this.dead=true;for(const a of this.actors.values()){clearWeaponInstance(a.root);a.root.removeFromParent();}this.actors.clear();if(this.source)disposeWeaponResources([this.source]);this.box.dispose();this.sphere.dispose();for(const m of [...this.skins,...this.shirts])m.dispose();this.group.removeFromParent();}
}
