import * as T from 'three';
import { LANDMARK_DATA } from './landmarkData.mjs';

/** Mapped Taivani basin and jet locations. Water arcs are an artistic animation,
 * not a claim about the real fountain's nozzle count or operating schedule. */
export class RiniaFountain {
 readonly group=new T.Group();
 private readonly water:T.Points;
 private disposed=false;
 constructor(){
  const source=LANDMARK_DATA.fountain;
  this.group.name='Parku Rinia · Taivani mapped fountain';
  this.group.userData={osm:source.id,jetSources:source.jets.map(j=>j.id)};
  const shape=new T.Shape(source.p.map(p=>new T.Vector2(p[0],-p[1])));
  const basin=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.35,bevelEnabled:false}).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0xa8a69a,roughness:.85}));
  basin.name='Parku Rinia fountain basin';basin.receiveShadow=true;this.group.add(basin);
  const pool=new T.Mesh(new T.ShapeGeometry(shape).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x5aabb7,roughness:.24,metalness:.12}));
  pool.position.y=.36;pool.name='Parku Rinia fountain water';this.group.add(pool);
  const rim=new T.BufferGeometry().setFromPoints([...source.p,source.p[0]].map(p=>new T.Vector3(p[0],.42,p[1])));
  const edge=new T.Line(rim,new T.LineBasicMaterial({color:0xddd9ca}));this.group.add(edge);
  this.water=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(source.jets.length*48*3),3)),new T.PointsMaterial({color:0xd5f4ff,size:.23,transparent:true,opacity:.78,depthWrite:false}));
  this.water.name='Parku Rinia animated fountain jets';this.water.frustumCulled=false;this.group.add(this.water);
  this.update(0);
 }
 update(seconds:number,viewer?:{x:number;z:number},battery=false){
  const jets=LANDMARK_DATA.fountain.jets,centre=jets[0].p;
  this.group.visible=!viewer||Math.hypot(viewer.x-centre[0],viewer.z-centre[1])<(battery?180:450);
  if(!this.group.visible)return;
  const p=this.water.geometry.getAttribute('position') as T.BufferAttribute;
  for(let j=0;j<jets.length;j++)for(let i=0;i<48;i++){
   const a=(i%8)*Math.PI/4,t=((battery?0:seconds*.6)+Math.floor(i/8)/6)%1;
   p.setXYZ(j*48+i,jets[j].p[0]+Math.cos(a)*t*2,.4+Math.sin(t*Math.PI)*(j===0?5.4:3.4),jets[j].p[1]+Math.sin(a)*t*2);
  }
  p.needsUpdate=true;
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;
  this.group.removeFromParent();this.group.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line||o instanceof T.Points){o.geometry.dispose();(o.material as T.Material).dispose();}});this.group.clear();
 }
}
