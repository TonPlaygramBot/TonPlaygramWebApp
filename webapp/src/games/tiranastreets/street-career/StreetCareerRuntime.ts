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
import {
  createCampaign,
  type StreetProfile,
  type StoragePort
} from './campaignCore.mjs';
export const campaign = createCampaign(MISSIONS, WEAPONS, STARTER_WEAPON);
export type StreetView = {
  profile: StreetProfile;
  state: State;
  paused: boolean;
  ready: boolean;
  route: Point[];
  fps: number;
  storageOK: boolean;
  assetErrors: string[];
  actions: StreetAction[];
  body: BodyState;
  objective: { title: string; detail: string; training: boolean };
  settings: StreetSettings;
  metrics: StreetRenderer['metrics'];
};
/** Local-only career. The shared engine still owns cars, city AI and settlement;
 * its optional player adapter supplies this mode's full-body 3D rules. */
export class StreetCareerRuntime {
  readonly renderer: StreetRenderer;
  readonly input: StreetInput;
  readonly audio = new CityAudio();
  state = createState([{ id: 'local', name: 'You' }], FREE_ROAM.id, 'solo');
  simulation = new StreetSimulation(this.state);
  settings: StreetSettings;
  profile: StreetProfile;
  paused = true;
  ready = false;
  route: Point[] = [];
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
    this.settings = loadSettings(storage);
    this.audio.volume = this.settings.volume;
    this.audio.enabled = this.settings.volume > 0;
    this.renderer = new StreetRenderer(root);
    this.renderer.settings = this.settings;
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
    this.state.players.local.weapon = 'glockSidearmAttack';
    this.simulation.body.combat = 'ready';
    if (this.profile.active)
      this.newRun(this.profile.active.id, this.profile.active.difficulty, true);
    else this.renderer.simulation = this.simulation;
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
    void loadWeaponStoreAccount().then(a=>this.grantWeapons(a.ownedWeaponIds)).catch(()=>{});
    await this.renderer.load(progress);
    progress('Preparing nearby vehicles and police…');
    await this.renderer.prepareActors(this.state,this.state.players.local);
    if (this.disposed) return;
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
    this.renderer.humans.errors.push(
      'Graphics context lost. Exit and reopen Tirana Streets.'
    );
    this.emit();
  };
  private snapshot() {
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
  }
  private newRun(id: string, difficulty: string, restore = false) {
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
    if (!restore) {
      ensureStarterWeapons(this.state.players.local);
      this.state.players.local.weapon = 'glockSidearmAttack';
      this.simulation.body.combat = 'ready';
    }
    this.simulation.settings.aimAssist = this.settings.aimAssist;
    this.renderer.simulation = this.simulation;
    this.route = [];
    this.renderer.setRoute([]);
    this.renderer.yaw = this.simulation.body.yaw;
    this.renderer.pitch = 0;
    this.routeAt = -Infinity;
    this.eventAt = 0;
    this.accumulator = 0;
  }
  start(id: string, difficulty = 'normal') {
    if (!this.ready || this.disposed) return false;
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
    this.profile = campaign.abandon(this.profile);
    this.newRun(FREE_ROAM.id, 'normal');
    this.persist();
    this.resume();
  }
  resume() {
    if (!this.ready || this.disposed || this.state.phase === 'finished') return;
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
    this.audio.update(0, false);
    this.persist();
    this.emit();
  }
  setSettings(patch: Partial<StreetSettings>) {
    Object.assign(this.settings, patch);
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
      const w=WEAPON_BY_ID.get(id);if(!w)continue;
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
      if (this.simulation.body.action || this.state.players.local.carId || this.state.players.local.aircraftId)
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
    const car = p.carId
      ? this.state.cars.find((c) => c.id === p.carId)
      : undefined;
    if (!p.aircraftId && collideDetailPosts(car || p, car ? 1.35 : 0.34)) {
      if (car) {
        car.speed *= 0.45;
        car.vx *= 0.3;
        car.vz *= 0.3;
        p.x = car.x;
        p.z = car.z;
        p.speed = car.speed;
      } else p.speed = 0;
    }
    for (const n of this.state.npcs)
      if (n.motion !== 'drive') collideDetailPosts(n, 0.34);
    for (const event of this.simulation.events) {
      if (event.id <= this.eventAt) continue;
      this.eventAt = event.id;
      if (event.kind === 'checkpoint') this.persist();
      if (event.kind === 'enter') {
        this.renderer.yaw = this.simulation.body.yaw;
        this.renderer.pitch = 0;
        this.input.releaseAll();
      }
      if (event.kind === 'shot')
        this.renderer.pitch = Math.min(
          1.3,
          this.renderer.pitch + 0.012 * this.settings.shake
        );
      if (event.kind === 'dead' || event.kind === 'hurt')
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
        this.audio.city(this.state, p, dt);
      }
      if (now - this.routeAt > 750) {
        const mission = MISSIONS.find(m=>m.id===this.state.missionId);
        const aircraft = mission?.aircraft && this.simulation.flight.aircraft.find(a=>a.kind===mission.aircraft);
        this.route = aircraft && !p.aircraftId ? [p,this.simulation.flight.access(aircraft)] : navigation(this.state, 'local');
        this.renderer.setRoute(this.route);
        this.routeAt = now;
      }
    }
    this.renderer.render(this.state, 'local', this.paused ? 0 : dt, false);
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
    this.publish({
      profile: this.profile,
      state: this.state,
      paused: this.paused,
      ready: this.ready,
      route: this.route,
      fps: this.renderer.fps,
      storageOK: this.storageOK,
      assetErrors: [
        ...this.renderer.collectionFleet.errors.values(),
        ...this.renderer.humans.errors,
        ...this.renderer.bodyRig.errors,
        ...this.renderer.details.civic.errors,
        ...this.renderer.details.dajti.errors
      ],
      actions: this.simulation.resolve(),
      body: { ...this.simulation.body },
      objective: this.simulation.objective(),
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
