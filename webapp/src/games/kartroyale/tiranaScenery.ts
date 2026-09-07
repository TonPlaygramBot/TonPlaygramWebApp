import {TiranaScenery as BaseTiranaScenery} from './baseTiranaScenery';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import type {Track} from './simulation.mjs';
import {resolveNativeLandmarks} from '../tirana-landmarks/nativeLocations.mjs';
import {NativeLandmarkLayer} from '../tirana-landmarks/NativeLandmarkLayer';
import {replaceLegacyCityLandmarks} from '../tirana-landmarks/legacyReplacement';
export {inside,occupied} from './baseTiranaScenery';

export class TiranaScenery extends BaseTiranaScenery {
  readonly nativeLandmarks:NativeLandmarkLayer;
  constructor(track:Track) {
    super(track);
    const {landmarks,issues}=resolveNativeLandmarks(WORLD), b=track.bounds;
    // Include the same district margin as the existing street scenery.
    const local=landmarks.filter(l=>l.x>b[0]-200&&l.x<b[2]+200&&l.z>b[1]-200&&l.z<b[3]+200);
    const replacement=replaceLegacyCityLandmarks(this.group,local,'kartroyale');
    this.nativeLandmarks=new NativeLandmarkLayer(local);
    this.group.add(this.nativeLandmarks.group);
    this.group.userData.tiranaLandmarks={issues,...replacement};
  }
  override update(x:number,z:number,performance:boolean) {
    super.update(x,z,performance);
    this.nativeLandmarks.setBatteryMode(performance);
  }
}
