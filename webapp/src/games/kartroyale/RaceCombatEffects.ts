import * as T from 'three';
import { COMBAT_RULES, type RaceCombatState } from './raceCombat.mjs';
import { surfaceHeight } from './racingSurface.mjs';
import type { Racer, Track } from './simulation.mjs';

/** Bounded instanced effects, owned and disposed by the local combat session.
 * This layer never advances gameplay or adds damage on render frames. */
export class RaceCombatEffects {
  readonly group = new T.Group();
  private transform = new T.Object3D();
  private color = new T.Color();
  private shots = this.batch(new T.BoxGeometry(1,1,1),COMBAT_RULES.maxProjectiles);
  private pickups = this.batch(new T.OctahedronGeometry(1,0),COMBAT_RULES.maxPickups);
  private rings = this.batch(new T.RingGeometry(.74,1,24),COMBAT_RULES.maxPickups+12,true);
  private warnings = this.batch(new T.PlaneGeometry(1,1),12,true);
  private shields = this.batch(new T.SphereGeometry(1,12,8),12,true);
  private fragments = this.batch(new T.IcosahedronGeometry(1,0),COMBAT_RULES.maxBursts*10,true);

  constructor(){
    this.group.name='Local combat · projectiles, warnings and supplies';
    this.group.add(this.shots,this.pickups,this.rings,this.warnings,this.shields,this.fragments);
    (this.shields.material as T.MeshBasicMaterial).opacity=.18;
    (this.shields.material as T.MeshBasicMaterial).wireframe=true;
    (this.warnings.material as T.MeshBasicMaterial).opacity=.28;
  }
  private batch(geometry:T.BufferGeometry,max:number,transparent=false){
    const material=new T.MeshBasicMaterial({toneMapped:false,transparent,opacity:transparent?.8:1,depthWrite:!transparent,side:T.DoubleSide});
    const mesh=new T.InstancedMesh(geometry,material,max);
    mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    return mesh;
  }
  private put(mesh:T.InstancedMesh,index:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string,rx=0,ry=0,rz=0){
    if(index>=mesh.instanceMatrix.count)return index;
    this.transform.position.set(x,y,z);this.transform.rotation.set(rx,ry,rz);this.transform.scale.set(sx,sy,sz);this.transform.updateMatrix();
    mesh.setMatrixAt(index,this.transform.matrix);mesh.setColorAt(index,this.color.set(color));return index+1;
  }
  private finish(mesh:T.InstancedMesh,count:number){
    mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  }
  update(state:RaceCombatState,racers:Racer[],track:Track){
    let shots=0,pickups=0,rings=0,warnings=0,shields=0,fragments=0;
    for(const p of state.projectiles){
      shots=this.put(this.shots,shots,p.x,p.y,p.z,.08,.08,1.4,p.ownerId===state.playerId?'#73f3ff':'#ff694f',0,Math.atan2(p.vx,p.vz));
    }
    for(const p of state.pickups){
      if(p.cooldown>0)continue;
      const c=p.kind==='ammo'?'#ffc857':p.kind==='repair'?'#6aff9b':'#57c9ff';
      const y=surfaceHeight(track,p.x,p.z);
      pickups=this.put(this.pickups,pickups,p.x,y+.65+Math.sin(state.elapsed*3+p.id)*.1,p.z,.38,.48,.38,c,0,state.elapsed+p.id);
      rings=this.put(this.rings,rings,p.x,y+.12,p.z,.8,.8,.8,c,-Math.PI/2);
    }
    for(const warning of state.warnings){
      const length=26,s=Math.sin(warning.yaw),c=Math.cos(warning.yaw),ground=surfaceHeight(track,warning.x,warning.z)+.13;
      const pulse=.7+.3*Math.sin(state.elapsed*20);
      // A ground strip shows the fixed firing lane during the full windup.
      warnings=this.put(this.warnings,warnings,warning.x+s*length*.5,ground,warning.z+c*length*.5,1.35,length,1,'#ff344f',-Math.PI/2,0,-warning.yaw);
      rings=this.put(this.rings,rings,warning.x+s*12,ground+.01,warning.z+c*12,1.25*pulse,1.25*pulse,1.25*pulse,'#ff344f',-Math.PI/2);
    }
    for(const r of racers){
      if(!state.weapons[r.id]?.shieldActive)continue;
      shields=this.put(this.shields,shields,r.x,(r.groundY||0)+(r.jumpHeight||0)+.65,r.z,(r.bodyWidth||1.27)*.75,1.05,(r.bodyLength||2)*.65,'#77dfff',0,r.yaw);
    }
    for(const b of state.bursts){
      const explosion=b.kind==='explosion',pickup=b.kind==='pickup',muzzle=b.kind==='muzzle';
      const lifetime=explosion?1.05:muzzle?.07:.5,remaining=Math.max(0,1-b.age/lifetime);
      const count=explosion?10:muzzle?1:6;
      for(let i=0;i<count;i++){
        const angle=i*Math.PI*2/count+b.id*.7,spread=b.age*(explosion?5:pickup?2.8:3);
        const size=(explosion?.35:muzzle?.22:.075)*remaining;
        fragments=this.put(this.fragments,fragments,b.x+Math.cos(angle)*spread,b.y+Math.max(0,b.age*(explosion?4:2)-b.age*b.age*4),b.z+Math.sin(angle)*spread,size,size,size,pickup?'#80ffc0':explosion?(i%3?'#ff7d32':'#ffd875'):b.ownerId===state.playerId?'#9bfbff':'#ffb75f',b.age*6,angle,b.age*4);
      }
    }
    this.finish(this.shots,shots);this.finish(this.pickups,pickups);this.finish(this.rings,rings);this.finish(this.warnings,warnings);this.finish(this.shields,shields);this.finish(this.fragments,fragments);
  }
  clear(){for(const mesh of [this.shots,this.pickups,this.rings,this.warnings,this.shields,this.fragments])mesh.count=0;}
  dispose(){
    this.group.removeFromParent();
    for(const mesh of [this.shots,this.pickups,this.rings,this.warnings,this.shields,this.fragments]){
      mesh.geometry.dispose();(mesh.material as T.Material).dispose();mesh.dispose();
    }
    this.group.clear();
  }
}
