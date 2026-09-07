import * as T from 'three';
import {makeCityWorld} from '../../blackwater/cityWorld';
import {GameInput} from '../../blackwater/input';
import {GameAudio} from '../../blackwater/audio';
import {CompatibilityRenderer} from '../../blackwater/compatibility';
import {collides,moveCircle,lineClear,type Obstacle} from '../../blackwater/core';
import {START,ORIGIN} from '../../blackwater/shared/layout.mjs';
import {WORLD} from '../shared/world.mjs';
import {buildMapGraph,findMapRoute} from '../map/mapCore.mjs';
import {CHAPTERS,currentStep,advanceCareer,startChapter,loadCareer,saveCareer,accessPoint,type Profile} from './careerCore.mjs';
import {civicSites,cablePose} from '../../tirana-expansion/geography.mjs';
import {attachEnhancements} from '../../tirana-expansion/WorldEnhancements';
import {ExistingHumans} from '../../tirana-expansion/ExistingHumans';

type Point={x:number;z:number};
export type CareerView={profile:Profile;player:Point&{heading:number};paused:boolean;ride:boolean;rideProgress:number;distance:number;route:Point[];routeNotice:string;storageOK:boolean;assetErrors:string[];fps:number;blocked:string[]};
/** Solo-only runtime assembled from the same city, collision, input and audio
 * modules. The operation runtime is unmounted before this one is constructed. */
export class CareerRuntime {
 readonly scene=new T.Scene();readonly camera=new T.PerspectiveCamera(70,1,.15,18000);
 readonly renderer:T.WebGLRenderer;readonly world:ReturnType<typeof makeCityWorld>;readonly input:GameInput;
 readonly audio=new GameAudio();readonly extras:ReturnType<typeof attachEnhancements>;readonly humans:ExistingHumans;
 profile:Profile;player={...START};yaw=0;pitch=0;paused=true;ride=false;rideElapsed=0;
 private points=new Map<string,Point>();private talkTargets=new Map<string,Point>();private contactBodies=new Map<string,Obstacle>();private contactIds=new Set<string>();private graph=buildMapGraph(WORLD,'walk');
 private route:Point[]=[];private routeNotice='';private lastTarget='';private routeAt=0;private saveAt=0;private storageOK=true;
 private line=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:0xd8f775,depthTest:true}));
 private marker=new T.Mesh(new T.TorusGeometry(1,.06,6,32),new T.MeshBasicMaterial({color:0xf0d398}));
 private observer:ResizeObserver;private raf=0;private last=0;private accumulator=0;private uiAt=0;private disposed=false;
 private footstepAt=0;private rideYaw=0;private fps=60;private counted=0;private countedTime=0;
 constructor(canvas:HTMLCanvasElement,surface:HTMLElement,private publish:(v:CareerView)=>void,private storage?:Storage){
  this.profile=loadCareer(storage);
  try{this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch{this.renderer=new CompatibilityRenderer(canvas) as unknown as T.WebGLRenderer;}
  this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
  this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.world=makeCityWorld(this.scene,this.camera,this.renderer);this.world.gun.visible=false;this.world.extraction.visible=false;
  this.extras=attachEnhancements(this.scene,ORIGIN);
  const anchors=new Map<string,Point>(WORLD.landmarks.map(l=>[l.id,{x:l.x,z:l.z}]));
  for(const site of civicSites(WORLD))anchors.set(site.id,site);
  for(const [id,anchor] of anchors){
   const point=accessPoint(WORLD,anchor,p=>!collides(p.x-ORIGIN.x,p.z-ORIGIN.z,.65,this.world.obstacles));
   if(point)this.points.set(id,point);
  }
  const contacts=[...new Set(CHAPTERS.flatMap(c=>c.steps.filter(s=>s.action==='talk').map(s=>s.place)))].flatMap(id=>{
   const p=this.points.get(id);if(!p)return [];
   for(let i=0;i<8;i++){const a=i*Math.PI/4,x=p.x-ORIGIN.x+Math.cos(a)*1.8,z=p.z-ORIGIN.z+Math.sin(a)*1.8;
    if(!collides(x,z,.7,this.world.obstacles)&&Math.hypot(x-START.x,z-START.z)>1.8)return [{id,x,z}];}
   return [];
  });
  this.contactIds=new Set(contacts.map(p=>p.id));this.humans=new ExistingHumans(contacts);this.scene.add(this.humans.group);
  // Contact collision is private to this solo runtime. Server/map datasets stay untouched.
  for(const p of contacts){this.talkTargets.set(p.id,{x:p.x+ORIGIN.x,z:p.z+ORIGIN.z});this.contactBodies.set(p.id,{x:p.x,z:p.z,w:.65,d:.65,h:1.8});}
  // Collision indexing caches by array identity: do not mutate the indexed array.
  this.world.obstacles=[...this.world.obstacles,...this.contactBodies.values()];
  this.input=new GameInput(surface);this.input.onLook=(dx,dy)=>{if(this.paused)return;if(this.ride)this.rideYaw-=dx*.003;else this.yaw-=dx*.003;this.pitch=T.MathUtils.clamp(this.pitch-dy*.003,-.9,.8);};
  this.input.onPause=()=>this.pause();this.input.onHeal=()=>this.interact();
  this.marker.rotation.x=-Math.PI/2;this.marker.visible=false;this.scene.add(this.line,this.marker);
  this.observer=new ResizeObserver(()=>{const r=surface.getBoundingClientRect();this.renderer.setSize(r.width,Math.max(r.height,1),false);this.camera.aspect=r.width/Math.max(r.height,1);this.camera.updateProjectionMatrix();});this.observer.observe(surface);
  this.camera.position.set(this.player.x,1.68,this.player.z);this.persist();this.emit();
  canvas.addEventListener('webglcontextlost',this.contextLost);this.raf=requestAnimationFrame(this.loop);
 }
 private contextLost=(e:Event)=>{e.preventDefault();this.pause();this.extras.dajti.errors.push('Graphics context lost. Return to Games and reopen.');this.emit();};
 private pointForStep(){const step=currentStep(this.profile);return step?(step.action==='talk'?this.talkTargets.get(step.place):this.points.get(step.action==='ride'?'clock':step.place)):undefined;}
 private persist(){this.storageOK=saveCareer(this.storage,this.profile);}
 select(id:string){
  if(!CHAPTERS.some(c=>c.id===id&&c.steps.every(s=>s.action==='ride'||this.points.has(s.place)&&(s.action!=='talk'||this.contactIds.has(s.place)))))return;
  this.profile=startChapter(this.profile,id);this.lastTarget='';this.persist();this.resume();
 }
 pause(){this.paused=true;this.input.active=false;this.input.clear();this.audio.suspend();if(document.pointerLockElement)document.exitPointerLock();this.persist();this.emit();}
 freeExplore(){if(this.profile.active?.status==='failed')this.profile={...this.profile,active:null};this.resume();}
 resume(){this.paused=false;this.input.active=true;this.input.clear();this.audio.start();this.emit();}
 cancel(){this.ride=false;this.rideElapsed=0;this.extras.dajti.setTour(false);this.profile={...this.profile,active:null};this.lastTarget='';this.persist();this.pause();}
 private tick(dt:number){
  if(this.paused)return;
  if(this.ride){
   this.profile=advanceCareer(this.profile,{type:'tick',dt,paused:false});
   this.rideElapsed=Math.min(90,this.rideElapsed+dt);
   if(this.rideElapsed>=90){this.profile=advanceCareer(this.profile,{type:'interact',place:'dajti-upper',action:'ride',completedJourney:true});this.ride=false;this.rideElapsed=0;this.extras.dajti.setTour(false);this.pitch=0;this.persist();this.pause();}
   return;
  }
  const k=this.input.keys;
  let x=this.input.move.x+Number(k.has('KeyD')||k.has('ArrowRight'))-Number(k.has('KeyA')||k.has('ArrowLeft'));
  let y=this.input.move.y+Number(k.has('KeyW')||k.has('ArrowUp'))-Number(k.has('KeyS')||k.has('ArrowDown'));
  const n=Math.max(1,Math.hypot(x,y));x/=n;y/=n;
  const speed=k.has('ShiftLeft')||k.has('ShiftRight')?5.4:3.2,c=Math.cos(this.yaw),s=Math.sin(this.yaw);
  moveCircle(this.player,(x*c-y*s)*speed*dt,(-x*s-y*c)*speed*dt,.34,this.world.obstacles);
  if(Math.hypot(x,y)>.1){this.footstepAt+=dt;if(this.footstepAt>.42){this.audio.step();this.footstepAt=0;}}
  this.profile=advanceCareer(this.profile,{type:'tick',dt,paused:false});
  if(this.profile.active?.status==='failed')this.pause();
 }
 interact(){
  if(this.paused||this.ride)return;
  const step=currentStep(this.profile),p=this.pointForStep();if(!step||!p)return;
  const distance=Math.hypot(this.player.x+ORIGIN.x-p.x,this.player.z+ORIGIN.z-p.z);
  const target=new T.Vector3(p.x-ORIGIN.x,1.65,p.z-ORIGIN.z);
  // Ignore only the contact's tiny body for talking; real buildings still block.
  const body=step.action==='talk'?this.contactBodies.get(step.place):undefined;
  const visible=lineClear(this.camera.position,target,this.world.obstacles.filter(o=>o!==body));
  if(distance>4||!visible)return;
  if(step.action==='talk'&&!this.humans.loadedIds.has(step.place)){this.routeNotice='The existing glTF contact model is loading or unavailable. Check asset status.';this.emit();return;}
  if(step.action==='ride'){
   if(!this.extras.dajti.cabins.length){this.routeNotice='Cable-car glTF is still loading or failed. See asset status.';this.emit();return;}
   this.ride=true;this.rideElapsed=0;this.rideYaw=0;this.pitch=-.16;this.extras.dajti.setTour(true);this.extras.dajti.journey(0);this.input.clear();this.line.visible=false;this.emit();return;
  }
  const before=this.profile;this.profile=advanceCareer(this.profile,{type:'interact',place:step.place,action:step.action,distance,lineOfSight:visible});
  if(before!==this.profile){this.persist();this.lastTarget='';this.audio.burst(.06,750,.02);if(!this.profile.active)this.pause();this.emit();}
 }
 private updateRoute(now:number){
  if(this.ride)return;
  const step=currentStep(this.profile),target=this.pointForStep(),key=step?`${this.profile.active?.id}:${step.place}`:'';
  if(now-this.routeAt<1000&&key===this.lastTarget)return;
  this.routeAt=now;this.lastTarget=key;this.marker.visible=!!target;
  if(target){
   this.marker.position.set(target.x-ORIGIN.x,.18,target.z-ORIGIN.z);
   const result=findMapRoute(this.graph,{x:this.player.x+ORIGIN.x,z:this.player.z+ORIGIN.z},target);this.route=result.points;this.routeNotice=result.message;
  }else{this.route=[];this.routeNotice=step?'This mission access point is unavailable in the current map.':'';}
  const geo=new T.BufferGeometry().setFromPoints(this.route.map(p=>new T.Vector3(p.x-ORIGIN.x,.21,p.z-ORIGIN.z)));this.line.geometry.dispose();this.line.geometry=geo;this.line.visible=this.route.length>1;
 }
 private loop=(now:number)=>{
  if(this.disposed)return;const real=this.last?(now-this.last)/1000:1/60,dt=Math.min(.1,Math.max(0,real));this.last=now;
  this.counted++;this.countedTime+=real;if(this.countedTime>=1){this.fps=Math.round(this.counted/this.countedTime);this.counted=0;this.countedTime=0;}
  if(!this.paused){this.accumulator+=dt;for(let steps=0;this.accumulator>=1/60&&steps<6;steps++){this.tick(1/60);this.accumulator-=1/60;}}else this.accumulator=0;
  if(this.ride){this.extras.dajti.journey(this.rideElapsed/90);const p=cablePose(this.extras.dajti.path,this.rideElapsed/90);this.camera.position.set(p.x-ORIGIN.x,p.y-1.6,p.z-ORIGIN.z);this.camera.rotation.set(this.pitch,p.yaw+this.rideYaw,0,'YXZ');}
  else{this.camera.position.set(this.player.x,1.68,this.player.z);this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');}
  this.world.update?.(this.camera.position);this.world.sky.position.copy(this.camera.position);this.humans.update(this.paused?0:dt,this.camera.position);
  this.updateRoute(now);this.renderer.render(this.scene,this.camera);
  if(now-this.saveAt>5000){this.persist();this.saveAt=now;}
  if(now-this.uiAt>150){this.emit();this.uiAt=now;}this.raf=requestAnimationFrame(this.loop);
 };
 private emit(){
  const target=this.pointForStep();this.publish({profile:this.profile,player:{x:this.camera.position.x+ORIGIN.x,z:this.camera.position.z+ORIGIN.z,heading:this.yaw},paused:this.paused,ride:this.ride,rideProgress:this.rideElapsed/90,distance:target?Math.hypot(this.player.x+ORIGIN.x-target.x,this.player.z+ORIGIN.z-target.z):Infinity,route:this.route,routeNotice:this.routeNotice,storageOK:this.storageOK,assetErrors:[...this.humans.errors,...this.extras.civic.errors,...this.extras.dajti.errors],fps:this.fps,blocked:CHAPTERS.filter(c=>c.steps.some(s=>s.action!=='ride'&&(!this.points.has(s.place)||s.action==='talk'&&!this.contactIds.has(s.place)))).map(c=>c.id)});
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.persist();cancelAnimationFrame(this.raf);this.observer.disconnect();this.input.dispose();this.audio.dispose();this.humans.dispose();this.renderer.domElement.removeEventListener('webglcontextlost',this.contextLost);this.line.removeFromParent();this.line.geometry.dispose();(this.line.material as T.Material).dispose();this.marker.removeFromParent();this.marker.geometry.dispose();(this.marker.material as T.Material).dispose();this.world.dispose();this.renderer.dispose();}
}
