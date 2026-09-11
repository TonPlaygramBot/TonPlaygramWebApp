import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {COLLECTION_DRIVER_URL, collectionVehicleFor, type CollectionVehicle} from './shared/vehicleCollection.mjs';
import {createNpcVehicleDriver} from './NpcVehicleDriver';
import {clearWeaponInstance, disposeWeaponResources} from './weaponModelResources';

export type CollectionCar = {
  id:string; collectionVehicle?:string; x:number; z:number; heading:number;
  driver?:string|null; npcDriver?:boolean;
};
type Actor = {root:T.Group; driver:T.Group; assetId:string};
type Source = {root:T.Group; used:number};
type Options = {range?:number; maxVisible?:number};

/** Demand loading and shared caches bound memory on phones. Every visible car
 * uses the approved full mesh/PBR maps, including battery mode: no LOD swaps,
 * geometry decimation, recolouring or texture resizing. */
export class CollectionVehicleVisuals {
  readonly group = new T.Group();
  readonly errors = new Map<string,string>();
  private draco = new DRACOLoader().setDecoderPath('/assets/tirana-streets/imported/draco/').setWorkerLimit(1);
  private loader = new GLTFLoader().setDRACOLoader(this.draco);
  private sources = new Map<string,Source>();
  private actors = new Map<string,Actor>();
  private pending = new Map<string,AbortController>();
  private desired = new Map<string,CollectionVehicle>();
  private human?:T.Group;
  private dead=false;
  private frame=0;
  private readonly range:number;
  private readonly maxVisible:number;
  constructor(options:Options={}) {
    this.range=options.range??180;this.maxVisible=options.maxVisible??8;
    this.group.name='Tirana:original-ten-car-collection';
    this.group.userData.quality='Original GLB geometry and PBR maps; no LOD reduction';
  }
  has(id:string){return this.actors.has(id);}
  getRoot(id:string){return this.actors.get(id)?.root;}
  get loadedCount(){return this.actors.size;}
  retryFailed(){this.errors.clear();this.pump();}

  private pump() {
    if(this.dead)return;
    if(this.desired.size&&!this.human&&!this.pending.has('driver')&&!this.errors.has('driver'))void this.load('driver',COLLECTION_DRIVER_URL);
    for(const asset of this.desired.values()){
      if(this.pending.size>=2)break;
      if(!this.sources.has(asset.id)&&!this.pending.has(asset.id)&&!this.errors.has(asset.id))void this.load(asset.id,asset.url);
    }
  }
  private async load(id:string,url:string) {
    const abort=new AbortController();this.pending.set(id,abort);
    const timer=setTimeout(()=>abort.abort(),60000);
    let root:T.Group|undefined;
    try {
      const response=await fetch(url,{signal:abort.signal});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const bytes=await response.arrayBuffer();
      if(this.dead)return;
      root=(await this.loader.parseAsync(bytes,url.slice(0,url.lastIndexOf('/')+1))).scene;
      if(this.dead){disposeWeaponResources([root]);return;}
      if(id==='driver')this.human=root;
      else {
        root.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
        this.sources.set(id,{root,used:this.frame});
      }
      root=undefined;
      this.trim();
    } catch(error) {
      if(root)disposeWeaponResources([root]);
      if(!this.dead)this.errors.set(id,String(error));
    } finally {
      clearTimeout(timer);this.pending.delete(id);
      // Let in-flight decoding settle before terminating its worker on disposal.
      if(this.dead&&this.pending.size===0)this.draco.dispose();
      else this.pump();
    }
  }
  update(cars:readonly CollectionCar[], viewer:{x:number;z:number}, dt:number, playerCarId?:string|null) {
    if(this.dead)return;
    this.frame++;
    const distance=(c:CollectionCar)=>Math.hypot(c.x-viewer.x,c.z-viewer.z);
    const selected=cars.filter(c=>collectionVehicleFor(c)&&Number.isFinite(c.x)&&Number.isFinite(c.z)&&distance(c)<this.range)
      .sort((a,b)=>Number(b.id===playerCarId)-Number(a.id===playerCarId)||distance(a)-distance(b)||a.id.localeCompare(b.id)).slice(0,this.maxVisible);
    const keep=new Set(selected.map(c=>c.id));
    for(const id of this.actors.keys())if(!keep.has(id))this.remove(id);
    this.desired=new Map(selected.map(c=>{const a=collectionVehicleFor(c)!;return[a.id,a];}));
    for(const car of selected){
      const asset=collectionVehicleFor(car)!,source=this.sources.get(asset.id);
      let actor=this.actors.get(car.id);
      if(actor&&actor.assetId!==asset.id){this.remove(car.id);actor=undefined;}
      if(!source||!this.human)continue;
      source.used=this.frame;
      if(!actor){
        const root=new T.Group();root.name=car.id;
        root.userData={collectionVehicle:asset.id,sourceURL:asset.url,sha256:asset.sha256};
        root.add(clone(source.root));
        const driver=createNpcVehicleDriver(this.human,asset,car.id);root.add(driver);
        actor={root,driver,assetId:asset.id};this.actors.set(car.id,actor);this.group.add(root);
        root.position.set(car.x,.03,car.z);root.rotation.y=car.heading+Math.PI/2;
      }
      const alpha=1-Math.exp(-Math.max(0,dt)*18);
      actor.root.position.lerp(new T.Vector3(car.x,.03,car.z),alpha);
      actor.root.rotation.y+=Math.atan2(Math.sin(car.heading+Math.PI/2-actor.root.rotation.y),Math.cos(car.heading+Math.PI/2-actor.root.rotation.y))*alpha;
      // Waiting NPCs yield the seat when a player takes control. Player state is
      // authoritative; no NPC remains superimposed on a player or FPS camera.
      actor.driver.visible=car.npcDriver!==false&&!car.driver;
    }
    this.trim();this.pump();
    this.group.userData.loadedCars=this.actors.size;
    this.group.userData.errors=Object.fromEntries(this.errors);
  }
  private remove(id:string){
    const actor=this.actors.get(id);if(!actor)return;
    clearWeaponInstance(actor.root);actor.root.removeFromParent();this.actors.delete(id);
  }
  private trim(){
    const live=new Set([...this.actors.values()].map(a=>a.assetId));
    for(const [id,source] of [...this.sources].sort((a,b)=>a[1].used-b[1].used)){
      if(this.sources.size<=4)break;
      if(live.has(id)||this.desired.has(id))continue;
      disposeWeaponResources([source.root]);this.sources.delete(id);
    }
  }
  dispose(){
    if(this.dead)return;this.dead=true;
    for(const a of this.pending.values())a.abort();
    for(const id of this.actors.keys())this.remove(id);
    disposeWeaponResources([...this.sources.values()].map(s=>s.root));this.sources.clear();
    if(this.human)disposeWeaponResources([this.human]);this.human=undefined;
    this.desired.clear();this.group.removeFromParent();
    if(!this.pending.size)this.draco.dispose();
  }
}
