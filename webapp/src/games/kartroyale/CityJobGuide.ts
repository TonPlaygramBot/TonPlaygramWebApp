import * as T from 'three';
import {pointAhead,circuitDistance} from './circuitMetrics.mjs';
import {nearestPoint,type Track,type Racer} from './legacySimulation.mjs';
import {surfaceHeight} from './racingSurface.mjs';
import type {CityJobState} from './cityJobs.mjs';
export class CityJobGuide {
 readonly group=new T.Group();
 private ring:T.Mesh;
 private beacon:T.Mesh;
 private dots:T.InstancedMesh;
 private matrix=new T.Object3D();
 constructor(){
  this.group.name='City job destination and route';
  const material=new T.MeshBasicMaterial({color:'#8defff',transparent:true,opacity:.8,depthWrite:false});
  this.ring=new T.Mesh(new T.RingGeometry(3.3,3.6,48).rotateX(-Math.PI/2),material);
  this.beacon=new T.Mesh(new T.CylinderGeometry(.15,.15,5,8),new T.MeshBasicMaterial({color:'#8defff',transparent:true,opacity:.3,depthWrite:false}));
  this.dots=new T.InstancedMesh(new T.CircleGeometry(.30,8).rotateX(-Math.PI/2),material,14);this.dots.frustumCulled=false;
  this.group.add(this.ring,this.beacon,this.dots);
 }
 update(job:CityJobState,track:Track,r:Racer){
  this.group.visible=job.status==='active';if(!this.group.visible)return;
  const target=job.targets[Math.min(job.stage,job.targets.length-1)],height=surfaceHeight(track,target.x,target.z);
  this.ring.position.set(target.x,height+.16,target.z);this.beacon.position.set(target.x,height+2.6,target.z);
  const near=nearestPoint(track,r.x,r.z,r.index),at=circuitDistance(track,near),remaining=(target.distance-at+track.length)%track.length;
  // Reaching the finish with a skill target outstanding leaves a visible goal,
  // but does not draw a misleading full-lap navigation trail.
  this.dots.count=job.stage>=job.targets.length?0:Math.min(14,Math.floor(remaining/7));
  for(let i=0;i<this.dots.count;i++){
   const p=pointAhead(track,near,(i+1)*7);this.matrix.position.set(p.x,surfaceHeight(track,p.x,p.z)+.15,p.z);this.matrix.updateMatrix();this.dots.setMatrixAt(i,this.matrix.matrix);
  }
  this.dots.instanceMatrix.needsUpdate=true;
 }
}
