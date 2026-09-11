import {ImportedAssetVisuals} from './ImportedAssetVisuals';
import {props,ORIGIN} from '../blackwater/shared/layout.mjs';
import {CityRenderer as BaseCityRenderer} from './cityBaseRenderer';
import {WORLD} from './shared/world.mjs';
import {resolveNativeLandmarks} from '../tirana-landmarks/nativeLocations.mjs';
import {NativeLandmarkLayer} from '../tirana-landmarks/NativeLandmarkLayer';
import {replaceLegacyCityLandmarks} from '../tirana-landmarks/legacyReplacement';
import {AirMobilityVisuals} from './AirMobilityVisuals';
import type {State} from './shared/engine.mjs';
import {WeaponStoreInterior} from './WeaponStoreInterior';

/** Preserve input, loading, gameplay and camera implementation while replacing
 * the city's landmark layer. Base renderer also owns source-informed façades. */
export class CityRenderer extends BaseCityRenderer {
  private imported=new ImportedAssetVisuals();
  readonly nativeLandmarks: NativeLandmarkLayer;
  readonly airMobility: AirMobilityVisuals;
  readonly weaponStore: WeaponStoreInterior;
  constructor(root:HTMLDivElement) {
    super(root);
    this.scene.add(this.imported.group);
    const {landmarks,issues}=resolveNativeLandmarks(WORLD);
    const replacement=replaceLegacyCityLandmarks(this.scene,landmarks,'tiranastreets');
    this.nativeLandmarks=new NativeLandmarkLayer(landmarks);
    this.scene.add(this.nativeLandmarks.group);
    this.scene.userData.tiranaLandmarks={issues,...replacement};
    this.airMobility=new AirMobilityVisuals(this.scene);
    this.weaponStore=new WeaponStoreInterior();
    this.scene.add(this.weaponStore.group);
  }
  override render(state:State|null,playerId:string,dt:number,lobby:boolean) {
    super.render(state,playerId,dt,lobby);
    if(state) {
      this.airMobility.update(state,dt);
      const p=state.players[playerId];if(p)this.imported.update(props.filter(v=>v.assetId).map((v,i)=>({id:`original-${i}`,assetId:v.assetId,x:v.x+ORIGIN.x,z:v.z+ORIGIN.z})),p,this.quality==='battery');
    }
  }
  override setQuality(quality:'auto'|'high'|'battery') {
    super.setQuality(quality);
    this.nativeLandmarks?.setBatteryMode(quality==='battery');
    this.weaponStore?.setBatteryMode(quality==='battery');
  }
  override destroy() {
    this.imported.dispose();
    this.airMobility.dispose();
    this.weaponStore.dispose();
    this.nativeLandmarks.dispose();
    super.destroy();
  }
}
