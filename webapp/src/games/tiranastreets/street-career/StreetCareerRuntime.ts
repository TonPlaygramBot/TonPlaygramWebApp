import {createState,advanceState,control,interact,navigation,emptyInput,MISSIONS,FREE_ROAM,type State,type Point} from '../shared/engine.mjs';
import {WEAPONS,STARTER_WEAPON} from '../shared/weapons.mjs';
import {collideDetailPosts} from '../../tirana-street-detail/sharedRoadDetails.mjs';
import {CityInput} from '../input';
import {CityAudio} from '../audio';
import {StreetRenderer} from './StreetRenderer';
import {createCampaign,type StreetProfile,type StoragePort} from './campaignCore.mjs';
export const campaign=createCampaign(MISSIONS,WEAPONS,STARTER_WEAPON);
export type StreetView={profile:StreetProfile;state:State;paused:boolean;ready:boolean;route:Point[];fps:number;storageOK:boolean;assetErrors:string[]};
/** Original solo campaign over the existing drive/combat simulation. No transport,
 * account profile, paid balance, server clock or multiplayer room is modified. */
export class StreetCareerRuntime {
  readonly renderer:StreetRenderer;readonly input:CityInput;readonly audio=new CityAudio();
  state=createState([{id:'local',name:'You'}],FREE_ROAM.id,'solo');
  profile:StreetProfile;paused=true;ready=false;route:Point[]=[];
  private disposed=false;private raf=0;private last=0;private uiAt=0;private routeAt=-Infinity;private saveAt=0;private storageOK=true;
  constructor(root:HTMLDivElement,private publish:(view:StreetView)=>void,private storage?:StoragePort,private openPanel:(panel:'journal'|'arsenal')=>void=()=>{}){
    this.profile=campaign.load(storage);this.renderer=new StreetRenderer(root);
    this.input=new CityInput(action=>{if(action==='pause'){this.pause();this.openPanel('journal');}else if(action==='arsenal'){this.pause();this.openPanel('arsenal');}else this.action(action);});
    this.input.setEnabled(false);campaign.apply(this.state.players.local,this.profile.loadout);
    if(this.profile.active)this.newRun(this.profile.active.id,this.profile.active.difficulty);
    window.addEventListener('blur',this.blur);window.addEventListener('pagehide',this.blur);document.addEventListener('visibilitychange',this.visibility);
    this.renderer.renderer.domElement.addEventListener('webglcontextlost',this.contextLost);
    this.emit();this.raf=requestAnimationFrame(this.loop);
  }
  async load(progress:(message:string)=>void){await this.renderer.load(progress);if(this.disposed)return;this.ready=true;this.emit();}
  private blur=()=>{this.pause();this.openPanel('journal');};
  private visibility=()=>{if(document.hidden)this.blur();};
  private contextLost=(e:Event)=>{e.preventDefault();this.pause();this.ready=false;this.renderer.humans.errors.push('Graphics context lost. Exit and reopen Tirana Streets.');this.emit();};
  private snapshot(){if(this.state.missionId===FREE_ROAM.id)this.profile=campaign.saveExplore(this.profile,this.state.players.local);}
  private persist(){this.snapshot();this.storageOK=campaign.save(this.storage,this.profile);}
  private newRun(id:string,difficulty:string){
    this.state=createState([{id:'local',name:'You'}],id,'solo',this.profile.completed.length>=3,difficulty);
    campaign.apply(this.state.players.local,this.profile.active?.checkpoint||this.profile.loadout);
    this.route=[];this.renderer.setRoute([]);this.renderer.yaw=this.state.players.local.heading;this.routeAt=-Infinity;
  }
  start(id:string,difficulty='normal'){
    if(!this.ready||this.disposed)return false;this.snapshot();
    const next=campaign.begin(this.profile,id,difficulty);if(!next)return false;
    this.profile=next;this.newRun(id,difficulty);this.persist();this.resume();return true;
  }
  retry(){const active=this.profile.active;if(!active||!this.ready)return false;this.newRun(active.id,active.difficulty);this.resume();return true;}
  explore(){if(!this.ready)return;this.snapshot();this.profile=campaign.abandon(this.profile);this.newRun(FREE_ROAM.id,'normal');this.persist();this.resume();}
  resume(){if(!this.ready||this.disposed||this.state.phase==='finished')return;this.paused=false;this.input.clear();this.input.setEnabled(true);void this.audio.unlock().catch(()=>{});this.emit();}
  pause(){if(this.disposed)return;this.paused=true;this.input.setEnabled(false);control(this.state,'local',emptyInput());this.audio.update(0,false);this.persist();this.emit();}
  action(action:string){
    if(this.disposed||!this.ready)return;
    // Only inventory actions are allowed while a local menu pauses the world.
    if(this.paused&&!/^(buy:|equip:|holster$)/.test(action))return;
    interact(this.state,'local',action);if(this.state.missionId===FREE_ROAM.id)this.persist();this.emit();
  }
  private stepSimulation(dt:number){
    const p=this.state.players.local;advanceState(this.state,dt);
    const car=p.carId?this.state.cars.find(c=>c.id===p.carId):undefined;
    if(collideDetailPosts(car||p,car?1.35:.34)){
      if(car){car.speed*=.45;car.vx*=.3;car.vz*=.3;p.x=car.x;p.z=car.z;p.speed=car.speed;}else p.speed=0;
    }
    for(const n of this.state.npcs)if(n.motion!=='drive')collideDetailPosts(n,.34);
  }
  private loop=(now:number)=>{
    if(this.disposed)return;const dt=this.last?Math.min(.1,Math.max(0,(now-this.last)/1000)):0;this.last=now;
    const p=this.state.players.local;
    if(!this.paused&&this.ready){
      control(this.state,'local',this.input.read(this.renderer.yaw,!!p.carId));
      // Match the simulation's fixed substeps so a fast car cannot tunnel through
      // the same concrete-post envelope rendered by the shared detail layer.
      for(let remaining=dt;remaining>0;){const step=Math.min(1/60,remaining);this.stepSimulation(step);remaining-=step;}
      if(this.state.phase==='finished'){
        const complete=campaign.resolve(this.profile,this.state,'local');
        if(complete){this.profile=complete;campaign.apply(p,this.profile.loadout);this.audio.cue(true);}
        this.pause();this.openPanel('journal');
      }
      if(!this.paused){this.audio.update(p.speed,!!p.carId);this.audio.city(this.state,p,dt);}
      if(now-this.routeAt>750){this.route=navigation(this.state,'local');this.renderer.setRoute(this.route);this.routeAt=now;}
    }
    this.renderer.render(this.state,'local',this.paused?0:dt,false);
    if(now-this.saveAt>5000){this.persist();this.saveAt=now;}
    if(now-this.uiAt>125){this.emit();this.uiAt=now;}
    this.raf=requestAnimationFrame(this.loop);
  };
  private emit(){this.publish({profile:this.profile,state:this.state,paused:this.paused,ready:this.ready,route:this.route,fps:this.renderer.fps,storageOK:this.storageOK,assetErrors:[...this.renderer.humans.errors,...this.renderer.details.civic.errors,...this.renderer.details.dajti.errors]});}
  dispose(){if(this.disposed)return;this.persist();this.disposed=true;cancelAnimationFrame(this.raf);window.removeEventListener('blur',this.blur);window.removeEventListener('pagehide',this.blur);document.removeEventListener('visibilitychange',this.visibility);this.renderer.renderer.domElement.removeEventListener('webglcontextlost',this.contextLost);this.input.destroy();this.audio.destroy();this.renderer.destroy();}
}
