import {advanceBattleObjective} from './shared/missionCore.mjs';
import {battleGround} from './shared/terrain.mjs';
import {createWebGLRenderer} from '../tiranastreets/createWebGLRenderer';
import { BattlefieldVehicle } from './BattlefieldVehicle';
import { CombatEffects } from '../tiranastreets/CombatEffects';
import { BATTLE_MODES, OPERATIONS, sectorSpawns, sectorObstacles, zoneRadius, normalizeOperations, finishOperation, type BattleMode } from './shared/battlefield.mjs';
import { createBrain, thinkBot, type BotBrain } from './shared/botBrain.mjs';
import { tacticalGoal, coverPoint } from '../tiranastreets/shared/forceTactics.mjs';
import { BattlefieldForces } from './BattlefieldForces';
import * as THREE from 'three';
import { CompatibilityRenderer } from './compatibility';
import { GameAudio } from './audio';
import { GameInput } from './input';
import { makeEnemy, type ActorVisual, type World } from './world';
import { makeCityWorld } from './cityWorld';
import { spawnPoint } from './shared/match.mjs';
import { START, BATTLEFIELD_MAPS } from './shared/layout.mjs';
import type { OnlineState, OnlineTransport } from './online';
import {
  WEAPONS,
  EXTRACTION,
  clamp,
  collides,
  moveCircle,
  lineClear,
  rayBox,
  findPath,
  waveCount,
  reloadAmmo,
  createRng,
  type Vec2,
  type Phase,
  type WeaponId,
  type BattlefieldMapId,
  type Difficulty,
  type Settings
} from './core';
export type Upgrade = 'damage' | 'armor' | 'reload';
export type Snapshot = {
  battleMode?:BattleMode;
  objective?:string;
  objectiveProgress?:number;
  operations?:string[];
  operationId?:string;
  zone?:number;
  driving?:boolean;
  nearVehicle?:boolean;
  vehicleView?:'cockpit'|'chase';
  vehicleSpeed?:number;
  objectivePoint?:Vec2;
  zoneCenter?:Vec2;
  extractionPoint?:Vec2;
  phase: Phase;
  health: number;
  maxHealth: number;
  ammo: number;
  reserve: number;
  kills: number;
  wave: number;
  remaining: number;
  score: number;
  time: number;
  fps: number;
  reload: number;
  aim: boolean;
  crouch: boolean;
  heading: number;
  extract: boolean;
  extraction: number;
  distance: number;
  hit: number;
  hurt: number;
  message: string;
  messageKind: string;
  medkits: number;
  weapon: WeaponId;
  shots: number;
  hits: number;
  x: number;
  z: number;
  enemies: { x: number; z: number; alive: boolean }[];
  quality: number;
  ready: boolean;
  best: number;
  compatibility: boolean;
  online?: OnlineState;
};
type Enemy = ActorVisual & {
  brain?:BotBrain;
  lastSeen?:Vec2;
  lastSeenAt?:number;
  stuck?:number;
  detour?:Vec2;
  detourUntil?:number;
  pathGoal?:Vec2;
  networkId?: string;
  networkTarget?: Vec2;
  networkYaw?: number;
  lastRemoteShot?: number;
  hp: number;
  id: number;
  cooldown: number;
  path: Vec2[];
  repath: number;
  deadTime: number;
  state: 'advance' | 'fire' | 'dead' | 'cover';
  anim?: string;
  forceCharacter?: string;
  aimTime?: number;
  coverId?: string;
  flashTime: number;
  walk: number;
  hurt: number;
};
type Effect = {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  velocity: THREE.Vector3;
};
type Loot = { mesh: THREE.Group; weapon: WeaponId; ammo: number; life: number };
const defaults: Settings = {
  sensitivity: 1,
  volume: 0.55,
  assist: true,
  quality: 'auto'
};
export class GameEngine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, 1, 0.055, 220);
  world: World;
  input: GameInput;
  audio = new GameAudio();
  phase: Phase = 'menu';
  settings = { ...defaults };
  weapon: WeaponId = 'ar';
  battlefieldMap: BattlefieldMapId = 'skanderbeg';
  readonly vehicle:BattlefieldVehicle;
  private vehiclePedals=new Set<string>();
  vehicleThrottle=0;
  vehicleBrake=false;
  private intelPoint={x:0,z:0};
  private zoneRing=new THREE.Mesh(new THREE.RingGeometry(.985,1,96),new THREE.MeshBasicMaterial({color:0xffae46,side:THREE.DoubleSide,transparent:true,opacity:.65,depthWrite:false}));
  private missionBeacon=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,14,8),new THREE.MeshBasicMaterial({color:0x63c9ff,transparent:true,opacity:.55,depthWrite:false}));
  battleMode:BattleMode='last-stand';
  operationId='';
  operations={completed:[] as string[]};
  private objectiveProgress=0;
  private gunNoise:(Vec2&{at:number})|null=null;
  private intel=false;
  private sectorCenter={...START};
  private battleObstacles:import('./core').Obstacle[]=[];
  private combatEffects:CombatEffects;
  difficulty: Difficulty = 'recruit';
  player = { ...START };
  yaw = 0;
  pitch = 0;
  health = 100;
  maxHealth = 100;
  ammo = 30;
  reserve = 150;
  medkits = 1;
  kills = 0;
  wave = 1;
  score = 0;
  elapsed = 0;
  shots = 0;
  hits = 0;
  best = 0;
  online: OnlineTransport | null = null;
  onlineState?: OnlineState;
  private networkTime = 0;
  private networkSeq = 0;
  private pendingReload = false;
  private pendingHeal = false;
  private remoteTarget: Vec2 | null = null;
  private enemies: Enemy[] = [];
  private forces?: BattlefieldForces;
  private effects: Effect[] = [];
  private loot: Loot[] = [];
  private extractionPoint = { ...EXTRACTION };
  private rng = createRng(451);
  private cooldown = 0;
  private reloadTimer = 0;
  private recoil = 0;
  private kick = 0;
  private swayX = 0;
  private swayY = 0;
  private lastDamage = -99;
  private hit = 0;
  private hurt = 0;
  private message = '';
  private messageKind = '';
  private messageTime = 0;
  private extraction = false;
  private extractProgress = 0;
  private damageMultiplier = 1;
  private reloadMultiplier = 1;
  private armorMultiplier = 1;
  private aim = 0;
  private movement = 0;
  private footsteps = 0;
  private frame = 0;
  private previous = 0;
  private accumulator = 0;
  private uiTime = 0;
  private totalTime = 0;
  private fpsTime = 0;
  private fpsFrames = 0;
  private fps = 60;
  private quality = 1;
  private lowSamples = 0;
  private size: ResizeObserver;
  private callback: (s: Snapshot) => void;
  private disposed = false;
  private errorCallback: (s: string) => void;
  private tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 4);
  private sparkGeo = new THREE.IcosahedronGeometry(0.025, 0);
  private tracerMat = new THREE.MeshBasicMaterial({
    color: '#ffdda0',
    transparent: true,
    opacity: 0.8
  });
  private sparkMat = new THREE.MeshBasicMaterial({ color: '#ffb36c' });
  constructor(
    canvas: HTMLCanvasElement,
    surface: HTMLElement,
    onState: (s: Snapshot) => void,
    onError: (s: string) => void
  ) {
    this.callback = onState;
    this.errorCallback = onError;
    try {
      this.renderer = createWebGLRenderer(canvas);
    } catch {
      this.renderer = new CompatibilityRenderer(
        canvas
      ) as unknown as THREE.WebGLRenderer;
    }
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    try {
      this.best = Number(localStorage.getItem('bw-best') || 0);
      const saved = JSON.parse(localStorage.getItem('bw-settings') || 'null');
      if (saved) {
        this.settings = { ...defaults, ...saved };
        this.settings.sensitivity = clamp(
          Number(this.settings.sensitivity) || 1,
          0.35,
          2
        );
        this.settings.volume = clamp(Number(this.settings.volume) || 0, 0, 1);
      }
    } catch {
      /* Storage can be unavailable in private frames. */
    }
    this.world = makeCityWorld(this.scene, this.camera, this.renderer);
    this.combatEffects=new CombatEffects(this.scene);
    this.vehicle=new BattlefieldVehicle(this.scene);
    this.zoneRing.rotation.x=-Math.PI/2;this.zoneRing.visible=false;this.missionBeacon.visible=false;this.scene.add(this.zoneRing,this.missionBeacon);
    try{this.operations=normalizeOperations(JSON.parse(localStorage.getItem('tirana:operations:v1')||'null'));}catch{}
    if (this.renderer instanceof THREE.WebGLRenderer) this.forces = new BattlefieldForces(this.scene);
    this.input = new GameInput(surface);
    this.input.onLook = (dx, dy) => this.look(dx, dy);
    this.input.onFire = () => this.beginFire();
    this.input.onReload = () => this.reload();
    this.input.onPause = () => this.pause();
    this.input.onHeal = () => this.heal();
    this.camera.rotation.order = 'YXZ';
    this.size = new ResizeObserver(() => this.resize());
    this.size.observe(surface);
    this.resize();
    this.applyQuality();
    canvas.addEventListener('webglcontextlost', this.contextLost);
    this.emit();
    this.frame = requestAnimationFrame(this.loop);
  }
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.pause();
    this.errorCallback(
      'Graphics were interrupted. Reload the game to reconnect.'
    );
  };
  private resize() {
    const el = this.renderer.domElement.parentElement!;
    const w = el.clientWidth,
      h = el.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }
  setSettings(next: Partial<Settings>) {
    this.settings = { ...this.settings, ...next };
    this.audio.setVolume(this.settings.volume);
    if (next.quality) {
      this.quality = 1;
      this.lowSamples = 0;
      this.applyQuality();
    }
    try {
      localStorage.setItem('bw-settings', JSON.stringify(this.settings));
    } catch {}
    this.emit();
  }
  private applyQuality() {
    const q = this.settings.quality;
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      q === 'high' ? 1.75 : q === 'low' ? 1 : 1.4
    );
    this.renderer.setPixelRatio(dpr * (q === 'auto' ? this.quality : 1));
    this.renderer.shadowMap.enabled = q !== 'low' && this.quality > 0.65;
    this.world.rain.visible = this.world.rain.userData.enabled !== false && q !== 'low';
    this.resize();
  }
  start(weapon: WeaponId, difficulty: Difficulty, mapId: BattlefieldMapId = 'skanderbeg', battleMode:BattleMode='last-stand', operationId='') {
    this.clearActors();
    this.effects.forEach((e) => this.scene.remove(e.mesh));
    this.effects = [];
    this.weapon = weapon;
    this.battlefieldMap = mapId;
    this.battleMode=BATTLE_MODES.some(m=>m.id===battleMode)?battleMode:'last-stand';
    const operationIndex=OPERATIONS.findIndex(o=>o.id===operationId&&o.map===mapId&&o.mode===battleMode);
    this.operationId=operationIndex>=0&&operationIndex<=this.operations.completed.length?operationId:'';
    this.objectiveProgress=0;this.gunNoise=null;this.intel=false;this.combatEffects.reset();
    this.difficulty = difficulty;
    const sector = BATTLEFIELD_MAPS.find((map) => map.id === mapId) || BATTLEFIELD_MAPS[0];
    this.player = { ...sector.start };
    this.sectorCenter={...sector.start};
    if(!this.online)this.vehicle.reset(sector.start,this.world.obstacles);else{this.vehicle.driving=false;this.vehicle.available=false;}this.vehiclePedals.clear();this.vehicleThrottle=0;this.vehicleBrake=false;
    const midpoint={x:(sector.start.x+sector.extraction.x)/2,z:(sector.start.z+sector.extraction.z)/2};
    this.intelPoint={...midpoint};
    outer:for(let radius=0;radius<30;radius+=2)for(let n=0;n<24;n++){
      const q={x:midpoint.x+Math.sin(n*Math.PI/12)*radius,z:midpoint.z+Math.cos(n*Math.PI/12)*radius};
      if(!collides(q.x,q.z,1,this.world.obstacles)){this.intelPoint=q;break outer;}
    }
    this.battleObstacles=sectorObstacles(sector.start,220,this.world.obstacles);
    this.extractionPoint = { ...sector.extraction };
    this.world.extraction.position.set(this.extractionPoint.x, battleGround(this.extractionPoint.x,this.extractionPoint.z)+.12, this.extractionPoint.z);
    this.yaw = 0;
    this.pitch = -0.01;
    this.health = this.maxHealth = 100;
    this.ammo = WEAPONS[weapon].mag;
    this.reserve = 150;
    this.medkits = 1;
    this.kills = 0;
    this.score = 0;
    this.elapsed = 0;
    this.shots = this.hits = 0;
    this.wave = 1;
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.recoil = this.kick = this.aim = 0;
    this.lastDamage = -99;
    this.hurt = this.hit = 0;
    this.damageMultiplier = this.reloadMultiplier = this.armorMultiplier = 1;
    this.extraction = false;
    this.extractProgress = 0;
    this.world.extraction.visible = false;
    this.input.clear();
    this.input.crouching = false;
    this.phase = 'playing';
    this.input.active = true;
    this.rng = createRng(451 + Math.floor(Math.random() * 10000));
    this.audio.setVolume(this.settings.volume);
    this.audio.start();
    if (!this.online) this.spawnWave();
    this.notify(BATTLE_MODES.find(m=>m.id===this.battleMode)!.name.toUpperCase(), 'wave', 4);
    this.emit();
  }
  private clearActors() {
    this.forces?.clear();
    for (const e of this.enemies) {
      this.scene.remove(e.group);
      const materials = new Set<THREE.Material>();
      e.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            materials.add(m);
        }
      });
      materials.forEach((m) => m.dispose());
    }
    this.enemies = [];
    for (const item of this.loot) this.scene.remove(item.mesh);
    this.loot = [];
  }
  private spawnWave() {
    this.clearActors();
    const count=this.battleMode==='waves'?waveCount(this.wave):this.battleMode==='last-stand'?7:6;
    const positions=sectorSpawns(this.battlefieldMap,count,this.world.obstacles,[this.player]);
    for (let i = 0; i < positions.length; i++) {
      const visual = makeEnemy();
      const {x,z}=positions[i];
      visual.group.position.set(x,battleGround(x,z),z);
      moveCircle(visual.group.position, 0, 0, .4, this.world.obstacles);
      const e: Enemy = {
        ...visual,
        id: i,
        brain:createBrain(String(i)),
        forceCharacter: this.wave===1?'fnsh_officer':this.wave===2?'renea_officer':'army_soldier',
        hp: this.wave === 3 ? 115 : 100,
        cooldown: 3 + i * 0.45,
        path: [],
        repath: i * 0.13,
        deadTime: 0,
        state: 'advance',
        flashTime: 0,
        walk: i,
        hurt: 0
      };
      this.enemies.push(e);
      this.scene.add(e.group);
    }
  }
  pause() {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';this.vehiclePedals.clear();this.vehicleThrottle=0;this.vehicleBrake=false;
    this.input.active = false;
    this.input.clear();
    if (this.online) this.sendOnlineInput();
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.suspend();
    this.emit();
  }
  resume() {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.input.clear();
    this.input.active =
      !this.online ||
      (this.onlineState?.status === 'playing' && this.health > 0);
    this.audio.start();
    this.emit();
  }
  menu() {
    this.phase = 'menu';this.vehicle.driving=false;this.vehicle.available=false;this.vehicle.present();this.world.gun.visible=true;
    this.input.active = false;
    this.input.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    this.clearActors();
    this.world.extraction.visible = false;
    this.audio.suspend();
    this.emit();
  }
  upgrade(choice: Upgrade) {
    if (this.phase !== 'upgrade') return;
    if (choice === 'damage') this.damageMultiplier *= 1.25;
    if (choice === 'armor') {
      this.maxHealth += 30;
      this.armorMultiplier *= 0.85;
    }
    if (choice === 'reload') this.reloadMultiplier *= 0.72;
    this.wave++;
    this.health = this.maxHealth;
    this.ammo = WEAPONS[this.weapon].mag;
    this.reserve = Math.max(150, this.reserve);
    this.medkits = 1;
    this.reloadTimer = 0;
    this.phase = 'playing';
    this.input.active = true;
    this.input.clear();
    this.audio.start();
    if (!this.online) this.spawnWave();
    this.notify(`WAVE 0${this.wave}  /  HOSTILES INBOUND`, 'wave', 3.5);
    this.emit();
  }
  look(dx: number, dy: number) {
    if (this.phase !== 'playing') return;
    const s =
      0.0031 * this.settings.sensitivity * (this.input.aiming ? 0.6 : 1);
    this.yaw -= dx * s;
    this.pitch = clamp(this.pitch - dy * s, -1.15, 1.15);
    this.swayX = clamp(dx * 0.0003, -0.018, 0.018);
    this.swayY = clamp(dy * 0.0002, -0.014, 0.014);
  }
  toggleAim() {
    if (this.phase !== 'playing') return;
    this.input.aiming = !this.input.aiming;
    this.emit();
  }
  toggleCrouch() {
    if (this.phase !== 'playing') return;
    this.input.crouching = !this.input.crouching;
    this.emit();
  }
  beginFire() {
    if (this.phase !== 'playing') return;
    this.input.firing = true;
    if (this.online) {
      this.sendOnlineInput();
      return;
    }
    this.updateCamera(1 / 60);
    this.shoot();
    this.emit();
  }
  reload() {
    if (this.online) {
      this.pendingReload = true;
      this.sendOnlineInput();
      return;
    }
    if (
      this.phase !== 'playing' ||
      this.reloadTimer > 0 ||
      this.ammo >= WEAPONS[this.weapon].mag ||
      this.reserve <= 0
    )
      return;
    this.reloadTimer = WEAPONS[this.weapon].reload * this.reloadMultiplier;
    this.audio.reload();
    this.emit();
  }
  heal() {
    if (this.online) {
      this.pendingHeal = true;
      this.sendOnlineInput();
      return;
    }
    if (
      this.phase !== 'playing' ||
      this.medkits <= 0 ||
      this.health >= this.maxHealth
    )
      return;
    this.medkits--;
    this.health = Math.min(this.maxHealth, this.health + 60);
    this.notify('+60  FIELD TREATMENT', 'good', 2);
    this.audio.tone(550, 0.3, 0.16, 800);
    this.emit();
  }
  private notify(msg: string, kind: string, seconds = 1.5) {
    this.message = msg;
    this.messageKind = kind;
    this.messageTime = seconds;
  }
  private damage(amount: number) {
    if (this.phase !== 'playing') return;
    this.health = Math.max(0, this.health - amount * this.armorMultiplier);
    this.lastDamage = this.elapsed;
    this.hurt = 1;
    this.audio.hurt();
    if (this.health <= 0) this.finish(false);
  }
  private finish(won: boolean) {
    this.phase = won ? 'won' : 'lost';
    this.input.active = false;
    this.input.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    if (won) {
      this.operations=finishOperation(this.operations,this.operationId,true);
      try{localStorage.setItem('tirana:operations:v1',JSON.stringify(this.operations));}catch{}
      this.score += 1000 + Math.max(0, Math.round(900 - this.elapsed * 2));
      this.audio.victory();
    } else this.audio.tone(180, 0.6, 0.4, 45);
    if (this.score > this.best) {
      this.best = this.score;
      try {
        localStorage.setItem('bw-best', String(this.best));
      } catch {}
    }
    this.emit();
  }
  private rayDistance(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    center: THREE.Vector3,
    radius: number
  ) {
    const oc = center.clone().sub(origin),
      t = oc.dot(dir),
      d = oc.lengthSq() - t * t;
    if (t < 0 || d > radius * radius) return Infinity;
    return t - Math.sqrt(radius * radius - d);
  }
  private shoot() {
    if(this.vehicle.driving)return;
    const w = WEAPONS[this.weapon];
    if (this.reloadTimer > 0 || this.cooldown > 0) return;
    if (this.ammo <= 0) {
      this.reload();
      return;
    }
    this.ammo--;
    this.gunNoise={...this.player,at:this.elapsed};
    this.shots++;
    this.cooldown = w.interval;
    this.recoil = Math.min(0.07, this.recoil + w.recoil * 0.55);
    this.kick = Math.min(0.1, this.kick + 0.04);
    this.audio.shot();
    this.world.muzzle.visible = true;
    this.world.muzzle.rotation.z = this.rng() * 6;
    this.world.gunLight.intensity = 2;
    const origin = this.camera.position.clone(),
      dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const spread = w.spread * (this.input.aiming ? 0.25 : 1);
    dir.x += (this.rng() - 0.5) * spread;
    dir.y += (this.rng() - 0.5) * spread;
    dir.normalize();
    let nearest = 80;
    for (const o of this.world.obstacles)
      nearest = Math.min(nearest, rayBox(origin, dir, o));
    let victim: Enemy | undefined,
      head = false;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const p = e.group.position;
      const headD = this.rayDistance(
        origin,
        dir,
        new THREE.Vector3(p.x, p.y+1.79, p.z),
        0.24
      );
      const bodyD = this.rayDistance(
        origin,
        dir,
        new THREE.Vector3(p.x, p.y+1.16, p.z),
        0.45
      );
      const legsD = this.rayDistance(
        origin,
        dir,
        new THREE.Vector3(p.x, p.y+0.56, p.z),
        0.3
      );
      const d = Math.min(headD, bodyD, legsD);
      if (d < nearest) {
        nearest = d;
        victim = e;
        head = headD <= Math.min(bodyD, legsD);
      }
    }
    const end = origin.clone().addScaledVector(dir, nearest);
    const muzzle = new THREE.Vector3();
    this.world.muzzle.getWorldPosition(muzzle);

    this.combatEffects.shot(muzzle,end);
    if (victim) {
      this.hits++;
      this.hit = head ? 2 : 1;
      victim.hp -= w.damage * this.damageMultiplier * (head ? 3.35 : 1);
      victim.hurt = 0.14;
      this.audio.hit();
      this.sparks(end, 4);
      if (victim.hp <= 0) {
        victim.state = 'dead';
        victim.deadTime = 0;
        this.kills++;
        const points = head ? 175 : 100;
        this.score += points;
        this.reserve += 8;
        this.dropLoot(victim.group.position);
        this.audio.kill();
        this.notify(
          head ? `HEADSHOT  +${points}` : `HOSTILE DOWN  +${points}`,
          head ? 'head' : 'kill'
        );
      }
    } else if (nearest < 80) this.sparks(end, 3);
    if (this.ammo === 0)
      this.notify('MAGAZINE EMPTY  /  RELOAD', 'warning', 1.2);
  }
  private dropLoot(position: THREE.Vector3) {
    const ids = Object.keys(WEAPONS) as WeaponId[];
    const weapon = ids[Math.floor(this.rng() * ids.length)];
    const mesh = new THREE.Group();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(.75,.16,.32),new THREE.MeshStandardMaterial({color:0x29383a,metalness:.65,roughness:.3}));
    const glow = new THREE.Mesh(new THREE.RingGeometry(.55,.62,24),new THREE.MeshBasicMaterial({color:0xd8fa69,transparent:true,opacity:.72,side:THREE.DoubleSide}));
    glow.rotation.x=-Math.PI/2;glow.position.y=.03;crate.position.y=.22;mesh.add(crate,glow);mesh.position.copy(position);mesh.position.y=battleGround(position.x,position.z);this.scene.add(mesh);
    this.loot.push({mesh,weapon,ammo:Math.max(WEAPONS[weapon].mag,Math.round(WEAPONS[weapon].mag*1.5)),life:0});
  }
  private updateLoot(dt:number) {
    for (let i=this.loot.length-1;i>=0;i--) {const item=this.loot[i];item.life+=dt;item.mesh.rotation.y+=dt*.8;item.mesh.position.y=battleGround(item.mesh.position.x,item.mesh.position.z)+.04+Math.sin(item.life*3)*.025;
      if(Math.hypot(this.player.x-item.mesh.position.x,this.player.z-item.mesh.position.z)<1.55){this.weapon=item.weapon;this.ammo=WEAPONS[item.weapon].mag;this.reserve+=item.ammo;this.notify(`${WEAPONS[item.weapon].name} PICKED UP  +${item.ammo} AMMO`,'good',2.4);this.scene.remove(item.mesh);item.mesh.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});this.loot.splice(i,1);}
      else if(item.life>45){this.scene.remove(item.mesh);this.loot.splice(i,1);}
    }
  }
  private tracer(start: THREE.Vector3, end: THREE.Vector3, enemy: boolean) {
    if (this.effects.length > 65) return;
    const delta = end.clone().sub(start);
    const length = Math.min(delta.length(), enemy ? 9 : 15),
      mesh = new THREE.Mesh(this.tracerGeo, this.tracerMat);
    mesh.position.copy(start).lerp(end, 0.5);
    mesh.scale.set(1, length, 1);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize()
    );
    this.scene.add(mesh);
    this.effects.push({
      mesh,
      life: 0.06,
      max: 0.06,
      velocity: new THREE.Vector3()
    });
  }
  private sparks(p: THREE.Vector3, count: number) {
    if (this.effects.length > 65) return;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      mesh.position.copy(p);
      this.scene.add(mesh);
      this.effects.push({
        mesh,
        life: 0.15 + this.rng() * 0.13,
        max: 0.28,
        velocity: new THREE.Vector3(
          (this.rng() - 0.5) * 3,
          this.rng() * 3,
          (this.rng() - 0.5) * 3
        )
      });
    }
  }
  private physics(dt: number) {
    if (this.online) {
      this.onlinePhysics(dt);
      return;
    }
    this.elapsed += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hit = Math.max(0, this.hit - dt * 5);
    this.hurt = Math.max(0, this.hurt - dt * 1.5);
    this.recoil *= Math.exp(-dt * 12);
    this.kick *= Math.exp(-dt * 15);
    this.swayX *= Math.exp(-dt * 8);
    this.swayY *= Math.exp(-dt * 8);
    this.messageTime -= dt;
    if (this.messageTime <= 0) this.message = '';
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const ammo = reloadAmmo(
          this.ammo,
          this.reserve,
          WEAPONS[this.weapon].mag
        );
        this.ammo = ammo.ammo;
        this.reserve = ammo.reserve;
        this.reloadTimer = 0;
        this.audio.reload();
      }
    }
    const k = this.input.keys;
    if(k.has('KeyG')){k.delete('KeyG');this.toggleVehicle();}
    if(k.has('KeyV')&&this.vehicle.driving){k.delete('KeyV');this.changeVehicleCamera();}
    let rx =
        this.input.move.x + (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0),
      forward =
        -this.input.move.y + (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    let mag = Math.hypot(rx, forward);
    if (mag > 1) {
      rx /= mag;
      forward /= mag;
      mag = 1;
    }
    if (k.has('ArrowLeft')) this.yaw += dt * 1.6;
    if (k.has('ArrowRight')) this.yaw -= dt * 1.6;
    if (k.has('ArrowUp')) this.pitch = clamp(this.pitch + dt, -1.15, 1.15);
    if (k.has('ArrowDown')) this.pitch = clamp(this.pitch - dt, -1.15, 1.15);
    const sprint =
      (this.input.sprinting ||
        k.has('ShiftLeft') ||
        k.has('Space') ||
        Math.hypot(this.input.move.x, this.input.move.y) > 0.92) &&
      !this.input.aiming &&
      !this.input.firing;
    const speed = this.input.crouching
      ? 2
      : this.input.aiming
        ? 3.3
        : sprint
          ? 8.5
          : 5.2;
    if(this.vehicle.driving){
      this.vehicle.step(dt,rx,this.vehicleThrottle||forward,this.vehicleBrake,this.player,this.world.obstacles);this.yaw=this.vehicle.car.heading;
    }else moveCircle(
      this.player,
      (Math.cos(this.yaw) * rx - Math.sin(this.yaw) * forward) * speed * dt,
      (-Math.sin(this.yaw) * rx - Math.cos(this.yaw) * forward) * speed * dt,
      0.34,
      this.world.obstacles
    );
    this.movement = THREE.MathUtils.lerp(this.movement, mag, dt * 8);
    if (mag > 0.1) {
      this.footsteps += dt * speed;
      if (this.footsteps > 1.65) {
        this.footsteps = 0;
        this.audio.step();
      }
    }
    if (this.settings.assist && (this.input.aiming || this.input.firing))
      this.assist(dt);
    this.updateCamera(dt);
    if (this.input.firing || k.has('KeyF')) this.shoot();
    if (this.elapsed - this.lastDamage > 6 && this.health < this.maxHealth)
      this.health = Math.min(this.maxHealth, this.health + dt * 4);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.updateLoot(dt);
    if (this.phase !== 'playing') return;
    if(this.battleMode==='last-stand'){
      const radius=zoneRadius(this.elapsed);
      if(Math.hypot(this.player.x-this.sectorCenter.x,this.player.z-this.sectorCenter.z)>radius)this.damage(dt*9);
      for(const e of this.enemies)if(e.hp>0&&Math.hypot(e.group.position.x-this.sectorCenter.x,e.group.position.z-this.sectorCenter.z)>radius)e.hp=Math.max(0,e.hp-dt*9);
      if(this.phase==='playing'&&this.enemies.length&&this.enemies.every(e=>e.hp<=0))this.finish(true);
      return;
    }
    const objective=advanceBattleObjective({progress:this.objectiveProgress,intel:this.intel,extracting:this.extraction,extraction:this.extractProgress},{
      mode:this.battleMode,elapsed:this.elapsed,wave:this.wave,health:this.health,driving:this.vehicle.driving,lastDamage:this.lastDamage,
      player:this.player,center:this.sectorCenter,intelPoint:this.intelPoint,extractionPoint:this.extractionPoint,
      enemies:this.enemies.map(e=>({x:e.group.position.x,z:e.group.position.z,hp:e.hp}))
    },dt);
    this.objectiveProgress=objective.progress;this.intel=objective.intel;this.extraction=objective.extracting;this.extractProgress=objective.extraction;
    if(objective.extractionOpened){this.world.extraction.visible=true;this.notify(objective.intelSecured?'INTEL SECURED · REACH EXTRACTION':'BLOCK SECURED / REACH EXTRACTION','good',4);this.audio.victory();}
    if(objective.status==='won'||objective.status==='lost'){this.finish(objective.status==='won');return;}
    if(objective.status==='reinforce')this.spawnWave();
    if(objective.status==='upgrade'){
      this.phase='upgrade';this.input.active=false;this.input.clear();
      if(document.pointerLockElement)document.exitPointerLock();this.audio.victory();this.emit();
    }
  }
  private assist(dt: number) {
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')
    );
    let best: Enemy | undefined,
      angle = 0.105;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const target = new THREE.Vector3(
        e.group.position.x,
        e.group.position.y+1.5,
        e.group.position.z
      );
      const d = target.clone().sub(this.camera.position);
      const a = forward.angleTo(d);
      if (
        a < angle &&
        lineClear(this.camera.position, target, this.world.obstacles)
      ) {
        angle = a;
        best = e;
      }
    }
    if (best) {
      const d = new THREE.Vector3(
        best.group.position.x,
        best.group.position.y+1.5,
        best.group.position.z
      ).sub(this.camera.position);
      const targetYaw = Math.atan2(-d.x, -d.z);
      let difference =
        THREE.MathUtils.euclideanModulo(
          targetYaw - this.yaw + Math.PI,
          2 * Math.PI
        ) - Math.PI;
      this.yaw += difference * Math.min(0.08, dt * 2);
      const targetPitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      this.pitch += (targetPitch - this.pitch) * Math.min(0.07, dt * 1.8);
    }
  }
  private updateEnemy(e: Enemy, dt: number) {
    e.flashTime=Math.max(0,e.flashTime-dt);e.flash.visible=e.flashTime>0;
    e.hurt=Math.max(0,e.hurt-dt);
    if(e.hp<=0){
      e.state='dead';e.anim='dead';e.deadTime+=dt;
      e.group.rotation.z=THREE.MathUtils.lerp(e.group.rotation.z,1.48,1-Math.exp(-dt*7));
      e.group.position.y=THREE.MathUtils.lerp(e.group.position.y,battleGround(e.group.position.x,e.group.position.z)-.1,1-Math.exp(-dt*3));
      if(e.deadTime>4)e.group.visible=false;return;
    }
    const p=e.group.position,brain=e.brain ||=createBrain(String(e.id));
    const clear=(a:Vec2,b:Vec2)=>lineClear(new THREE.Vector3(a.x,battleGround(a.x,a.z)+1.5,a.z),new THREE.Vector3(b.x,battleGround(b.x,b.z)+1.5,b.z),this.battleObstacles);
    const opponents=[{id:'player',...this.player,hp:this.health},...(this.battleMode==='last-stand'?this.enemies.filter(o=>o!==e&&o.hp>0).map(o=>({id:String(o.id),x:o.group.position.x,z:o.group.position.z,hp:o.hp})):[])];
    const teammates=this.battleMode==='last-stand'?[]:this.enemies.filter(o=>o!==e&&o.hp>0).map(o=>({id:String(o.id),x:o.group.position.x,z:o.group.position.z,health:o.hp,lastSeen:o.brain?.lastSeen||undefined,lastSeenAt:o.brain?.seenAt}));
    const observed=opponents.find(o=>Math.hypot(o.x-p.x,o.z-p.z)<65&&clear(p,o));
    const covers=this.battleObstacles.filter(c=>c.h>1.1&&Math.hypot(c.x-p.x,c.z-p.z)<22).map((c,i)=>({...c,id:String(i),heading:c.rot||0,speed:0}));
    const coverTargets=covers.map(c=>coverPoint(c,observed||brain.lastSeen||this.sectorCenter,e.id,false)).filter(c=>!collides(c.x,c.z,.5,this.battleObstacles));
    const decision=thinkBot(brain,{id:String(e.id),x:p.x,z:p.z,hp:e.hp},opponents,this.elapsed,dt,clear,this.sectorCenter,{
      mode:this.battleMode,zoneRadius:zoneRadius(this.elapsed),intelCollected:this.intel,intelPoint:this.intelPoint,extractionPoint:this.extractionPoint,
      covers:coverTargets,reports:this.battleMode==='last-stand'?[]:this.enemies.filter(o=>o!==e&&o.hp>0&&o.brain).map(o=>o.brain!),noise:this.gunNoise,
      loot:this.loot.map((l,i)=>({id:String(i),x:l.mesh.position.x,z:l.mesh.position.z,ammo:l.ammo}))
    });
    if(decision.heal)e.hp=Math.min(this.wave===3?115:100,e.hp+decision.heal);
    if(decision.pickup!==null){
      const index=Number(decision.pickup),item=this.loot[index];
      if(item&&Math.hypot(item.mesh.position.x-p.x,item.mesh.position.z-p.z)<1.55){
        brain.reserve+=item.ammo;this.scene.remove(item.mesh);item.mesh.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});this.loot.splice(index,1);
      }
    }
    e.cooldown-=dt;e.repath-=dt;
    const observer={id:String(e.id),x:p.x,z:p.z,health:e.hp,kind:'police',coverId:e.coverId,lastSeen:e.lastSeen,lastSeenAt:e.lastSeenAt};
    const tactic=decision.target&&!decision.priority?tacticalGoal(observer,decision.target,teammates,covers,this.elapsed,clear):{goal:decision.goal,anim:decision.state==='heal'?'cover':'run',coverId:undefined};
    e.lastSeen=brain.lastSeen||undefined;e.lastSeenAt=brain.seenAt;e.coverId=tactic.coverId;
    let goal=tactic.goal;
    if(e.detour&&this.elapsed<(e.detourUntil||0)&&Math.hypot(p.x-e.detour.x,p.z-e.detour.z)>.6)goal=e.detour;
    else e.detour=undefined;
    const reloading=brain.reload>0;
    const movement=Math.hypot(goal.x-p.x,goal.z-p.z)>.8&&(decision.priority||!decision.target||tactic.anim==='run'||tactic.anim==='walk');
    e.state=movement?'advance':reloading||tactic.anim==='cover'||decision.state==='heal'?'cover':'fire';
    e.anim=e.state==='advance'?'run':e.state==='cover'?'cover':'aim';
    if(movement){
      if(e.repath<=0||!e.pathGoal||Math.hypot(goal.x-e.pathGoal.x,goal.z-e.pathGoal.z)>6){e.repath=1.3+(e.id%5)*.13;e.path=findPath(p,goal,this.battleObstacles);e.pathGoal={...goal};}
      const next=e.path[0]||goal,dx=next.x-p.x,dz=next.z-p.z,d=Math.hypot(dx,dz);
      if(d>.12){
        const before={x:p.x,z:p.z};moveCircle(p,dx/d*dt*4.1,dz/d*dt*4.1,.4,this.battleObstacles);
        const travel=Math.hypot(p.x-before.x,p.z-before.z);e.walk+=travel*2.4;
        e.stuck=travel<.003?(e.stuck||0)+dt:0;
        if(e.stuck>1.5){
          for(let i=0;i<8;i++){const a=(i+e.id)*Math.PI/4,q={x:p.x+Math.sin(a)*3,z:p.z+Math.cos(a)*3};
            if(!collides(q.x,q.z,.5,this.battleObstacles)&&findPath(p,q,this.battleObstacles).length){e.detour=q;e.detourUntil=this.elapsed+2;break;}}
          e.repath=0;e.path=[];e.stuck=0;
        }
        e.group.rotation.y=Math.atan2(-dx,-dz);
      }
      if(d<.6)e.path.shift();
    }
    if(decision.target&&!movement)e.group.rotation.y=Math.atan2(p.x-decision.target.x,p.z-decision.target.z);
    for(let i=0;i<2;i++)e.legs[i].rotation.x=Math.sin(e.walk+i*Math.PI)*(movement?.52:.025);
    e.group.position.y=battleGround(p.x,p.z)+(e.state==='cover'?-.35:0)+(movement?Math.sin(e.walk*2)*.025:0);
    e.group.rotation.x=e.hurt>0?-e.hurt*.5:0;
    for(const other of this.enemies)if(other!==e&&other.hp>0){const dx=p.x-other.group.position.x,dz=p.z-other.group.position.z,d=Math.hypot(dx,dz);if(d>.001&&d<.9)moveCircle(p,dx/d*(.9-d)*.4,dz/d*(.9-d)*.4,.4,this.battleObstacles);}
    if(!decision.target||!decision.fire||e.state!=='fire'||e.cooldown>0||!clear(p,decision.target))return;
    // A teammate in the firing lane blocks the shot; no friendly-fire wallhacks.
    const tx=decision.target.x-p.x,tz=decision.target.z-p.z,length=Math.hypot(tx,tz);
    const blocker=this.enemies.some(o=>o!==e&&o.hp>0&&String(o.id)!==decision.target!.id&&(()=>{const dx=o.group.position.x-p.x,dz=o.group.position.z-p.z,t=(dx*tx+dz*tz)/(length*length||1);return t>.02&&t<.98&&Math.abs(dx*tz-dz*tx)/(length||1)<.5;})());
    if(blocker)return;
    brain.ammo--;e.cooldown=(this.difficulty==='recruit'?.65:.42)+this.rng()*.4;e.flashTime=.08;
    const gun=new THREE.Vector3();e.flash.getWorldPosition(gun);
    const target=new THREE.Vector3(decision.target.x,battleGround(decision.target.x,decision.target.z)+1.25,decision.target.z);
    this.combatEffects.shot(gun,target);
    const accuracy=(this.difficulty==='recruit'?.42:.64)*Math.max(.35,1-length/95)*(decision.target.id==='player'&&this.movement>.3?.65:1);
    if(this.rng()<accuracy){
      if(decision.target.id==='player')this.damage(this.difficulty==='recruit'?8:11);
      else{const victim=this.enemies.find(o=>String(o.id)===decision.target!.id);if(victim){victim.hp=Math.max(0,victim.hp-18);victim.hurt=.25;}}
    }
  }
  setVehiclePedal(pedal:'gas'|'reverse'|'brake',pressed:boolean){
    if(pressed&&(!this.vehicle.driving||this.phase!=='playing'))return;
    if(pressed)this.vehiclePedals.add(pedal);else this.vehiclePedals.delete(pedal);
    this.vehicleThrottle=this.vehiclePedals.has('gas')?1:this.vehiclePedals.has('reverse')?-1:0;
    this.vehicleBrake=this.vehiclePedals.has('brake');
  }
  toggleVehicle(){
    if(this.online||this.phase!=='playing')return;
    if(!this.vehicle.toggle(this.player,this.world.obstacles)){this.notify('Stop the car with space beside the door','',2);return;}
    this.input.clear();this.vehiclePedals.clear();this.vehicleThrottle=0;this.vehicleBrake=false;this.world.gun.visible=!this.vehicle.driving;
    this.emit();
  }
  changeVehicleCamera(){
    if(!this.vehicle.driving||this.phase!=='playing')return;
    this.vehicle.view=this.vehicle.view==='chase'?'cockpit':'chase';this.vehicle.present();this.emit();
  }
  private updateCamera(dt: number) {
    if(this.vehicle.driving){this.vehicle.camera(this.camera,this.world.obstacles);return;}
    this.world.gun.visible=true;this.camera.up.set(0,1,0);this.camera.near=.1;
    this.aim = THREE.MathUtils.lerp(
      this.aim,
      this.input.aiming ? 1 : 0,
      Math.min(1, dt * 13)
    );
    const height = battleGround(this.player.x,this.player.z)+(this.input.crouching ? 0.86 : 1.68);
    this.camera.position.x = this.player.x;
    this.camera.position.z = this.player.z;
    this.camera.position.y = THREE.MathUtils.lerp(
      this.camera.position.y || 1.68,
      height,
      Math.min(1, dt * 12)
    );
    this.camera.position.y +=
      Math.sin(this.elapsed * 10) * 0.0018 * this.movement;
    this.camera.rotation.set(
      this.pitch + this.recoil,
      this.yaw,
      Math.sin(this.elapsed * 5) * 0.0015 * this.movement,
      'YXZ'
    );
    const portrait = this.camera.aspect < 0.85;
    const fov = (portrait ? 78 : 70) - this.aim * 19;
    if (Math.abs(this.camera.fov - fov) > 0.1) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    const reloadDuration = WEAPONS[this.weapon].reload * this.reloadMultiplier,
      reloadP =
        this.reloadTimer > 0
          ? Math.sin((1 - this.reloadTimer / reloadDuration) * Math.PI)
          : 0;
    const gun = this.world.gun;
    const hipX = portrait ? 0.18 : 0.25;
    gun.position.set(
      THREE.MathUtils.lerp(hipX, 0, this.aim) +
        Math.sin(this.elapsed * 7) * 0.006 * this.movement +
        this.swayX,
      THREE.MathUtils.lerp(-0.29, -0.19, this.aim) +
        Math.cos(this.elapsed * 14) * 0.003 * this.movement -
        reloadP * 0.25 +
        this.swayY,
      THREE.MathUtils.lerp(-0.64, -0.5, this.aim) + this.kick + reloadP * 0.11
    );
    gun.rotation.set(this.kick * 0.6 - reloadP * 0.32, 0, reloadP * -0.6);
    gun.scale.setScalar(this.weapon === 'smg' ? 0.9 : 1);
    this.world.muzzle.visible =
      this.cooldown > WEAPONS[this.weapon].interval - 0.045;
    this.world.gunLight.intensity = this.world.muzzle.visible ? 2 : 0;
  }
  private loop = (now: number) => {
    if (this.disposed) return;
    const realDt = this.previous
      ? Math.max(0, (now - this.previous) / 1000)
      : 1 / 60;
    const dt = Math.min(0.075, realDt);
    this.previous = now;
    this.totalTime += dt;
    this.fpsTime += realDt;
    this.fpsFrames++;
    if (this.fpsTime >= 1) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsTime = 0;
      this.fpsFrames = 0;
      if (this.settings.quality === 'auto' && this.totalTime > 6) {
        this.lowSamples =
          this.fps < 34
            ? this.lowSamples + 1
            : Math.max(0, this.lowSamples - 1);
        if (this.lowSamples >= 4 && this.quality > 0.6) {
          this.quality = Math.max(0.6, this.quality - 0.15);
          this.lowSamples = 0;
          this.applyQuality();
        }
      }
    }
    if (this.phase === 'playing') {
      this.accumulator += dt;
      let steps = 0;
      while (
        this.accumulator >= 1 / 60 &&
        steps < 5 &&
        this.phase === 'playing'
      ) {
        this.physics(1 / 60);
        this.accumulator -= 1 / 60;
        steps++;
      }
    } else this.accumulator = 0;
    if (this.phase === 'menu') {
      this.camera.position.set(
        START.x + 2.1 + Math.sin(this.totalTime * 0.09) * 1.4,
        1.85,
        START.z + 5
      );
      this.camera.rotation.set(
        0.015,
        -0.1 + Math.sin(this.totalTime * 0.075) * 0.075,
        0,
        'YXZ'
      );
      this.camera.fov = this.camera.aspect < 0.85 ? 77 : 66;
      this.camera.updateProjectionMatrix();
      this.world.gun.position.set(
        this.camera.aspect < 0.85 ? 0.16 : 0.25,
        -0.29 + Math.sin(this.totalTime) * 0.004,
        -0.64
      );
      this.world.gun.rotation.set(0, 0, 0);
      this.world.muzzle.visible = false;
      this.world.gunLight.intensity = 0;
    }
    if (this.phase === 'playing' || this.phase === 'menu') {
      const a = this.world.rainData;
      for (let i = 0; i < a.length; i += 6) {
        a[i + 1] -= dt * 11;
        a[i + 4] -= dt * 11;
        if (a[i + 1] < 0) {
          a[i + 1] = 22;
          a[i + 4] = 22.38;
        }
      }
      (
        this.world.rain.geometry.getAttribute(
          'position'
        ) as THREE.BufferAttribute
      ).needsUpdate = true;
      for (let i = this.effects.length - 1; i >= 0; i--) {
        const e = this.effects[i];
        e.life -= dt;
        if (e.life <= 0) {
          this.scene.remove(e.mesh);
          this.effects.splice(i, 1);
        } else {
          e.mesh.position.addScaledVector(e.velocity, dt);
          e.velocity.y -= dt * 6;
        }
      }
    }
    this.vehicle.present();
    const showObjective=!this.online&&this.phase==='playing';
    this.zoneRing.visible=showObjective&&(this.battleMode==='last-stand'||this.battleMode==='hold');
    this.zoneRing.position.set(this.sectorCenter.x,battleGround(this.sectorCenter.x,this.sectorCenter.z)+.15,this.sectorCenter.z);
    this.zoneRing.scale.setScalar(this.battleMode==='hold'?10:zoneRadius(this.elapsed));
    this.missionBeacon.visible=showObjective&&(this.battleMode==='hold'||this.battleMode==='extraction'&&!this.intel);
    const beacon=this.battleMode==='hold'?this.sectorCenter:this.intelPoint;
    this.missionBeacon.position.set(beacon.x,battleGround(beacon.x,beacon.z)+7,beacon.z);
    this.combatEffects.update(this.phase === 'playing' ? dt : 0,this.camera,[],[],this.settings.quality==='low');
    this.world.update?.(this.camera.position);
    this.world.sky.position.set(
      this.camera.position.x,
      0,
      this.camera.position.z
    );
    this.world.rain.position.set(
      this.camera.position.x,
      0,
      this.camera.position.z
    );
    this.forces?.update(this.enemies, this.player, this.totalTime, dt, this.settings.quality === 'low');
    this.renderer.render(this.scene, this.camera);
    this.uiTime += dt;
    if (this.uiTime > 0.1) {
      this.uiTime = 0;
      this.emit();
    }
    this.frame = requestAnimationFrame(this.loop);
  };
  snapshot(): Snapshot {
    return {
      phase: this.phase,
      driving:this.vehicle.driving,nearVehicle:!this.online&&this.vehicle.near(this.player),vehicleView:this.vehicle.view,vehicleSpeed:Math.round(Math.abs(this.vehicle.car.speed)*3.6),
      battleMode:this.battleMode,operations:[...this.operations.completed],operationId:this.operationId,
      extractionPoint:this.extractionPoint,objectivePoint:this.battleMode==='hold'?this.sectorCenter:this.battleMode==='extraction'&&!this.intel?this.intelPoint:undefined,zoneCenter:this.sectorCenter,
      objectiveProgress:this.objectiveProgress,zone:zoneRadius(this.elapsed),
      objective:this.battleMode==='last-stand'?'Be the last operator alive':this.battleMode==='hold'?`Hold the beacon · ${Math.floor(this.objectiveProgress)}/45 s`:this.battleMode==='extraction'?!this.intel?'Collect intel at the beacon':'Extract with the intel':this.extraction?'Reach extraction':'Clear the district',
      health: Math.ceil(this.health),
      maxHealth: this.maxHealth,
      ammo: this.ammo,
      reserve: this.reserve,
      kills: this.kills,
      wave: this.wave,
      remaining: this.enemies.filter((e) => e.hp > 0).length,
      score: this.score,
      time: Math.floor(this.elapsed),
      fps: this.fps,
      reload: this.reloadTimer,
      aim: this.input?.aiming ?? false,
      crouch: this.input?.crouching ?? false,
      heading: Math.round(
        THREE.MathUtils.euclideanModulo((-this.yaw * 180) / Math.PI, 360)
      ),
      extract: this.extraction,
      extraction: this.extractProgress,
      distance: Math.round(
        Math.hypot(this.player.x - this.extractionPoint.x, this.player.z - this.extractionPoint.z)
      ),
      hit: this.hit,
      hurt: this.hurt,
      message: this.message,
      messageKind: this.messageKind,
      medkits: this.medkits,
      weapon: this.weapon,
      shots: this.shots,
      hits: this.hits,
      x: this.player.x,
      z: this.player.z,
      enemies: this.enemies.map((e) => ({
        x: e.group.position.x,
        z: e.group.position.z,
        alive: e.hp > 0
      })),
      quality: this.quality,
      ready: true,
      best: this.best,
      compatibility: this.renderer instanceof CompatibilityRenderer,
      online: this.onlineState
    };
  }
  connectOnline(transport: OnlineTransport) {
    this.online = transport;
    this.networkSeq = 0;
    this.start(this.weapon, 'recruit');
    this.clearActors();
    this.notify('CONNECTING TO TPG MATCH', 'wave', 20);
  }
  acceptOnlineState(state: OnlineState) {
    if (!this.online) return;
    const me = state.players.find((p) => p.id === this.online!.playerId);
    if (!me) return;
    const previous = this.onlineState?.players.find((p) => p.id === me.id);
    this.onlineState = state;
    if (
      !previous ||
      (me.hp > 0 && previous.hp <= 0) ||
      Math.hypot(this.player.x - me.x, this.player.z - me.z) > 3
    ) {
      this.player = { x: me.x, z: me.z };
      this.remoteTarget = null;
    } else this.remoteTarget = { x: me.x, z: me.z };
    if (previous && me.hp < previous.hp) {
      this.hurt = 1;
      this.audio.hurt();
    }
    if (previous && me.shots > previous.shots) {
      this.recoil = Math.min(
        0.07,
        this.recoil + WEAPONS[me.weapon].recoil * 0.55
      );
      this.kick = 0.04;
      this.world.muzzle.visible = true;
      this.world.gunLight.intensity = 2;
      this.audio.shot();
    }
    if (previous && me.hits > previous.hits) {
      this.hit = 1;
      this.audio.hit();
    }
    if (previous && me.kills > previous.kills) {
      this.audio.kill();
      this.notify('ELIMINATION CONFIRMED', 'kill', 1.5);
    }
    this.health = me.hp;
    this.weapon = me.weapon;
    this.ammo = me.ammo;
    this.reserve = me.reserve;
    this.kills = me.kills;
    this.shots = me.shots;
    this.hits = me.hits;
    this.medkits = me.medkits;
    this.reloadTimer = me.reload;
    this.elapsed = state.elapsed;
    this.score = me.kills * 100;
    for (const other of state.players.filter((p) => p.id !== me.id)) {
      let e = this.enemies.find((e) => e.networkId === other.id);
      if (!e) {
        e = {
          ...makeEnemy(),
          networkId: other.id,
          id: this.enemies.length,
          hp: 100,
          cooldown: 0,
          path: [],
          repath: 0,
          deadTime: 0,
          state: 'advance',
          flashTime: 0,
          walk: 0,
          hurt: 0
        };
        this.enemies.push(e);
        this.scene.add(e.group);
      }
      e.hp = other.hp;
      if (!e.networkTarget) e.group.position.set(other.x, 0, other.z);
      e.networkTarget = { x: other.x, z: other.z };
      e.networkYaw = other.yaw;
      if (other.shotSerial > (e.lastRemoteShot ?? other.shotSerial)) {
        e.flashTime = 0.08;
        this.audio.burst(0.06, 1500, 0.02);
      }
      e.lastRemoteShot = other.shotSerial;
      e.group.scale.y = other.crouch ? 0.52 : 1;
      e.group.visible = other.hp > 0 && !other.forfeited;
    }
    if (state.status === 'finished') {
      this.phase = state.winnerAccountId === me.id ? 'won' : 'lost';
      this.input.active = false;
      this.input.clear();
    } else if (state.status === 'waiting')
      this.notify('WAITING FOR OPERATORS TO LOAD', 'wave', 2);
    else if (state.status === 'countdown')
      this.notify(
        `DEPLOYING IN ${Math.max(1, Math.ceil((state.startsAt - state.serverNow) / 1000))}`,
        'wave',
        2
      );
    else if (me.hp <= 0)
      this.notify(
        state.rule==='last-stand'?'ELIMINATED · WAITING FOR THE LAST SURVIVOR':`RESPAWNING IN ${Math.max(1, Math.ceil(me.respawn))}`,
        'warning',
        2
      );
    this.input.active =
      this.phase === 'playing' && state.status === 'playing' && me.hp > 0;
    this.emit();
  }
  private onlineControls() {
    const k = this.input.keys;
    let rx =
        this.input.move.x + (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0),
      forward =
        -this.input.move.y + (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const n = Math.hypot(rx, forward);
    if (n > 1) {
      rx /= n;
      forward /= n;
    }
    const active = this.input.active && this.phase === 'playing';
    return {
      rx: active ? rx : 0,
      forward: active ? forward : 0,
      yaw: this.yaw,
      pitch: this.pitch + this.recoil,
      fire: active && (this.input.firing || k.has('KeyF')),
      aim: this.input.aiming,
      crouch: this.input.crouching,
      sprint:
        active &&
        (this.input.sprinting ||
          k.has('ShiftLeft') ||
          k.has('Space') ||
          Math.hypot(this.input.move.x, this.input.move.y) > 0.92),
      reload: active && this.pendingReload,
      heal: active && this.pendingHeal
    };
  }
  private sendOnlineInput() {
    if (!this.online) return;
    this.online.send({ ...this.onlineControls(), seq: ++this.networkSeq });
    this.pendingReload = this.pendingHeal = false;
  }
  private onlinePhysics(dt: number) {
    for (const e of this.enemies) {
      if (!e.networkTarget) continue;
      const p = e.group.position,
        t = e.networkTarget,
        dx = (t.x - p.x) * Math.min(1, dt * 18),
        dz = (t.z - p.z) * Math.min(1, dt * 18);
      p.x += dx;
      p.z += dz;
      e.group.rotation.y = e.networkYaw ?? 0;
      e.walk += Math.hypot(dx, dz) * 3.5;
      for (let i = 0; i < 2; i++)
        e.legs[i].rotation.x = Math.sin(e.walk + i * Math.PI) * 0.35;
      e.flashTime = Math.max(0, e.flashTime - dt);
      e.flash.visible = e.flashTime > 0;
    }
    this.hit = Math.max(0, this.hit - dt * 5);
    this.hurt = Math.max(0, this.hurt - dt * 1.5);
    this.recoil *= Math.exp(-dt * 12);
    this.kick *= Math.exp(-dt * 15);
    this.messageTime -= dt;
    if (this.messageTime <= 0) this.message = '';
    const k = this.input.keys;
    if (this.input.active) {
      if (k.has('ArrowLeft')) this.yaw += dt * 1.6;
      if (k.has('ArrowRight')) this.yaw -= dt * 1.6;
      if (k.has('ArrowUp')) this.pitch = clamp(this.pitch + dt, -1.15, 1.15);
      if (k.has('ArrowDown')) this.pitch = clamp(this.pitch - dt, -1.15, 1.15);
    }
    const c = this.onlineControls(),
      speed = c.crouch ? 2 : c.aim ? 3.3 : c.sprint && !c.fire ? 8.5 : 5.2;
    moveCircle(
      this.player,
      (Math.cos(this.yaw) * c.rx - Math.sin(this.yaw) * c.forward) * speed * dt,
      (-Math.sin(this.yaw) * c.rx - Math.cos(this.yaw) * c.forward) *
        speed *
        dt,
      0.34,
      this.world.obstacles
    );
    if (this.remoteTarget) {
      const t = this.remoteTarget,
        dx = t.x - this.player.x,
        dz = t.z - this.player.z;
      moveCircle(
        this.player,
        dx * Math.min(1, dt * 8),
        dz * Math.min(1, dt * 8),
        0.34,
        this.world.obstacles
      );
    }
    this.movement = Math.hypot(c.rx, c.forward);
    if (this.settings.assist && this.input.active && (c.aim || c.fire))
      this.assist(dt);
    this.updateCamera(dt);
    this.networkTime += dt;
    if (this.networkTime >= 0.05) {
      this.networkTime = 0;
      this.sendOnlineInput();
    }
  }
  private emit() {
    this.callback(this.snapshot());
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.size.disconnect();
    this.input.dispose();
    this.audio.dispose();
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.contextLost
    );
    this.clearActors();
    this.forces?.dispose();
    this.combatEffects.dispose();this.vehicle.dispose();this.zoneRing.geometry.dispose();this.zoneRing.material.dispose();this.missionBeacon.geometry.dispose();this.missionBeacon.material.dispose();
    this.world.dispose();
    this.tracerGeo.dispose();
    this.sparkGeo.dispose();
    this.tracerMat.dispose();
    this.sparkMat.dispose();
    this.renderer.dispose();
  }
}
