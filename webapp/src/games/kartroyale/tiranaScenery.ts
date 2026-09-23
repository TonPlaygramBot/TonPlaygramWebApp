import * as T from 'three';
import { TiranaCityScene } from '../tiranastreets/TiranaCityScene';
import { TurnGuideLayer } from './TurnGuideLayer';
import { publishAtlas, clearAtlas } from './raceAtlasStore';
import {RURAL_WORLD} from './ruralWorldData.mjs';
import {RuralScenery} from './RuralScenery';
import type { Track } from './simulation.mjs';
export { inside, occupied } from './baseTiranaScenery';

/** No replacement shells, changed footprints, rescaled map or clipped buildings. */
export class TiranaScenery {
  readonly shared: TiranaCityScene;
  readonly group: T.Group;
  private viewer = new T.Vector3();
  private guide: T.Group;
  private rural?:RuralScenery;
  constructor(private track: Track,private freeRoam=false) {
    this.shared = new TiranaCityScene(true, freeRoam?undefined:track);
    this.group = this.shared.group;
    this.guide = freeRoam?new T.Group():new TurnGuideLayer(track).group;
    this.group.add(this.guide);
  }
  update(x: number, z: number, battery: boolean, camera?: T.PerspectiveCamera) {
    this.viewer.set(x, 0, z);
    this.shared.update(this.viewer, performance.now() / 1000, battery, camera);
    if(!this.rural&&RURAL_WORLD.regions.some(({bounds:b})=>x>b[0]-500&&x<b[2]+500&&z>b[1]-500&&z<b[3]+500)){
      this.rural=new RuralScenery();this.group.add(this.rural.group);
    }
    this.rural?.update(this.viewer,battery);
    publishAtlas(x, z, this.freeRoam?{name:'Tirana · Free roam',points:[]}:this.track);
  }
  dispose() {
    this.rural?.dispose();
    this.guide.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); (o.material as T.Material).dispose(); } });
    this.shared.dispose();
    clearAtlas();
  }
}
