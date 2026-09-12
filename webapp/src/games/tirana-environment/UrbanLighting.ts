import * as T from 'three';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {streetLampPlacements} from './urbanLightingCore.mjs';
import {nearbyIndex} from '../tirana-street-life/streetModels.mjs';
import {STREET_LIFE} from '../tirana-street-life/registry.mjs';
import {onCarriageway,SHOP} from '../tiranastreets/shared/streetLayout.mjs';

const LAMPS=streetLampPlacements(WORLD).filter(p=>!onCarriageway(p.x,p.z,.25)&&Math.hypot(p.x-SHOP.x,p.z-SHOP.z)>12);
/** A fixed light pool bounds shader cost. Lamps and bulbs are instanced; only
 * nearby fixtures illuminate surfaces, with no per-lamp shadow maps. */
export class UrbanLighting {
 readonly group=new T.Group();
 private near=nearbyIndex(LAMPS);
 private shops=nearbyIndex(STREET_LIFE.storefronts);
 private unit=new T.BoxGeometry(1,1,1);
 private steel=new T.MeshStandardMaterial({color:0x424b4f,metalness:.72,roughness:.42});
 private bulb=new T.MeshStandardMaterial({color:0xffecd2,emissive:0xffdeb2,emissiveIntensity:0,roughness:.3});
 private poles=new T.InstancedMesh(this.unit,this.steel,360);
 private bulbs=new T.InstancedMesh(this.unit,this.bulb,120);
 private lights=Array.from({length:6},()=>new T.PointLight(0xffdfb1,0,24,2));
 private shopLights=Array.from({length:2},()=>new T.PointLight(0xffdda9,0,9,2));
 private dummy=new T.Object3D();private last=-Infinity;private dead=false;
 constructor(){
  this.group.name='Tirana:street-and-business-lighting';
  this.group.userData={lampCount:LAMPS.length,placement:'Authored on mapped roads',maxLocalLights:8};
  this.bulb.userData.environmentLight='street';this.bulb.userData.nightIntensity=3.2;
  this.poles.name='Street lamp poles and arms';this.bulbs.name='Street lamp luminaires';
  for(const m of [this.poles,this.bulbs]){m.count=0;m.frustumCulled=false;m.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(m);}
  this.poles.castShadow=true;this.poles.receiveShadow=true;
  for(const light of this.lights){light.userData.environmentLight='street';light.userData.nightIntensity=170;this.group.add(light);}
  for(const light of this.shopLights){light.userData.environmentLight='business';light.userData.nightIntensity=35;this.group.add(light);}
 }
 update(viewer:{x:number;z:number},seconds:number,battery=false){
  if(this.dead||seconds>=this.last&&seconds-this.last<.3)return;this.last=seconds;
  const selected=this.near(viewer,battery?100:220,battery?40:120);this.poles.count=0;this.bulbs.count=0;
  const box=(mesh:T.InstancedMesh,x:number,y:number,z:number,w:number,h:number,d:number,yaw:number)=>{
   this.dummy.position.set(x,y,z);this.dummy.scale.set(w,h,d);this.dummy.rotation.set(0,yaw,0);this.dummy.updateMatrix();mesh.setMatrixAt(mesh.count++,this.dummy.matrix);
  };
  for(const p of selected){
   const nx=Math.cos(p.yaw),nz=-Math.sin(p.yaw);
   box(this.poles,p.x,3.23,p.z,.13,6.4,.13,0);
   box(this.poles,p.x+nx*.7,6.36,p.z+nz*.7,1.5,.085,.085,p.yaw);
   box(this.poles,p.x+nx*1.35,6.30,p.z+nz*1.35,.62,.12,.28,p.yaw);
   box(this.bulbs,p.x+nx*1.35,6.23,p.z+nz*1.35,.51,.018,.22,p.yaw);
  }
  this.poles.instanceMatrix.needsUpdate=true;this.bulbs.instanceMatrix.needsUpdate=true;this.poles.castShadow=!battery;
  this.lights.forEach((light,i)=>{const p=selected[i];light.userData.lightAvailable=!!p&&i<(battery?2:6);if(p)light.position.set(p.x+Math.cos(p.yaw)*1.35,6.05,p.z-Math.sin(p.yaw)*1.35);});
  const shops=this.shops(viewer,35,battery?1:2);
  this.shopLights.forEach((light,i)=>{const p=shops[i];light.userData.lightAvailable=!!p;if(p)light.position.set(p.x+Math.sin(p.yaw)*.9,2.3,p.z+Math.cos(p.yaw)*.9);});
 }
 dispose(){if(this.dead)return;this.dead=true;this.poles.dispose();this.bulbs.dispose();this.unit.dispose();this.steel.dispose();this.bulb.dispose();this.group.removeFromParent();this.group.clear();}
}
