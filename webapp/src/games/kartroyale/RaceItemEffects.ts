import * as T from 'three';
import {raceItemPickups} from './raceItems.mjs';
import {surfaceHeight} from './racingSurface.mjs';
import type {Racer,Track} from './simulation.mjs';

export const PICKUP_COLORS={rocket:'#ff985b',shield:'#68dfff',boost:'#bcf75c'} as const;
const MAX_PICKUPS=32;

function polygon(p:T.Shape|T.Path, points:[number,number][]){
  points.forEach(([x,y],index)=>index?p.lineTo(x,y):p.moveTo(x,y));
  p.closePath();
  return p;
}

/** Icon silhouettes complement color: shield outline, forward double chevron,
 * and the existing amber gem. No textures, blending animation or canvas assets. */
function shieldPickupGeometry(){
  const outline=polygon(new T.Shape(),[[-.36,.32],[0,.43],[.36,.32],[.31,-.09],[.18,-.28],[0,-.42],[-.18,-.28],[-.31,-.09]]);
  outline.holes.push(polygon(new T.Path(),[[-.23,.23],[-.19,-.07],[-.11,-.18],[0,-.27],[.11,-.18],[.19,-.07],[.23,.23],[0,.30]]));
  return new T.ShapeGeometry(outline);
}
function boostPickupGeometry(){
  const chevron=(y:number)=>polygon(new T.Shape(),[[-.40,y-.04],[0,y+.21],[.40,y-.04],[.40,y-.19],[0,y+.06],[-.40,y-.19]]);
  return new T.ShapeGeometry([chevron(.24),chevron(-.11)]);
}

/** Fixed instance budgets; presentation never applies a hit or grants an item. */
export class RaceItemEffects {
  readonly group=new T.Group();
  private transform=new T.Object3D();
  private color=new T.Color();
  private boxes=this.batch(new T.OctahedronGeometry(.45,0),MAX_PICKUPS);
  private shieldPickups=this.batch(shieldPickupGeometry(),MAX_PICKUPS);
  private boostPickups=this.batch(boostPickupGeometry(),MAX_PICKUPS);
  private rings=this.batch(new T.RingGeometry(.58,.78,24),MAX_PICKUPS,true);
  private rockets=this.batch(new T.ConeGeometry(.12,.9,8),12);
  private flames=this.batch(new T.ConeGeometry(.09,.5,8),12);
  private impacts=this.batch(new T.RingGeometry(.75,1,24),12,true);
  private shields=this.batch(new T.SphereGeometry(1,12,8),12,true);
  constructor(){
    this.group.name='Tirana Racing Streets · race pickups';
    this.boxes.name='Amber arcade pickup';
    this.shieldPickups.name='Shield pickup outline';
    this.boostPickups.name='Boost pickup chevrons';
    this.rings.name='Pickup road locators';
    this.group.add(this.boxes,this.shieldPickups,this.boostPickups,this.rings,this.rockets,this.flames,this.shields,this.impacts);
    (this.shields.material as T.MeshBasicMaterial).opacity=.16;
    (this.shields.material as T.MeshBasicMaterial).wireframe=true;
  }
  private batch(geometry:T.BufferGeometry,max:number,transparent=false){
    const mesh=new T.InstancedMesh(geometry,new T.MeshBasicMaterial({transparent,opacity:transparent?.7:1,depthWrite:!transparent,toneMapped:false,side:T.DoubleSide}),max);
    mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);return mesh;
  }
  private put(mesh:T.InstancedMesh,i:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string,rx=0,ry=0){
    if(i>=mesh.instanceMatrix.count)return i;
    this.transform.position.set(x,y,z);this.transform.scale.set(sx,sy,sz);this.transform.rotation.set(rx,ry,0,'YXZ');this.transform.updateMatrix();
    mesh.setMatrixAt(i,this.transform.matrix);mesh.setColorAt(i,this.color.set(color));return i+1;
  }
  update(racers:Racer[],me:Racer,track:Track,time:number,reduced=false){
    let boxes=0,shieldPickups=0,boostPickups=0,rings=0,rockets=0,flames=0,shields=0,impacts=0;
    for(const p of raceItemPickups(track)){
      if((me.itemCooldowns?.[p.id]||0)>time)continue;
      if(rings>=MAX_PICKUPS)break;
      const color=PICKUP_COLORS[p.kind as keyof typeof PICKUP_COLORS];
      const y=surfaceHeight(track,p.x,p.z),bob=reduced?0:Math.sin(time*2+p.id)*.07;
      // Keep the class silhouettes readable from either side of the track.
      const yaw=p.yaw+(reduced?0:Math.sin(time*1.35+p.id)*.22);
      if(p.kind==='shield'){
        shieldPickups=this.put(this.shieldPickups,shieldPickups,p.x,y+.91+bob,p.z,1.3,1.3,1,color,0,yaw);
      }else if(p.kind==='boost'){
        boostPickups=this.put(this.boostPickups,boostPickups,p.x,y+.91+bob,p.z,1.3,1.3,1,color,0,yaw);
      }else{
        boxes=this.put(this.boxes,boxes,p.x,y+.75+bob,p.z,1,1,1,color,0,reduced?0:time*.7);
      }
      rings=this.put(this.rings,rings,p.x,y+.08,p.z,1,1,1,color,-Math.PI/2);
    }
    for(const r of racers){
      const p=r.itemRocket;
      if(p){
        const yaw=Math.atan2(p.vx,p.vz),y=p.y;
        rockets=this.put(this.rockets,rockets,p.x,y,p.z,1,1,1,'#ffe0a3',Math.PI/2,yaw);
        const length=Math.hypot(p.vx,p.vz)||1;
        flames=this.put(this.flames,flames,p.x-p.vx/length*.55,y,p.z-p.vz/length*.55,1,reduced?1:1+Math.sin(time*30)*.12,1,'#ff6c27',-Math.PI/2,yaw);
      }
      if(!reduced&&(r.hitFlash||0)>0){
        const radius=.6+(1-Math.min(1,r.hitFlash/.3))*1.7;
        impacts=this.put(this.impacts,impacts,r.x,(r.groundY||0)+.12,r.z,radius,radius,radius,'#ffb06d',-Math.PI/2);
      }
      if((r.itemShield||0)>0)shields=this.put(this.shields,shields,r.x,(r.groundY||0)+(r.jumpHeight||0)+.65,r.z,(r.bodyWidth||1.27)*.7,.95,(r.bodyLength||2)*.63,'#68dfff',0,r.yaw);
    }
    for(const [mesh,count] of [[this.boxes,boxes],[this.shieldPickups,shieldPickups],[this.boostPickups,boostPickups],[this.rings,rings],[this.rockets,rockets],[this.flames,flames],[this.shields,shields],[this.impacts,impacts]] as const){
      mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
  }
  dispose(){this.group.removeFromParent();for(const mesh of [this.boxes,this.shieldPickups,this.boostPickups,this.rings,this.rockets,this.flames,this.shields,this.impacts]){mesh.geometry.dispose();(mesh.material as T.Material).dispose();}}
}
