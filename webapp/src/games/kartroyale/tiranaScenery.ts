import * as T from 'three';
import { TiranaCityScene } from '../tiranastreets/TiranaCityScene';
import { TurnGuideLayer } from './TurnGuideLayer';
import { publishAtlas, clearAtlas } from './raceAtlasStore';
import type { Track } from './simulation.mjs';
export { inside, occupied } from './baseTiranaScenery';

/** No replacement shells, changed footprints, rescaled map or clipped buildings. */
export class TiranaScenery {
  readonly shared: TiranaCityScene;
  readonly group: T.Group;
  private viewer = new T.Vector3();
  private guide: T.Group;
  constructor(private track: Track) {
    this.shared = new TiranaCityScene(true, track);
    this.group = this.shared.group;
    this.guide = new TurnGuideLayer(track).group;
    this.group.add(this.guide);
  }
  update(x: number, z: number, battery: boolean, camera?: T.PerspectiveCamera) {
    this.viewer.set(x, 0, z);
    this.shared.update(this.viewer, performance.now() / 1000, battery, camera);
    publishAtlas(x, z, this.track);
  }
  dispose() {
    this.guide.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); (o.material as T.Material).dispose(); } });
    this.shared.dispose();
    clearAtlas();
  }
}
