import {createWebGLRenderer} from '../tiranastreets/createWebGLRenderer';
import * as T from 'three';
import {CollectionVehicleVisuals} from '../tiranastreets/CollectionVehicleVisuals';
import {collectionVehicleFor} from '../tiranastreets/shared/vehicleCollection.mjs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {FpsCity,disposeObject} from '../tiranastreets/FpsCity';
import {attachEnhancements} from '../tirana-expansion/WorldEnhancements';
import {SharedHumans} from '../tiranastreets/street-career/SharedHumans';
import {CityAudio} from '../tiranastreets/audio';
import {CityInput} from '../tiranastreets/input';
import {cameraDistance,type NPC} from '../tiranastreets/shared/engine.mjs';
import type {ExploreSnapshot} from './types';
import {FacePanels} from './FacePanels';
import type {ExploreConnection} from './ExploreConnection';
/** Shared view over server-authoritative peaceful state. One city/camera/frame
 * loop; used from Tirana Streets and Racing Royal, not a separate fantasy map. */
export class ExploreRuntime {
  readonly scene=new T.Scene();readonly camera=new T.PerspectiveCamera(62,1,.15,1600);
  readonly audio=new CityAudio();readonly renderer:T.WebGLRenderer;readonly city=new FpsCity();readonly humans=new SharedHumans();readonly faces=new FacePanels();
  readonly collectionFleet=new CollectionVehicleVisuals();
  readonly details:ReturnType<typeof attachEnhancements>;readonly input:CityInput;
  yaw=0; pitch=.3; paused=false;
  private overlayOpen=false; private networkAvailable=false; private fps=0;
  private state:ExploreSnapshot|null=null;private shown=new Map<string,{x:number;z:number}>();private streams:Record<string,MediaStream>={};
  private cars=new Map<string,T.Group>();private templates=new Map<string,T.Group>();private requests=new Set<string>();
  private assetsReady=false;private visibleReady=false;private dead=false;private frame=0;private last=0;private observer:ResizeObserver;private target=new T.Vector3();
  constructor(private root:HTMLDivElement,private connection:ExploreConnection,private fail:(s:string)=>void,private publish:(s:{fps:number;ready:boolean;paused:boolean})=>void){
    this.renderer=createWebGLRenderer();this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;root.appendChild(this.renderer.domElement);
    this.scene.background=new T.Color('#b5cdd3');this.scene.fog=new T.Fog('#b5cdd3',400,1400);this.scene.add(new T.HemisphereLight('#d5efff','#706a4e',2.2));const sun=new T.DirectionalLight('#ffedc4',3);sun.position.set(-120,240,-100);this.scene.add(sun);
    this.scene.add(this.city.group,this.humans.group,this.collectionFleet.group);this.details=attachEnhancements(this.scene,{x:0,z:0},{profile:'fps'});this.details.bindBuildings(this.city.group,[this.city.landmarks.group]);
    this.input=new CityInput(action=>{if(action==='pause')this.pause(!this.paused);else if(['vehicle','recover'].includes(action))void connection.request('interact',{interaction:action}).catch(e=>fail(e.message));});
    this.input.setEnabled(false);
    this.observer=new ResizeObserver(()=>{const w=Math.max(1,root.clientWidth),h=Math.max(1,root.clientHeight);this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();});this.observer.observe(root);
    this.renderer.domElement.addEventListener('webglcontextlost',this.lost);window.addEventListener('blur',this.blur);document.addEventListener('visibilitychange',this.visibility);
    this.city.ready.then(()=>{if(!this.dead)this.assetsReady=true;}).catch(e=>{if(!this.dead){this.assetsReady=true;fail(`Some city decorations could not load; the base city is available. ${String(e)}`);}});this.frame=requestAnimationFrame(this.loop);
  }
  private lost=(e:Event)=>{e.preventDefault();this.pause(true);this.fail('Graphics context lost. Leave and reopen Explore.');};
  private blur=()=>this.pause(true);
  private visibility=()=>{if(document.hidden)this.pause(true);};
  private publishStatus(){this.publish({fps:this.fps,ready:this.visibleReady,paused:this.paused});}
  private syncInput(){this.input.setEnabled(this.visibleReady&&!this.paused&&!this.overlayOpen&&this.networkAvailable);}
  private stopMovement(){this.input.clear();const control=this.input.read(this.yaw,false);this.connection.controls({...control,x:0,y:0,fast:false,fire:false,brake:true});}
  pause(value:boolean){if(this.dead)return;this.paused=value;this.syncInput();this.stopMovement();this.publishStatus();}
  setOverlay(open:boolean){this.overlayOpen=open;this.syncInput();this.stopMovement();}
  setNetworkAvailable(online:boolean){this.networkAvailable=online;this.syncInput();if(!online){this.visibleReady=false;this.stopMovement();this.publishStatus();}}
  accept(snapshot:ExploreSnapshot){if(!this.state){const p=snapshot.state.players[snapshot.playerId];if(p){this.yaw=p.heading;this.target.set(p.x,1,p.z);}}this.state=snapshot;this.networkAvailable=true;}
  media(streams:Record<string,MediaStream>){this.streams=streams;this.audio.enabled=Object.keys(streams).length===0;}
  private loadCar(model:string){if(this.requests.has(model)||this.dead)return;this.requests.add(model);const safe=['sedan','sedan-sports','taxi'].includes(model)?model:'sedan';new GLTFLoader().load(`/assets/tirana-streets/${safe}.glb`,g=>{if(this.dead){disposeObject(g.scene);return;}const box=new T.Box3().setFromObject(g.scene),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),scale=4.25/size.z;if(!Number.isFinite(scale)){disposeObject(g.scene);return;}g.scene.scale.setScalar(scale);g.scene.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);const group=new T.Group();group.add(g.scene);this.templates.set(model,group);},undefined,()=>this.fail(`A city vehicle model failed to load (${safe}). Reopen Explore to retry.`));}
  private frames=0;private seconds=0;private assetErrorCount=0;
  private loop=(now:number)=>{try{this.draw(now);}catch(e){this.pause(true);this.fail(e instanceof Error?e.message:'City rendering stopped');}};
  private draw=(now:number)=>{
    if(this.dead)return;const real=this.last?Math.max(0,(now-this.last)/1000):0,dt=Math.min(.05,real);this.last=now;
    const s=this.state,p=s?.state.players[s.playerId];
    if(s&&p){
      const controls=this.input.read(this.yaw,!!p.carId);if(this.paused||this.overlayOpen||!this.networkAvailable||!this.visibleReady)Object.assign(controls,{x:0,y:0,fast:false,brake:true});this.connection.controls(controls);
      const players=s.members.flatMap(m=>{const q=s.state.players[m.id];if(!q||q.carId)return [];let pos=this.shown.get(m.id);if(!pos){pos={x:q.x,z:q.z};this.shown.set(m.id,pos);}const f=1-Math.exp(-dt*14);pos.x+=(q.x-pos.x)*f;pos.z+=(q.z-pos.z)*f;return [{...q,...pos,id:`explorer-${m.id}`,kind:'civilian',motion:'walk',weapon:null,downUntil:0,characterId:m.appearance} as NPC];});
      const ambient=s.state.npcs.filter(n=>Math.hypot(n.x-p.x,n.z-p.z)<75).slice(0,8);
      this.humans.update([...players,...ambient],p,s.state.elapsed,dt,false);
      const faces=new Set<string>();for(const m of s.members){const actor=this.humans.group.getObjectByName(`shared-npc:explorer-${m.id}`);if(actor){this.faces.update(m,actor,this.streams[m.id]);faces.add(m.id);}}this.faces.retain(faces);
      this.collectionFleet.update([...s.state.cars,...s.state.traffic],p,dt,p.carId);
      const active=new Set<string>();
      for(const car of [...s.state.cars,...s.state.traffic].filter(c=>Math.hypot(c.x-p.x,c.z-p.z)<160).slice(0,24)){
        if(collectionVehicleFor(car))continue;
        active.add(car.id);this.loadCar(car.model);let actor=this.cars.get(car.id);const source=this.templates.get(car.model);if(!actor&&source){actor=source.clone(true);this.cars.set(car.id,actor);this.scene.add(actor);actor.position.set(car.x,.03,car.z);}if(actor){actor.position.lerp(new T.Vector3(car.x,.03,car.z),1-Math.exp(-dt*14));actor.rotation.y=car.heading+Math.PI;}
      }
      for(const [id,actor] of this.cars)if(!active.has(id)){actor.removeFromParent();this.cars.delete(id);}
      this.visibleReady=this.networkAvailable&&this.assetsReady&&(p.carId?(this.cars.has(p.carId)||this.collectionFleet.has(p.carId)):this.humans.has(`explorer-${s.playerId}`));this.syncInput();
      this.target.lerp(new T.Vector3(p.x,1.3,p.z),1-Math.exp(-dt*10));const d=cameraDistance(this.target.x,this.target.z,this.target.y,this.yaw,p.carId?10:4.8,this.pitch);
      this.camera.position.copy(this.target).add(new T.Vector3(Math.sin(this.yaw)*d,1.7+this.pitch*d,Math.cos(this.yaw)*d));this.camera.lookAt(this.target);
      this.audio.update(p.speed,!!p.carId&&!this.paused);if(!this.paused)this.audio.city(s.state,p,dt);this.city.update(this.target,s.state.elapsed,false);this.details.update(s.state.elapsed,this.camera,p,false);
    }
    this.renderer.render(this.scene,this.camera);this.frames++;this.seconds+=real;if(this.seconds>=1){const assetErrors=[...this.humans.errors,...this.collectionFleet.errors.values()];if(assetErrors.length>this.assetErrorCount){this.assetErrorCount=assetErrors.length;this.fail(assetErrors.at(-1)||'A shared city asset failed');}this.fps=Math.round(this.frames/this.seconds);this.publishStatus();this.frames=0;this.seconds=0;}
    this.frame=requestAnimationFrame(this.loop);
  };
  dispose(){if(this.dead)return;this.dead=true;cancelAnimationFrame(this.frame);this.observer.disconnect();window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.visibility);this.renderer.domElement.removeEventListener('webglcontextlost',this.lost);this.input.destroy();this.audio.destroy();this.faces.dispose();this.humans.dispose();this.collectionFleet.dispose();this.details.dispose();this.city.dispose();for(const g of this.templates.values())disposeObject(g);this.cars.clear();this.shown.clear();this.renderer.dispose();this.renderer.domElement.remove();}
}
