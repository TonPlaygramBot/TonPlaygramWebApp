import * as T from 'three';
import { driverPose, DRIVER_REST } from './driverPose.mjs';
import type { Racer } from './simulation.mjs';
type Section={object:T.Object3D;direction:T.Vector3};

/** Articulation of the actual Blender driver; meshes and helmets are shared,
 * per-driver materials and transforms belong to the kart's existing lifetime. */
export class KartDriver {
  readonly root:T.Group;
  private sections=new Map<string,Section>();
  private helmet?:T.Object3D;
  private torso?:T.Object3D;
  private gloves=new Map<string,T.Object3D>();
  private vector=new T.Vector3();
  private target=new T.Vector3();
  private boots:T.Object3D[]=[];
  constructor(source:T.Group,color:string,raised=false) {
    this.root=source.clone(true);this.root.name='Seated racing driver';this.root.position.y=raised ? .1 : 0;
    this.root.traverse(o=>{
      if(o instanceof T.Mesh){o.material=(o.material as T.Material).clone();o.castShadow=true;
        const material=o.material as T.MeshStandardMaterial;
        if(material.name==='race_suit')material.color.set(color).lerp(new T.Color('#152535'),.42);
        if(material.name==='helmet_paint')material.color.set(color).lerp(new T.Color('#ffffff'),.5);
      }
      if(o.name.startsWith('boot_'))this.boots.push(o);
    });
    this.helmet=this.root.getObjectByName('helmet');this.torso=this.root.getObjectByName('torso');
    for(const [side,rest] of Object.entries(DRIVER_REST)){
      for(const [name,a,b] of [[`arm_${side}`,rest.shoulder,rest.elbow],[`forearm_${side}`,rest.elbow,rest.hand]] as const){
        const object=this.root.getObjectByName(name);if(object)this.sections.set(name,{object,direction:new T.Vector3(...b).sub(new T.Vector3(...a)).normalize()});
      }
      const hand=this.root.getObjectByName(`hand_${side}`);if(hand)this.gloves.set(side,hand);
    }
  }
  update(r:Racer,time:number,firstPerson:boolean,reduced=false) {
    const pose=driverPose(r.steering,r.acceleration,r.yawRate,r.speed,time,reduced);
    if(this.helmet){this.helmet.visible=!firstPerson;this.helmet.rotation.y=pose.headYaw;this.helmet.position.x=pose.lean*.7;}
    if(this.torso){this.torso.position.x=pose.lean;this.torso.position.y=.56+pose.breath;}
    for(const [side,arm] of Object.entries(pose.arms)){
      for(const [name,a,b] of [[`arm_${side}`,arm.shoulder,arm.elbow],[`forearm_${side}`,arm.elbow,arm.hand]] as const){
        const section=this.sections.get(name);if(!section)continue;
        this.vector.set(...a);this.target.set(...b);
        section.object.position.copy(this.vector).add(this.target).multiplyScalar(.5);
        section.object.quaternion.setFromUnitVectors(section.direction,this.target.sub(this.vector).normalize());
      }
      this.root.getObjectByName(`elbow_${side}`)?.position.set(...arm.elbow);
      const glove=this.gloves.get(side);if(glove){glove.position.set(...arm.hand);glove.rotation.z=r.steering*.65;}
    }
    this.boots.forEach((boot,i)=>{boot.rotation.x=(boot.name === 'boot_r' ? r.throttle : r.braking ? 1 : 0)*-.14;});
  }
}
