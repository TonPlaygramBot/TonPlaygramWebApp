import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {buildGltfAsset} from './gltfAssets.mjs';
import {civicSites,cablePath,cablePose,mountainHeight,REFERENCES,project} from './geography.mjs';
import {WORLD} from '../tiranastreets/shared/world.mjs';

export function disposeTree(root:T.Object3D){
 root.removeFromParent();const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>(),ts=new Set<T.Texture>();
 root.traverse(o=>{if(o instanceof T.Mesh || o instanceof T.Line || o instanceof T.Points){gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){ms.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)ts.add(value);}}});
 gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());root.clear();
}
export function originalAsset(id:string):Promise<T.Group>{
 return new Promise((resolve,reject)=>new GLTFLoader().parse(JSON.stringify(buildGltfAsset(id)),'',g=>resolve(g.scene),reject));
}
/** Detailed bay modules sit on the recorded facade edge. No polygon, street,
 * height or authoritative collider is moved to fit an authored asset. */
export class CivicDetails {
 readonly group=new T.Group();readonly errors:string[]=[];private disposed=false;
 readonly ready:Promise<void>;
 constructor(world= WORLD){
  this.group.name='Tirana:glTF-civic-details';
  this.ready=Promise.all(civicSites(world).filter(s=>s.id!=='hotel').map(async site=>{
   const id=site.id==='culture'?'culture-bay':site.id==='bank'?'bank-bay':'civic-bay';
   const source=await originalAsset(id);if(this.disposed){disposeTree(source);return;}
   source.updateMatrixWorld(true);
   // The facade closest to Skanderbeg Square is the visible civic frontage.
   const edges=site.footprint.map((a,i)=>{const b=site.footprint[(i+1)%site.footprint.length];return {a,b,length:Math.hypot(b[0]-a[0],b[1]-a[1]),score:Math.hypot((a[0]+b[0])/2,(a[1]+b[1])/2)};}).filter(e=>e.length>6).sort((a,b)=>a.score-b.score);
   const edge=edges[0];if(!edge){this.errors.push(`${site.name}: no usable source facade edge`);disposeTree(source);return;}
   const dx=(edge.b[0]-edge.a[0])/edge.length,dz=(edge.b[1]-edge.a[1])/edge.length;
   const area=site.footprint.reduce((sum,a,i)=>{const b=site.footprint[(i+1)%site.footprint.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
   const nx=area>0?dz:-dz,nz=area>0?-dx:dx;
   const yaw=Math.atan2(nx,nz),count=Math.min(40,Math.floor(edge.length/4)),spacing=edge.length/(count+1),dummy=new T.Object3D();
   const row=new T.Group();row.name=`${site.name}:original-glTF-frontage`;row.userData={osmWay:site.way,accuracy:'source footprint; authored facade details'};
   source.traverse(o=>{if(!(o instanceof T.Mesh))return;
    const mesh=new T.InstancedMesh(o.geometry,o.material,count);mesh.name=o.name;mesh.receiveShadow=true;
    for(let i=0;i<count;i++){dummy.position.set(edge.a[0]+dx*spacing*(i+1)+nx*.12,.12,edge.a[1]+dz*spacing*(i+1)+nz*.12);dummy.rotation.set(0,yaw,0);dummy.scale.setScalar(Math.min(1,spacing/4));dummy.updateMatrix();mesh.setMatrixAt(i,new T.Matrix4().multiplyMatrices(dummy.matrix,o.matrixWorld));}
    mesh.computeBoundingSphere();row.add(mesh);
   });this.group.add(row);
  }).map(p=>p.catch(e=>{this.errors.push(String(e));}))).then(()=>{});
 }
 retire(){this.disposed=true;}
 dispose(){this.disposed=true;disposeTree(this.group);}
}

/** Authored Dajti skyline and complete two-terminal gondola visualization. The
 * source-mapped endpoints are separate from unverified relief, supports and yaw. */
export class DajtiLayer {
 readonly group=new T.Group();readonly path=cablePath(WORLD.origin);readonly cabins:T.Object3D[]=[];
 readonly errors:string[]=[];private disposed=false;private tour=false;private tourCabin?:T.Object3D;
 readonly ready:Promise<void>;
 constructor(){
  this.group.name='Dajti:authored-regional-reconstruction';
  this.group.userData.accuracy='NOT a DEM: terrain, support positions and elevations are approximate';
  const top=project(WORLD.origin,REFERENCES.upper.latitude,REFERENCES.upper.longitude),p:number[]=[],colors:number[]=[],indices:number[]=[];
  const nx=48,nz=64,x0=top.x-5000,z0=top.z-6000;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
   const x=x0+i*8500/nx,z=z0+j*12000/nz,y=mountainHeight(x,z,WORLD.origin);p.push(x,y,z);
   const c=new T.Color(y>1250?0x9faaa2:0x637f78).lerp(new T.Color(0xadbcc3),.42);colors.push(c.r,c.g,c.b);
  }
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();
  const terrain=new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true,fog:false,depthTest:false,depthWrite:false}));terrain.name='Dajti:non-surveyed-relief';terrain.renderOrder=-900;this.group.add(terrain);
  const wire=new T.LineBasicMaterial({color:0x4d6065,fog:false});
  for(const returning of [false,true]){
   const pts=this.path.map((_,i)=>{const p=cablePose(this.path,i/(this.path.length-1),returning);return new T.Vector3(p.x,p.y,p.z);});
   const line=new T.Line(new T.BufferGeometry().setFromPoints(pts),wire);line.name='Dajti:approximate-cable';this.group.add(line);
  }
  const support=new T.MeshStandardMaterial({color:0x818987,roughness:.64,fog:false}),unit=new T.CylinderGeometry(1,1.1,1,8);
  for(let i=1;i<12;i++){
   const pose=cablePose(this.path,i/12,false,0),ground=Math.min(mountainHeight(pose.x,pose.z,WORLD.origin),pose.y-15),height=pose.y-ground;
   const tower=new T.Mesh(unit,support);tower.position.set(pose.x,ground+height/2,pose.z);tower.scale.set(.85,height,.85);tower.userData.accuracy='authored support, not a surveyed pylon';this.group.add(tower);
   const head=new T.Mesh(new T.BoxGeometry(7,.8,2),support);head.position.set(pose.x,pose.y-.4,pose.z);head.rotation.y=pose.yaw;this.group.add(head);
  }
  this.ready=Promise.all(['station','gondola','belvedere'].map(async id=>{
   const source=await originalAsset(id);if(this.disposed){disposeTree(source);return;}
   source.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=false;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial)m.fog=false;}});
   if(id==='station')for(const t of [0,1]){const g=source.clone(true),p=cablePose(this.path,t,false,0);g.position.set(p.x,p.y-6,p.z);g.rotation.y=p.yaw;g.name=`Dajti:station-${t?'upper':'lower'}`;this.group.add(g);}
   if(id==='gondola')for(let i=0;i<12;i++){const g=source.clone(true);g.name=`Dajti:glTF-gondola-${i}`;this.cabins.push(g);this.group.add(g);}
   if(id==='belvedere'){const p=cablePose(this.path,1,false,0);source.position.set(p.x-35,mountainHeight(p.x-35,p.z+45,WORLD.origin),p.z+45);source.name='Dajti:hotel-approximate-offset';this.group.add(source);}
  }).map(p=>p.catch(e=>{this.errors.push(String(e));}))).then(()=>{});
 }
 update(seconds:number,viewer?:T.Vector3){
  for(let i=0;i<this.cabins.length;i++){const round=((seconds/90+i/this.cabins.length)%2+2)%2,p=cablePose(this.path,round%1,round>=1);this.cabins[i].position.set(p.x,p.y-3.4,p.z);this.cabins[i].rotation.y=p.yaw;this.cabins[i].visible=(!viewer||this.cabins[i].position.distanceTo(viewer)<2000)&&(!this.tourCabin?.visible||this.cabins[i].position.distanceTo(this.tourCabin.position)>10);}
 }
 journey(fraction:number){
  if(!this.tourCabin&&this.cabins[0]){this.tourCabin=this.cabins[0].clone(true);this.tourCabin.name='Dajti:passenger-glTF-cabin';this.group.add(this.tourCabin);}
  if(this.tourCabin){const p=cablePose(this.path,fraction);this.tourCabin.position.set(p.x,p.y-3.4,p.z);this.tourCabin.rotation.y=p.yaw;this.tourCabin.visible=this.tour;}
 }
 setTour(value:boolean){this.tour=value;if(this.tourCabin)this.tourCabin.visible=value;const terrain=this.group.getObjectByName('Dajti:non-surveyed-relief') as T.Mesh;const m=terrain.material as T.Material;m.depthTest=value;m.depthWrite=value;terrain.renderOrder=value?0:-900;}
 retire(){this.disposed=true;}
 dispose(){this.disposed=true;disposeTree(this.group);}
}
export class WorldEnhancements {
 readonly group=new T.Group();readonly civic=new CivicDetails();readonly dajti=new DajtiLayer();
 constructor(){this.group.name='Tirana:regional-and-cultural-glTF-layer';this.group.add(this.civic.group,this.dajti.group);}
 update(t:number,camera?:T.PerspectiveCamera){if(camera&&camera.far<18000){camera.far=18000;camera.updateProjectionMatrix();}let viewer:T.Vector3|undefined;if(camera){this.group.updateWorldMatrix(true,false);viewer=this.group.worldToLocal(camera.getWorldPosition(new T.Vector3()));}this.dajti.update(t,viewer);}
 retire(){this.civic.retire();this.dajti.retire();}
 dispose(){this.civic.dispose();this.dajti.dispose();this.group.removeFromParent();}
}
const layers=new WeakMap<T.Scene,WorldEnhancements>();
export function attachEnhancements(scene:T.Scene,origin={x:0,z:0}){
 const found=layers.get(scene);if(found)return found;
 const layer=new WorldEnhancements();layer.group.position.set(-origin.x,0,-origin.z);scene.add(layer.group);layers.set(scene,layer);return layer;
}
