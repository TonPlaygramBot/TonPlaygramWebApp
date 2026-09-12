import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {driverEye,driverSocket,type DriverCar} from './shared/driverView.mjs';
import {disposeWeaponResources} from './weaponModelResources';

/** One active cockpit. Original exterior assets/materials remain untouched.
 * Blender authored cabin is an explicit generic fit, not a scanned OEM interior.
 */
export class DriverInterior {
  readonly group=new T.Group();
  private model?:T.Group;
  private wheel?:T.Object3D;
  private needle?:T.Object3D;
  private dead=false;
  private requested=false;
  constructor(){this.group.name='Tirana:driver-interior';this.group.visible=false;}
  update(car:(DriverCar&{steering?:number;speed?:number})|undefined){
    this.group.visible=!!car&&!driverSocket(car).open;
    if(!car||!this.group.visible)return;
    if(!this.requested){this.requested=true;void this.load();}
    const eye=driverEye(car),seat=driverSocket(car);
    this.group.position.set(eye.x,eye.y,eye.z);this.group.rotation.set(0,car.heading,0);
    // Eye/wheel alignment stays fixed. Only passenger-side cabin width changes.
    if(this.model)this.model.scale.set(T.MathUtils.clamp(seat.width/2,.88,1.15),1,1);
    if(this.wheel)this.wheel.rotation.z=-(car.steering||0)*1.7;
    if(this.needle)this.needle.rotation.z=1.9-Math.min(1,Math.abs(car.speed||0)/55)*3.8;
  }
  private async load(){
    try{
      const gltf=await new GLTFLoader().loadAsync('/assets/tirana-streets/realism/driver-interior.glb');
      if(this.dead){disposeWeaponResources([gltf.scene]);return;}
      this.model=gltf.scene;this.group.add(gltf.scene);
      this.wheel=gltf.scene.getObjectByName('SteeringWheel');this.needle=gltf.scene.getObjectByName('SpeedNeedle');
    }catch(error){if(!this.dead)console.warn('Driver interior unavailable',error);}
  }
  dispose(){this.dead=true;if(this.model)disposeWeaponResources([this.model]);this.group.clear();this.group.removeFromParent();}
}
