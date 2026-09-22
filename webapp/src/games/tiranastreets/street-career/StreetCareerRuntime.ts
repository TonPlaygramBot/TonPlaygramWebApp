import {groundHeight} from '../../tirana-east/terrainCore.mjs';
import {POLICE_STATION} from './ArrestSimulation.mjs';
import {
  createState,
  navigation,
  MISSIONS,
  FREE_ROAM,
  interact,
  type State,
  type Point
} from '../shared/engine.mjs';
import { WEAPONS, WEAPON_BY_ID, STARTER_WEAPON, ensureStarterWeapons } from '../shared/weapons.mjs';
import {loadWeaponStoreAccount} from '../weaponStoreApi';
import {applyStartingLoadout,selectedStartingLoadout} from '../startingLoadout.mjs';
import { collideDetailPosts } from '../../tirana-street-detail/sharedRoadDetails.mjs';
import { CityAudio } from '../audio';
import { StreetRenderer } from './StreetRenderer';
import { StreetInput } from './StreetInput';
import {
  StreetSimulation,
  type StreetAction,
  type BodyState
} from './StreetSimulation.mjs';
import { captureCheckpoint, restoreCheckpoint } from './checkpointCore.mjs';
import { loadSettings, type StreetSettings } from './settings';
import {FramePacer} from '../renderSettings';
import {WORLD} from '../shared/world.mjs';
import {PoliceCareerController, type PoliceView} from './PoliceCareerController.mjs';
import {POLICE_SAVE_KEY,POLICE_UNITS,normalizePoliceProfile,beginPoliceMission,settlePoliceMission,type PoliceProfile} from './policeCareerCore.mjs';
import {buildMapGraph,findMapRoute} from '../map/mapCore.mjs';
type Destination = Point & {name:string;id?:string;available?:boolean};
import {
  createCampaign,
  type StreetProfile,
  type StoragePort
} from './campaignCore.mjs';
export const campaign = createCampaign(MISSIONS, WEAPONS, STARTER_WEAPON);
export type StreetView = {
  profile: StreetProfile;
  policeProfile: PoliceProfile;
  police: PoliceView | null;
  state: State;
  paused: boolean;
  ready: boolean;
  graphicsError: string;
  route: Point[];
  destination: Destination | null;
  routeNotice: string;
  fps: number;
  storageOK: boolean;
  assetErrors: string[];
  actions: StreetAction[];
  body: BodyState;
  objective: ReturnType<StreetSimulation['objective']>;
  settings: StreetSettings;
  metrics: StreetRenderer['metrics'];
};
/** Local-only career. The shared engine still owns cars, city AI and settlement;
 * its optional player adapter supplies this mode's full-body 3D rules. */
export class StreetCareerRuntime {
  private renderPacer = new FramePacer();
  private renderDelta = 0;
  readonly renderer: StreetRenderer;
  readonly input: StreetInput;
  readonly audio = new CityAudio();
  state = createState([{ id: 'local', name: 'You' }], FREE_ROAM.id, 'solo');
  simulation = new StreetSimulation(this.state);
  settings: StreetSettings;
  profile: StreetProfile;
  policeProfile: PoliceProfile;
  police: PoliceCareerController | null = null;
  paused = true;
  ready = false;
  graphicsError = '';
  route: Point[] = [];
  destination: Destination | null = null;
  routeNotice = '';
  private mapGraphs=new Map<string,ReturnType<typeof buildMapGraph>>();
  setDestination(place: Destination | null) {
    this.destination = place;
    this.routeAt = -Infinity;
    this.updateNavigation();
    this.emit();
  }
  private updateNavigation() {
    const p = this.state.players.local;
    if(this.destination) {
      const mode=p.carId?'drive':'walk';
      let graph=this.mapGraphs.get(mode);if(!graph){graph=buildMapGraph(WORLD,mode);this.mapGraphs.set(mode,graph);}
      const result = p.aircraftId?{points:[p,this.destination],message:'Direct flight to destination.'}:findMapRoute(graph,p,this.destination);
      this.route = result.points;
      this.routeNotice = result.message;
    } else if(this.police?.target()) {
      const target=this.police.target()!,mode=p.carId?'drive':'walk';
      let graph=this.mapGraphs.get(mode);if(!graph){graph=buildMapGraph(WORLD,mode);this.mapGraphs.set(mode,graph);}
      const result=findMapRoute(graph,p,target);this.route=result.points;this.routeNotice=result.message;
    } else {
      const mission = MISSIONS.find(m=>m.id===this.state.missionId);
      const aircraft = mission?.aircraft && this.simulation.flight.aircraft.find(a=>a.kind===mission.aircraft);
      this.route = aircraft && !p.aircraftId ? [p,this.simulation.flight.access(aircraft)] : navigation(this.state,'local');
      this.routeNotice = '';
    }
    this.renderer.setRoute(this.route);
  }
  private ownedWeapons = new Set<string>();
  private disposed = false;
  private raf = 0;
  private last = 0;
  private accumulator = 0;
  private uiAt = 0;
  private routeAt = -Infinity;
  private saveAt = 0;
  private storageOK = true;
  private eventAt = 0;
  constructor(
    root: HTMLDivElement,
    private publish: (view: StreetView) => void,
    private storage?: StoragePort,
    private openPanel: (panel: 'journal' | 'arsenal') => void = () => {}
  ) {
    this.profile = campaign.load(storage);
    try { this.policeProfile=normalizePoliceProfile(JSON.parse(storage?.getItem(POLICE_SAVE_KEY)||'null')); }
    catch { this.policeProfile=normalizePoliceProfile(null); }
    this.settings = loadSettings(storage);
    this.audio.volume = this.settings.volume;
    this.audio.enabled = this.settings.volume > 0;
    this.renderer = new StreetRenderer(root);
    this.renderer.settings = this.settings;
    this.renderer.setQuality(this.settings.quality);
    this.renderer.targetFps = this.settings.targetFps;
    this.input = new StreetInput(
      (action) => {
        if (action === 'pause') {
          this.pause();
          this.openPanel('journal');
        } else if (action === 'arsenal') {
          this.pause();
          this.openPanel('arsenal');
        } else this.action(action);
      },
      (dx, dy) => this.renderer.orbit(dx, dy)
    );
    this.input.setEnabled(false);
    campaign.apply(this.state.players.local, this.profile.loadout);
    ensureStarterWeapons(this.state.players.local);
    applyStartingLoadout(this.state.players.local,undefined,!this.profile.active&&this.profile.completed.length===0&&Object.keys(this.profile.loadout.inventory).every(id=>id===STARTER_WEAPON||id==='combatKnife'));
    this.profile.loadout.inventory={...this.state.players.local.inventory};
    this.profile.loadout.weapon=this.state.players.local.weapon;
    this.simulation.body.combat = 'ready';
    if (this.profile.active)
      this.newRun(this.profile.active.id, this.profile.active.difficulty, true);
    else this.renderer.simulation = this.simulation;
    if(!this.profile.active && this.policeProfile.active)this.bindPoliceMission();
    this.simulation.pause();
    window.addEventListener('blur', this.blur);
    window.addEventListener('pagehide', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    this.renderer.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.contextLost
    );
    this.emit();
    this.raf = requestAnimationFrame(this.loop);
  }
  async load(progress: (message: string) => void) {
    void loadWeaponStoreAccount().then(a=>{
      const chosen=selectedStartingLoadout();
      // The account API includes the legacy free AK for everyone. Do not turn
      // a new three-gun kit into four; an AK already carried in a save survives.
      this.grantWeapons(a.ownedWeaponIds.filter(id=>id!==STARTER_WEAPON||!chosen||chosen.includes(id)||!!this.state.players.local.inventory[id]));
    }).catch(()=>{});
    await Promise.all([this.renderer.load(progress),this.renderer.bodyRig.prepare(this.state.players.local.weapon)]);
    if (this.disposed || this.graphicsError) return;
    if (this.renderer.bodyRig.errors.length)
      throw Error('Your weapon could not load. Reload to retry.');
    this.ready = true;
    this.emit();
  }
  private blur = () => {
    this.pause();
    this.openPanel('journal');
  };
  private visibility = () => {
    if (document.hidden) this.blur();
  };
  private contextLost = (e: Event) => {
    e.preventDefault();
    this.pause();
    this.ready = false;
    this.graphicsError = 'The graphics connection was interrupted. Retry to continue from your saved progress.';
    this.emit();
  };
  private snapshot() {
    if(this.police){this.police.snapshot();return;}
    if (this.state.missionId === FREE_ROAM.id)
      this.profile = campaign.saveExplore(
        this.profile,
        this.state.players.local
      );
    else if (this.profile.active) {
      const phase = captureCheckpoint(this.simulation);
      if (phase)
        this.profile = {
          ...this.profile,
          active: { ...this.profile.active, phase }
        };
    }
  }
  private persist() {
    this.snapshot();
    this.storageOK = campaign.save(this.storage, this.profile);
    try { if(this.storage)this.storage.setItem(POLICE_SAVE_KEY,JSON.stringify(normalizePoliceProfile(this.policeProfile))); }
    catch { this.storageOK=false; }
  }
  private newRun(id: string, difficulty: string, restore = false) {
    this.police=null;
    this.state = createState(
      [{ id: 'local', name: 'You' }],
      id,
      'solo',
      this.profile.completed.length >= 3,
      difficulty
    );
    campaign.apply(
      this.state.players.local,
      this.profile.active?.checkpoint || this.profile.loadout
    );
    this.simulation = new StreetSimulation(this.state);
    if (restore)
      restoreCheckpoint(
        this.simulation,
        this.profile.active?.phase,
        campaign.apply
      );
    this.grantWeapons([...this.ownedWeapons]);
    applyStartingLoadout(this.state.players.local);
    if (!restore) {
      ensureStarterWeapons(this.state.players.local);
      this.simulation.body.combat = this.state.players.local.weapon ? 'ready' : 'unarmed';
    }
    this.simulation.settings.aimAssist = this.settings.aimAssist;
    this.renderer.simulation = this.simulation;
    this.route = [];
    this.destination=null;this.routeNotice='';
    this.renderer.setRoute([]);
    this.renderer.yaw = this.simulation.body.yaw;
    this.renderer.pitch = 0;
    this.routeAt = -Infinity;
    this.eventAt = 0;
    this.accumulator = 0;
  }
  start(id: string, difficulty = 'normal') {
    if (!this.ready || this.disposed || this.policeProfile.active) return false;
    this.snapshot();
    const next = campaign.begin(this.profile, id, difficulty);
    if (!next) return false;
    this.profile = next;
    this.newRun(id, difficulty);
    this.persist();
    this.resume();
    return true;
  }
  retry() {
    const active = this.profile.active;
    if (!active || !this.ready) return false;
    this.newRun(active.id, active.difficulty, true);
    this.resume();
    return true;
  }
  explore() {
    if (!this.ready) return;
    this.snapshot();
    this.policeProfile={...this.policeProfile,active:null};
    this.profile = campaign.abandon(this.profile);
    this.newRun(FREE_ROAM.id, 'normal');
    this.persist();
    this.resume();
  }
  selectPoliceUnit(unit:string) {
    if(this.policeProfile.active||!POLICE_UNITS.some(u=>u.id===unit))return false;
    this.policeProfile={...this.policeProfile,unit};this.persist();this.emit();return true;
  }
  private bindPoliceMission() {
    const id=this.policeProfile.active?.id;if(!id)return false;
    try { this.police=new PoliceCareerController(this.simulation,this.policeProfile);return true; }
    catch {
      this.policeProfile={...this.policeProfile,active:null,lastResult:{id,success:false,detail:'Zona nuk është gati. Zgjidh operacionin për të provuar përsëri.'}};
      this.newRun(FREE_ROAM.id,'normal');this.emit();return false;
    }
  }
  startPolice(id:string) {
    if(!this.ready||this.disposed||this.profile.active)return false;
    this.snapshot();const next=beginPoliceMission(this.policeProfile,id);if(!next)return false;
    this.policeProfile=next;this.newRun(FREE_ROAM.id,'normal');
    if(!this.bindPoliceMission()){this.persist();return false;}
    this.renderer.yaw=this.simulation.body.yaw;this.persist();this.resume();return true;
  }
  retryPolice() {
    if(!this.ready||!this.policeProfile.active)return false;
    this.newRun(FREE_ROAM.id,'normal');if(!this.bindPoliceMission())return false;this.resume();return true;
  }
  resume() {
    if (!this.ready || this.disposed || this.graphicsError || document.hidden || this.state.phase === 'finished') return;
    this.paused = false;
    this.input.setEnabled(true);
    this.simulation.resume();
    this.accumulator = 0;
    this.last = 0;
    void this.audio.unlock().catch(() => {});
    this.emit();
  }
  pause() {
    if (this.disposed) return;
    this.paused = true;
    this.input.setEnabled(false);
    this.simulation.pause();
    this.accumulator = 0;
    this.audio.suspend();
    this.persist();
    this.emit();
  }
  setSettings(patch: Partial<StreetSettings>) {
    this.settings = loadSettings({getItem:()=>JSON.stringify({...this.settings,...patch})});
    if (patch.quality) this.renderer.setQuality(this.settings.quality);
    this.renderer.targetFps = this.settings.targetFps;
    this.renderer.settings = this.settings;
    this.simulation.settings.aimAssist = this.settings.aimAssist;
    this.audio.enabled = this.settings.volume > 0;
    this.audio.volume = this.settings.volume;
    try {
      this.storage?.setItem(
        'tirana-streets:street-settings:v1',
        JSON.stringify(this.settings)
      );
    } catch {
      this.storageOK = false;
    }
    this.emit();
  }
  grantWeapons(ids: string[]) {
    if (this.disposed) return;
    for (const id of ids) {
      const w=WEAPON_BY_ID.get(id);if(!w||id==='fpsGunAttack')continue;
      this.ownedWeapons.add(id);
      this.state.players.local.inventory[id] ||= {ammo:w.magazine,reserve:w.category==='melee'?0:w.magazine*3};
    }
    this.emit();
  }
  action(action: string, targetId?: string | null) {
    if (this.disposed || !this.ready) return false;
    if (
      /^(buy:|equip:)/.test(action) ||
      (this.paused && action === 'holster')
    ) {
      if (this.simulation.arrest.locked || this.simulation.body.action || this.state.players.local.carId || this.state.players.local.aircraftId)
        return false;
      const item=action.startsWith('buy:')?action.slice(4):'';
      if(WEAPON_BY_ID.has(item)&&!this.state.players.local.inventory[item])return false;
      interact(this.state, 'local', action);
      this.simulation.body.combat = this.state.players.local.weapon
        ? 'ready'
        : 'unarmed';
      this.persist();
      this.emit();
      return true;
    }
    if (this.paused) return false;
    if(action==='police:interact'||action==='interact'&&this.police?.eligible()){
      const result=this.police?.interact()??false;this.emit();return result;
    }
    const result = this.simulation.execute(
      action === 'vehicle' ? 'interact' : action,
      targetId
    );
    this.emit();
    return result;
  }
  private stepSimulation(dt: number) {
    const p = this.state.players.local;
    this.simulation.step(dt);
    if(this.police){
      const changed=this.police.step(dt);
      if(this.police.run.status!=='active'){
        this.policeProfile=settlePoliceMission(this.policeProfile)||this.policeProfile;
        this.newRun(FREE_ROAM.id,'normal');this.persist();this.pause();this.openPanel('journal');return;
      }
      if(changed){this.routeAt=-Infinity;this.persist();}
    }
    const car = p.carId
      ? this.state.cars.find((c) => c.id === p.carId)
      : undefined;
    if (!p.aircraftId && !car && collideDetailPosts(p,.34)) p.speed=0;
    for (const n of this.state.npcs)
      if (n.motion !== 'drive') collideDetailPosts(n, 0.34);
    for (const event of this.simulation.events) {
      if (event.id <= this.eventAt) continue;
      this.eventAt = event.id;
      if(event.kind==='arrest-complete'){
        this.profile=campaign.saveExplore({...this.profile,active:null},p);
        this.newRun(FREE_ROAM.id,'normal');
        const released=this.state.players.local;released.x=POLICE_STATION.x;released.z=POLICE_STATION.z;released.weapon='';released.wanted=0;
        this.simulation.body.y=groundHeight(released.x,released.z)+.08;this.simulation.body.notice='Drejtoria e Policisë Tiranë · Je liruar';
        this.input.releaseAll();this.persist();this.emit();return;
      }
      if (event.kind === 'checkpoint') this.persist();
      if (event.kind === 'enter') {
        this.renderer.yaw = this.simulation.body.yaw;
        this.renderer.pitch = 0;
        this.input.releaseAll();
      }
      if (event.kind === 'shot' && !this.simulation.body.aim)
        this.renderer.pitch = Math.min(
          1.3,
          this.renderer.pitch + 0.012 * this.settings.shake
        );
      if (event.kind === 'dead' || event.kind === 'arrest-spray')
        this.input.releaseAll();
      if (event.kind === 'arsenal') {
        this.pause();
        this.openPanel('arsenal');
      }
      this.audio.street(event.kind);
    }
  }
  private loop = (now: number) => {
    if (this.disposed) return;
    const dt = this.last
      ? Math.min(0.15, Math.max(0, (now - this.last) / 1000))
      : 0;
    this.last = now;
    const p = this.state.players.local;
    if (!this.paused && this.ready) {
      this.simulation.setIntent(
        this.input.readStreet(this.renderer.yaw, this.renderer.pitch, !!p.carId)
      );
      this.accumulator = Math.min(0.1, this.accumulator + dt);
      while (this.accumulator >= 1 / 60 && !this.paused) {
        this.stepSimulation(1 / 60);
        this.accumulator -= 1 / 60;
      }
      if (this.state.phase === 'finished') {
        const complete = campaign.resolve(this.profile, this.state, 'local');
        if (complete) {
          this.profile = complete;
          campaign.apply(p, this.profile.loadout);
          this.audio.cue(true);
        }
        this.pause();
        this.openPanel('journal');
      }
      if (!this.paused) {
        this.audio.update(p.speed, !!p.carId);
        this.audio.city(this.state, p, dt, this.renderer.yaw, this.simulation.body.grounded, this.simulation.body.y);
      }
      if (now - this.routeAt > 750) {
        this.updateNavigation();
        this.routeAt = now;
      }
    }
    this.renderDelta = Math.min(.15, this.renderDelta + dt);
    // The loading overlay covers the scene. Drawing it early starts optional NPC,
    // vehicle and landmark work before the selected body/weapon can finish loading.
    if (this.ready && !document.hidden && !this.graphicsError && this.renderPacer.shouldRender(now, this.paused ? 15 : this.settings.targetFps)) {
      this.renderer.render(this.state, 'local', this.paused ? 0 : this.renderDelta, false);
      this.renderDelta = 0;
    }
    if (now - this.saveAt > 5000) {
      this.persist();
      this.saveAt = now;
    }
    if (now - this.uiAt > 100) {
      this.emit();
      this.uiAt = now;
    }
    this.raf = requestAnimationFrame(this.loop);
  };
  private emit() {
    const actions=this.simulation.resolve(),policeAction=this.police?.action();
    // Preserve car/door controls while travelling; the mission action takes the
    // contextual slot only at a valid target or during its active channel.
    if(policeAction&&(policeAction.enabled||this.police?.run.channel)){
      const index=actions.findIndex(a=>a.id==='interact');
      const action={...policeAction,id:'interact'};if(index>=0)actions[index]=action;else actions.push(action);
    }
    this.publish({
      profile: this.profile,
      policeProfile:this.policeProfile,
      police:this.police?.view()||null,
      state: this.state,
      paused: this.paused,
      ready: this.ready,
      graphicsError: this.graphicsError,
      route: this.route,
      destination: this.destination,
      routeNotice: this.routeNotice,
      fps: this.renderer.fps,
      storageOK: this.storageOK,
      assetErrors: [
        ...this.renderer.collectionFleet.errors.values(),
        ...this.renderer.humans.errors,
        ...this.renderer.bodyRig.errors,
        ...this.renderer.details.civic.errors,
        ...this.renderer.details.dajti.errors
      ],
      actions,
      body: { ...this.simulation.body },
      objective: this.police?.objective()||this.simulation.objective(),
      settings: { ...this.settings },
      metrics: { ...this.renderer.metrics }
    });
  }
  dispose() {
    if (this.disposed) return;
    this.persist();
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('blur', this.blur);
    window.removeEventListener('pagehide', this.blur);
    document.removeEventListener('visibilitychange', this.visibility);
    this.renderer.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.contextLost
    );
    this.input.destroy();
    this.audio.destroy();
    this.renderer.destroy();
  }
}
