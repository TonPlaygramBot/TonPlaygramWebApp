import * as T from 'three';
import {driverPose,elbowFor,DRIVER_REST,DRIVER_LEGS} from './driverPose.mjs';
import type {Racer} from './simulation.mjs';
type Section={object:T.Object3D;direction:T.Vector3;rotation:T.Quaternion};
type Vec=[number,number,number];
/** Animate the existing seated mesh in its authored space. Hands stay on the
 * wheel; legs solve to heel pivots, so pedal travel never detaches the knees. */
export class KartDriver {
 readonly root:T.Group;
 private joints=new Map<string,T.Object3D>();
 private sections=new Map<string,Section>();
 private helmet?:T.Object3D;
 private torso?:T.Object3D;
 private vector=new T.Vector3();
 private target=new T.Vector3();
 private scale=new T.Vector3();
 private harness:{object:T.Object3D;position:T.Vector3}[]=[];
 private lastImpact=0;
 private impactTime=-10;
 private side=0;
 private forward=0;
 constructor(source:T.Group,color:string,raised=false){
  this.root=source.clone(true);this.root.name='Seated racing driver';this.root.position.y=raised?.1:0;
  this.root.traverse(o=>{
   this.joints.set(o.name,o);
   if(o instanceof T.Mesh){o.material=(o.material as T.Material).clone();o.castShadow=true;
    const material=o.material as T.MeshStandardMaterial;
    if(material.name==='race_suit')material.color.set(color).lerp(new T.Color('#152535'),.42);
    if(material.name==='helmet_paint')material.color.set(color).lerp(new T.Color('#ffffff'),.5);
   }
   if(o.name.startsWith('harness_shoulder'))this.harness.push({object:o,position:o.position.clone()});
  });
  this.helmet=this.joints.get('helmet');this.torso=this.joints.get('torso');
  const register=(name:string,a:Vec,b:Vec)=>{const object=this.joints.get(name);if(object)this.sections.set(name,{object,direction:new T.Vector3(...b).sub(new T.Vector3(...a)).normalize(),rotation:object.quaternion.clone()});};
  for(const [side,rest] of Object.entries(DRIVER_REST)){
   register(`arm_${side}`,rest.shoulder,rest.elbow);register(`forearm_${side}`,rest.elbow,rest.hand);
   const leg=DRIVER_LEGS[side],suffix=side==='r'?'.001':'';
   register('Thigh'+suffix,leg.hip,leg.knee);register('Shin'+suffix,leg.knee,leg.ankle);
  }
 }
 private limb(name:string,a:Vec,b:Vec){
  const section=this.sections.get(name);if(!section)return;
  this.vector.set(...a);this.target.set(...b);
  section.object.position.copy(this.vector).add(this.target).multiplyScalar(.5);
  section.object.quaternion.setFromUnitVectors(section.direction,this.target.sub(this.vector).normalize()).multiply(section.rotation);
 }
 update(r:Racer,time:number,firstPerson:boolean,reduced=false){
  const fit=this.root.parent?.getWorldScale(this.scale).y||1;
  this.root.scale.setScalar(1/fit);
  const seatY=.47*(fit-1),seatZ=-.23*(fit-1);
  if((r.impactId||0)>this.lastImpact){
   this.lastImpact=r.impactId;this.impactTime=time;
   this.side=(Math.cos(r.yaw)*r.impactNx-Math.sin(r.yaw)*r.impactNz)*r.impact*.035;
   this.forward=(Math.sin(r.yaw)*r.impactNx+Math.cos(r.yaw)*r.impactNz)*r.impact*.045;
  }
  const age=Math.max(0,time-this.impactTime),impulse=Math.sin(age*18)*Math.exp(-age*7);
  const pose=driverPose(r.steering,r.acceleration,r.yawRate,r.speed,time,reduced,{side:this.side*impulse,forward:this.forward*impulse,throttle:r.throttle,brake:r.braking?1:0,landing:r.landingImpact||0});
  // Mobile LOD drivers keep adult limb lengths as well. Only their contact
  // targets follow the fitted kart sockets; heads and torsos never shrink.
  if(fit!==1)for(const [side,arm] of Object.entries(pose.arms)){
   const rest=DRIVER_REST[side],leg=pose.legs[side],restLeg=DRIVER_LEGS[side];
   const length=(a:number[],b:number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));
   arm.shoulder[1]+=seatY;arm.shoulder[2]+=seatZ;arm.hand=arm.hand.map(v=>v*fit) as Vec;
   arm.elbow=elbowFor(arm.shoulder,arm.hand,length(rest.shoulder,rest.elbow),length(rest.elbow,rest.hand),side==='l'?1:-1);
   leg.hip=[restLeg.hip[0],restLeg.hip[1]+seatY,restLeg.hip[2]+seatZ];
   leg.ankle=leg.ankle.map(v=>v*fit) as Vec;
   leg.knee=elbowFor(leg.hip,leg.ankle,length(restLeg.hip,restLeg.knee),length(restLeg.knee,restLeg.ankle),0,[0,1,0]);
  }
  if(this.helmet){this.helmet.visible=!firstPerson;this.helmet.rotation.y=pose.headYaw;this.helmet.rotation.x=pose.headPitch;this.helmet.position.set(pose.lean*.85,1.14+seatY+pose.breath,-.32+seatZ+pose.recoil*.85);}
  if(this.torso){this.torso.position.set(pose.lean*.5,.56+seatY+pose.breath,-.29+seatZ+pose.recoil*.5);this.torso.rotation.z=-pose.lean*.6;this.torso.rotation.x=pose.recoil*.7;}
  for(const h of this.harness){h.object.position.copy(h.position);h.object.position.x+=pose.lean*.5;h.object.position.y+=seatY;h.object.position.z+=seatZ+pose.recoil*.5;}
  for(const [side,arm] of Object.entries(pose.arms)){
   this.limb(`arm_${side}`,arm.shoulder,arm.elbow);this.limb(`forearm_${side}`,arm.elbow,arm.hand);
   this.joints.get(`elbow_${side}`)?.position.set(...arm.elbow);
   const glove=this.joints.get(`hand_${side}`);if(glove){glove.position.set(...arm.hand);glove.rotation.z=pose.wheelAngle;}
   const leg=pose.legs[side],suffix=side==='r'?'.001':'';
   this.limb('Thigh'+suffix,leg.hip,leg.knee);this.limb('Shin'+suffix,leg.knee,leg.ankle);
   this.joints.get('Knee'+suffix)?.position.set(...leg.knee);
   const boot=this.joints.get('boot_'+side);if(boot){boot.position.set(...leg.ankle);boot.rotation.x=leg.pedal*.23;}
  }
 }
}
