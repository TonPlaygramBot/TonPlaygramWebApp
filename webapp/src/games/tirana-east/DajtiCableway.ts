import * as T from 'three';
import {modelMesh,modelGeometry} from './blenderModels';
import {groundHeight} from './terrainCore.mjs';
import {CABLE_NODES,CABLE_STATIONS,CABLE_PYLONS,CABLE_DURATION,cablePoint} from './cableCore.mjs';
export class DajtiCableway {
 readonly group=new T.Group();readonly cabins:T.Mesh[]=[];private material=new T.MeshStandardMaterial({vertexColors:true,roughness:.5});private rider:T.Mesh;
 constructor(){
  this.group.name='Dajti Ekspres:mapped-cable-Blender-terminals';
  for(const returning of [false,true]){const points=Array.from({length:900},(_,i)=>{const p=cablePoint(i/899,returning);return new T.Vector3(p.x,p.y+3.43,p.z);});this.group.add(new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0x434a48})));}
  const steel=new T.MeshStandardMaterial({color:0x778282,roughness:.6});
  for(const p of CABLE_PYLONS){const floor=groundHeight(p.x,p.z),h=p.y-floor;const pole=new T.Mesh(new T.CylinderGeometry(.7,.95,h,8),steel);pole.position.set(p.x,floor+h/2,p.z);pole.name=p.id;this.group.add(pole);const arm=new T.Mesh(new T.BoxGeometry(7,.6,1.6),steel);arm.position.set(p.x,p.y-.3,p.z);arm.rotation.y=cablePoint(.5).yaw;this.group.add(arm);}
  for(const [i,s] of CABLE_STATIONS.entries()){const station=modelMesh('station',this.material);station.position.set(s.x,groundHeight(s.x,s.z),s.z);station.rotation.y=cablePoint(i).yaw;station.name=s.name;this.group.add(station);}
  const geo=modelGeometry('gondola');for(let i=0;i<30;i++){const m=new T.Mesh(geo,this.material);this.cabins.push(m);this.group.add(m);}this.rider=new T.Mesh(geo,this.material);this.rider.visible=false;this.group.add(this.rider);
  const upper=CABLE_STATIONS[1],hotel=modelMesh('belvedere',this.material);hotel.position.set(upper.x-33,groundHeight(upper.x-33,upper.z+45),upper.z+45);hotel.name='Dajti Tower:photo-informed estimated massing';this.group.add(hotel);
 }
 setRide(ride?:{fraction:number;returning:boolean}){this.rider.visible=!!ride;if(ride){const p=cablePoint(ride.fraction,ride.returning);this.rider.position.set(p.x,p.y,p.z);this.rider.rotation.y=p.yaw;}}
 update(seconds:number,viewer?:{x:number;z:number}){for(let i=0;i<this.cabins.length;i++){const loop=((seconds/CABLE_DURATION+i*2/30)%2+2)%2,p=cablePoint(loop%1,loop>=1),m=this.cabins[i];m.position.set(p.x,p.y,p.z);m.rotation.y=p.yaw;m.visible=(!viewer||Math.hypot(viewer.x-p.x,viewer.z-p.z)<6000)&&(!this.rider.visible||m.position.distanceTo(this.rider.position)>14);}}
 dispose(){const geos=new Set<T.BufferGeometry>(),mats=new Set<T.Material>();this.group.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);}});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());this.group.clear();this.group.removeFromParent();}
}
