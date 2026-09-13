import {battleGround} from './shared/terrain.mjs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { collides, moveCircle, rayBox, type Obstacle, type Vec2 } from './core';
import { disposeObject } from '../tiranastreets/FpsCity';
import { driverEye, driverFov, driverDirection, driverUp } from '../tiranastreets/shared/driverView.mjs';
import { DriverInterior } from '../tiranastreets/DriverInterior';

/** Solo mission transport. Multiplayer positions remain server-authoritative. */
export class BattlefieldVehicle {
  readonly group=new T.Group();
  readonly cabin=new DriverInterior();
  readonly car={id:'battlefield-transport',model:'sedan',x:0,z:0,heading:0,speed:0,steering:0};
  driving=false;
  view:'cockpit'|'chase'='cockpit';
  available=false;
  private dead=false;
  constructor(scene:T.Scene){
    this.group.name='Battlefield mission car';scene.add(this.group,this.cabin.group);
    this.group.visible=false;
    new GLTFLoader().load('/assets/tirana-streets/sedan.glb',g=>{
      if(this.dead){disposeObject(g.scene);return;}
      const box=new T.Box3().setFromObject(g.scene),size=box.getSize(new T.Vector3()),scale=4.5/Math.max(size.x,size.z);
      g.scene.scale.setScalar(scale);g.scene.position.set(-(box.min.x+size.x/2)*scale,-box.min.y*scale,-(box.min.z+size.z/2)*scale);
      g.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
      this.group.add(g.scene);
    },undefined,()=>{this.available=false;});
  }
  reset(center:Vec2,obstacles:Obstacle[]){
    this.driving=false;this.car.speed=0;this.available=false;
    for(let r=6;r<=30&&!this.available;r+=3)for(let i=0;i<24;i++){
      const x=center.x+Math.sin(i*Math.PI/12)*r,z=center.z+Math.cos(i*Math.PI/12)*r;
      if(!collides(x,z,3,obstacles)){Object.assign(this.car,{x,z,heading:0});this.available=true;break;}
    }
    this.present();
  }
  near(p:Vec2){return this.available&&Math.hypot(p.x-this.car.x,p.z-this.car.z)<5;}
  toggle(p:Vec2,obstacles:Obstacle[]){
    if(this.driving){
      if(Math.abs(this.car.speed)>2)return false;
      for(const side of [-1,1]){
        const x=this.car.x+Math.cos(this.car.heading)*side*2.3,z=this.car.z-Math.sin(this.car.heading)*side*2.3;
        if(!collides(x,z,.4,obstacles)){p.x=x;p.z=z;this.driving=false;this.present();return true;}
      }
      return false;
    }
    if(!this.near(p))return false;
    this.driving=true;Object.assign(p,{x:this.car.x,z:this.car.z});this.present();return true;
  }
  step(dt:number,steer:number,throttle:number,brake:boolean,p:Vec2,obstacles:Obstacle[]){
    const c=this.car;
    c.steering+=(steer-c.steering)*Math.min(1,dt*8);
    c.speed+=throttle*(throttle*c.speed<0?14:6.5)*dt;
    if(brake)c.speed-=Math.sign(c.speed)*Math.min(Math.abs(c.speed),14*dt);
    c.speed*=Math.exp(-(throttle===0?1.25:.12)*dt);c.speed=Math.max(-5.5,Math.min(30.5,c.speed));
    c.heading-=c.steering*c.speed/(2.8+Math.abs(c.speed)*.55)*dt;
    const count=Math.max(1,Math.ceil(Math.abs(c.speed)*dt/.4));
    for(let i=0;i<count;i++){
      const dx=-Math.sin(c.heading)*c.speed*dt/count,dz=-Math.cos(c.heading)*c.speed*dt/count,old={x:c.x,z:c.z};
      moveCircle(c,dx,dz,1.3,obstacles);
      if(Math.hypot(c.x-old.x-dx,c.z-old.z-dz)>.02)c.speed*=.45;
    }
    p.x=c.x;p.z=c.z;this.present();
  }
  present(){
    const c=this.car,up=driverUp(c,battleGround),forward=driverDirection(c,c.heading,0,battleGround);
    this.group.position.set(c.x,battleGround(c.x,c.z),c.z);this.group.up.set(up.x,up.y,up.z);
    this.group.lookAt(c.x+forward.x,this.group.position.y+forward.y,c.z+forward.z);
    this.group.visible=this.available&&!(this.driving&&this.view==='cockpit');
    this.cabin.update(this.driving&&this.view==='cockpit'?this.car:undefined,battleGround);
  }
  camera(camera:T.PerspectiveCamera,obstacles:Obstacle[]){
    const c=this.car;
    if(this.view==='cockpit'){
      const eye=driverEye(c,battleGround),d=driverDirection(c,c.heading,0,battleGround),up=driverUp(c,battleGround);
      camera.position.set(eye.x,eye.y,eye.z);camera.up.set(up.x,up.y,up.z);camera.lookAt(eye.x+d.x,eye.y+d.y,eye.z+d.z);
      camera.near=.035;camera.fov=driverFov(camera.aspect);camera.updateProjectionMatrix();
    }else{
      camera.up.set(0,1,0);camera.near=.1;camera.fov=70;camera.updateProjectionMatrix();
      const ground=battleGround(c.x,c.z),origin={x:c.x,y:ground+1.1,z:c.z},direction=new T.Vector3(Math.sin(c.heading),.3,Math.cos(c.heading)).normalize();
      let distance=8;
      for(const obstacle of obstacles)distance=Math.min(distance,rayBox(origin,direction,obstacle)-.35);
      distance=Math.max(.8,distance);
      camera.position.set(c.x+Math.sin(c.heading)*distance,ground+2+distance*.22,c.z+Math.cos(c.heading)*distance);camera.lookAt(c.x,ground+1.1,c.z);
    }
  }
  dispose(){this.dead=true;this.cabin.dispose();this.group.removeFromParent();disposeObject(this.group);}
}
