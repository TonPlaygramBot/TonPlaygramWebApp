import * as THREE from 'three';
import {TurnGuideLayer} from './TurnGuideLayer';
import {WorldEnhancements} from '../tirana-expansion/WorldEnhancements';
import {publishAtlas,clearAtlas} from './raceAtlasStore';
import {TiranaScenery as BaseTiranaScenery} from './baseTiranaScenery';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import type {Track} from './simulation.mjs';
import {resolveNativeLandmarks} from '../tirana-landmarks/nativeLocations.mjs';
import {NativeLandmarkLayer} from '../tirana-landmarks/NativeLandmarkLayer';
import {replaceLegacyCityLandmarks} from '../tirana-landmarks/legacyReplacement';
import {RacingCityLifeV2Layer} from './citylife-v2/RacingCityLifeV2Layer';
import {UrbanDetailLayer} from '../tirana-detail-kit/UrbanDetailLayer';
export {inside,occupied} from './baseTiranaScenery';

export class TiranaScenery extends BaseTiranaScenery {
  readonly nativeLandmarks:NativeLandmarkLayer;
  readonly urbanDetails:UrbanDetailLayer;
  readonly enhancements:WorldEnhancements;
  readonly cityLifeV2:RacingCityLifeV2Layer;
  private atlasTrack:Track;
  constructor(track:Track) {
    super(track);
    this.atlasTrack=track;
    this.group.add(new TurnGuideLayer(track).group);
    this.enhancements=new WorldEnhancements({profile:'racing',track});
    this.group.add(this.enhancements.group);
    this.cityLifeV2=new RacingCityLifeV2Layer(track,WORLD);
    this.group.add(this.cityLifeV2.group);
    // Race-owned disposal retires async work before the scene traversal.
    const lifetime=new THREE.BufferGeometry();lifetime.addEventListener('dispose',()=>{this.enhancements.retire();this.cityLifeV2.retire();clearAtlas();});
    const sentinel=new THREE.Mesh(lifetime,new THREE.MeshBasicMaterial());sentinel.visible=false;sentinel.name='Tirana:async-lifetime';this.group.add(sentinel);
    const {landmarks,issues}=resolveNativeLandmarks(WORLD), b=track.bounds;
    const near=(x:number,z:number)=>x>b[0]-200&&x<b[2]+200&&z>b[1]-200&&z<b[3]+200;
    const local=landmarks.filter(l=>near(l.x,l.z));
    const replacement=replaceLegacyCityLandmarks(this.group,local,'kartroyale');
    this.nativeLandmarks=new NativeLandmarkLayer(local);
    const buildings=WORLD.buildings.filter(item=>item.p.some(p=>near(p[0],p[1])));
    this.urbanDetails=new UrbanDetailLayer({...WORLD,buildings},new Set(landmarks.flatMap(l=>l.buildingId?[l.buildingId]:[])));
    this.group.add(this.nativeLandmarks.group,this.urbanDetails.group);
    this.enhancements.bindBuildings(this.group,[this.nativeLandmarks.group,this.urbanDetails.group]);
    this.group.userData.tiranaLandmarks={issues,...replacement};
  }
  override update(x:number,z:number,performance:boolean) {
    super.update(x,z,performance);
    this.nativeLandmarks.setBatteryMode(performance);
    this.urbanDetails.update({x,z},performance);
    this.cityLifeV2.update(globalThis.performance.now()/1000,x,z,performance);
    publishAtlas(x,z,this.atlasTrack);
    let root:THREE.Object3D=this.group;while(root.parent)root=root.parent;
    const camera=root.children.find(o=>o instanceof THREE.PerspectiveCamera) as THREE.PerspectiveCamera|undefined;
    this.enhancements.update(globalThis.performance.now()/1000,camera,{x,z},performance);
  }
  // The owning race renderer traverses this group to dispose its geometry/materials.
}
