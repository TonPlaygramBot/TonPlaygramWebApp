import * as T from 'three';
/** One fitted Blender cabin for the local driver. The original body remains the
 * chase/garage model, so opaque source glass cannot cover the seated camera. */
export class RacingCockpit {
  readonly anchor = new T.Group();
  private cabin: T.Group;
  private wheel?: T.Object3D;
  private speedNeedle?: T.Object3D;
  private tachNeedle?: T.Object3D;
  private exterior: {material:T.Material; visible:boolean}[] = [];
  constructor(template:T.Group,model:T.Group,body:T.Object3D,eye:T.Vector3){
    this.anchor.name='Racing:driver-eye';
    this.anchor.position.copy(eye);
    model.traverse(o=>{if(o instanceof T.Mesh)for(const material of Array.isArray(o.material)?o.material:[o.material])this.exterior.push({material,visible:material.visible});});
    this.cabin=template.clone(true);
    this.cabin.traverse(o=>{
      if(o instanceof T.Mesh){
        o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();
        o.castShadow=false;o.receiveShadow=false;
      }
    });
    this.cabin.name='Racing:Blender-cockpit';
    this.anchor.add(this.cabin);model.add(this.anchor);
    model.updateMatrixWorld(true);
    // Preserve eye-space metres when parented under a fitted/rotated native GLB.
    body.attach(this.anchor);
    this.wheel=this.cabin.getObjectByName('SteeringWheel');
    this.speedNeedle=this.cabin.getObjectByName('SpeedNeedle');
    this.tachNeedle=this.cabin.getObjectByName('TachNeedle');
    this.cabin.visible=false;
  }
  update(active:boolean,steering:number,speed:number){
    this.cabin.visible=active;
    for(const item of this.exterior)item.material.visible=active?false:item.visible;
    if(this.wheel)this.wheel.rotation.z=steering*1.6;
    if(this.speedNeedle)this.speedNeedle.rotation.z=2.3-Math.min(1,Math.abs(speed)*3.6/240)*4.6;
    if(this.tachNeedle)this.tachNeedle.rotation.z=2.3-Math.min(1,.12+Math.abs(speed)/55)*4.6;
  }
  eye(target:T.Vector3){this.anchor.updateWorldMatrix(true,false);return this.anchor.getWorldPosition(target);}
  forward(target:T.Vector3){return target.set(0,-.035,1).transformDirection(this.anchor.matrixWorld);}
}
