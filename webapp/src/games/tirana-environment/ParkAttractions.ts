import * as T from 'three';
import {RiniaFountain} from '../tirana-city-source/RiniaFountain';
import {LANDMARK_DATA} from '../tirana-city-source/landmarkData.mjs';
import {ribbonExclusion} from '../tirana-street-detail/roadDetailCore.mjs';
import type {StreetDetailOptions} from '../tirana-street-detail/StreetDetailLayer';
import {MappedParkLife} from './MappedParkLife';
/** Race-only exclusion affects whole furnishings, never shared map footprints. */
export class ParkAttractions {
 readonly group=new T.Group();
 readonly parks:MappedParkLife;
 private fountain?:RiniaFountain;
 private dead=false;
 constructor(_world:any,options:StreetDetailOptions={}){
  this.parks=new MappedParkLife(options);
  const source=LANDMARK_DATA.fountain;
  const points=[...source.p,...source.jets.map(j=>j.p)];
  const x=points.reduce((sum,p)=>sum+p[0],0)/points.length;
  const z=points.reduce((sum,p)=>sum+p[1],0)/points.length;
  const radius=Math.max(...points.map(p=>Math.hypot(p[0]-x,p[1]-z)))+2;
  // Do not just set visibility once: the fountain updates its own visibility.
  if(!options.track||!ribbonExclusion(options.track)(x,z,radius))this.fountain=new RiniaFountain();
  this.group.name='Tirana:mapped-park-attractions';
  this.group.add(this.parks.group);
  if(this.fountain)this.group.add(this.fountain.group);
 }
 update(seconds:number,viewer?:{x:number;z:number},battery=false){if(this.dead)return;this.fountain?.update(seconds,viewer,battery);if(viewer)this.parks.update(seconds,viewer,battery);}
 retire(){}
 dispose(){if(this.dead)return;this.dead=true;this.parks.dispose();this.fountain?.dispose();this.group.removeFromParent();this.group.clear();}
}
