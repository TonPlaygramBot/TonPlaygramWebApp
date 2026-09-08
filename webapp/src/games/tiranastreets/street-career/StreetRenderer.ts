import {CityRenderer} from '../renderer';
import type {State} from '../shared/engine.mjs';
import {attachEnhancements} from '../../tirana-expansion/WorldEnhancements';
import {SharedHumans} from './SharedHumans';
import {nearbyHumans} from './humanRoster.mjs';
/** Local career only. Reuses the original driving renderer and the newer shared
 * city details without editing map coordinates, physics or paid-match actors. */
export class StreetRenderer extends CityRenderer {
  readonly humans=new SharedHumans();
  readonly details:ReturnType<typeof attachEnhancements>;
  constructor(root:HTMLDivElement){super(root);this.scene.add(this.humans.group);this.details=attachEnhancements(this.scene);this.details.bindBuildings(this.scene,[this.nativeLandmarks.group,this.humans.group]);}
  override render(state:State|null,id:string,dt:number,lobby:boolean){
    if(this.disposed)return;
    const p=state?.players[id];
    if(state&&p)this.humans.update(state.npcs,p,state.elapsed,dt,this.quality==='battery');
    this.details.update(state?.elapsed||0,this.camera,p,this.quality==='battery');
    // Renderer-only view: authoritative/local simulation retains every real NPC.
    const visible=state&&p?nearbyHumans(state.npcs,p,this.quality==='battery'):[];
    super.render(state?{...state,npcs:visible.filter(n=>!this.humans.has(n.id))}:null,id,dt,lobby);
  }
  override destroy(){if(this.disposed)return;this.humans.dispose();this.details.dispose();super.destroy();}
}
