import {TiranaScenery as BaseTiranaScenery} from './baseTiranaScenery';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import type {Track} from './simulation.mjs';
import {resolveNativeLandmarks} from '../tirana-landmarks/nativeLocations.mjs';
import {NativeLandmarkLayer} from '../tirana-landmarks/NativeLandmarkLayer';
import {replaceLegacyCityLandmarks} from '../tirana-landmarks/legacyReplacement';
import {UrbanDetailLayer} from '../tirana-detail-kit/UrbanDetailLayer';
export {inside,occupied} from './baseTiranaScenery';

export class TiranaScenery extends BaseTiranaScenery {
  readonly nativeLandmarks:NativeLandmarkLayer;
  readonly urbanDetails:UrbanDetailLayer;
  constructor(track:Track) {
    super(track);
    const {landmarks,issues}=resolveNativeLandmarks(WORLD), b=track.bounds;
    const near=(x:number,z:number)=>x>b[0]-200&&x<b[2]+200&&z>b[1]-200&&z<b[3]+200;
    const local=landmarks.filter(l=>near(l.x,l.z));
    const replacement=replaceLegacyCityLandmarks(this.group,local,'kartroyale');
    this.nativeLandmarks=new NativeLandmarkLayer(local);
    const buildings=WORLD.buildings.filter(item=>item.p.some(p=>near(p[0],p[1])));
    this.urbanDetails=new UrbanDetailLayer({...WORLD,buildings},new Set(landmarks.flatMap(l=>l.buildingId?[l.buildingId]:[])));
    this.group.add(this.nativeLandmarks.group,this.urbanDetails.group);
    this.group.userData.tiranaLandmarks={issues,...replacement};
  }
  override update(x:number,z:number,performance:boolean) {
    super.update(x,z,performance);
    this.nativeLandmarks.setBatteryMode(performance);
    this.urbanDetails.update({x,z},performance);
  }
  // The owning race renderer traverses this group to dispose its geometry/materials.
}
