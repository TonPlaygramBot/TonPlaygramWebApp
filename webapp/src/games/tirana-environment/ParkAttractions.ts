import * as T from 'three';
import {RiniaFountain} from '../tirana-city-source/RiniaFountain';
import {MappedParkLife} from './MappedParkLife';
/** Retains the mapped fountain and replaces unsourced amusement rides. */
export class ParkAttractions {
 readonly group=new T.Group();readonly parks=new MappedParkLife();private fountain=new RiniaFountain();private dead=false;
 constructor(_world:any){this.group.name='Tirana:mapped-park-attractions';this.group.add(this.fountain.group,this.parks.group);}
 update(seconds:number,viewer?:{x:number;z:number},battery=false){if(this.dead)return;this.fountain.update(seconds,viewer,battery);if(viewer)this.parks.update(seconds,viewer,battery);}
 retire(){}
 dispose(){if(this.dead)return;this.dead=true;this.parks.dispose();this.fountain.dispose();this.group.removeFromParent();this.group.clear();}
}
