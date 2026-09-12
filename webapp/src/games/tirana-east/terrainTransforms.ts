import * as T from 'three';
import {groundHeight} from './terrainCore.mjs';
const up=new T.Vector3(0,1,0),normal=new T.Vector3(),tilt=new T.Quaternion(),yawRotation=new T.Quaternion();
/** Orient the existing model on its sampled support plane; +Y remains vertical
 * on the urban datum. The caller supplies the asset's original forward offset. */
export function alignVehicle(root:T.Object3D,yaw:number){
 const {x,z}=root.position;if(groundHeight(x,z)<=0)return;
 normal.set((groundHeight(x-2,z)-groundHeight(x+2,z))/4,1,(groundHeight(x,z-2)-groundHeight(x,z+2))/4).normalize();
 tilt.setFromUnitVectors(up,normal);yawRotation.setFromAxisAngle(up,yaw);root.quaternion.copy(tilt).multiply(yawRotation);
}
