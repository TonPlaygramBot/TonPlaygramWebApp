import * as T from 'three';
import {driverEye,driverSocket,driverDirection,driverUp,type DriverCar} from './shared/driverView.mjs';
import {cabinAssetId,cabinSurface,cabinSteeringSurface,hasAuthoredCabin} from './shared/vehicleCabins.mjs';

type Driven=DriverCar&{id?:string;steering?:number;speed?:number};
/** One active cabin, sharing original embedded PBR maps where the GLB includes
 * an identifiable interior. Basic cabins are an authored fallback; they are
 * deliberately not presented as scanned manufacturer dashboards. */
export class DriverInterior {
 readonly group=new T.Group();
 private model?:T.Group;
 private source?:T.Object3D;
 private key='';
 private wheel?:T.Object3D;
 private needle?:T.Object3D;
 private geometries=new Set<T.BufferGeometry>();
 private materials=new Set<T.Material>();
 private readonly normal=new T.Vector3(0,.18,1).normalize();
 constructor(){this.group.name='Tirana:driver-interior';this.group.visible=false;}
 update(car:Driven|undefined,sample?:(x:number,z:number)=>number,exterior?:T.Object3D){
  this.group.visible=!!car&&!driverSocket(car).open;
  if(!car||!this.group.visible){if(!car)this.clear();return;}
  const key=`${car.id||''}:${cabinAssetId(car)||car.forceVehicle||car.racingAsset||car.model}`;
  if(key!==this.key||exterior!==this.source){
   this.clear();this.key=key;this.source=exterior;
   this.model=exterior&&hasAuthoredCabin(car)?this.original(car,exterior):undefined;
   this.group.userData.cabinSource=this.model?'original-vehicle-materials':'authored-basic-cabin';
   this.model??=this.basic(car);this.group.add(this.model);
  }
  const eye=driverEye(car,sample),up=driverUp(car,sample),forward=driverDirection(car,car.heading,0,sample);
  this.group.position.set(eye.x,eye.y,eye.z);this.group.up.set(up.x,up.y,up.z);
  this.group.lookAt(eye.x-forward.x,eye.y-forward.y,eye.z-forward.z);
  if(this.wheel)this.wheel.quaternion.setFromAxisAngle(this.normal,-(car.steering||0)*1.7);
  if(this.needle)this.needle.rotation.z=2.2-Math.min(1,Math.abs(car.speed||0)/60)*4.4;
 }
 private original(car:Driven,source:T.Object3D){
  const cabin=new T.Group(),steering:T.Mesh[]=[];
  source.updateWorldMatrix(true,true);
  const inverse=new T.Matrix4().copy(source.matrixWorld).invert();
  // Collection roots expose native +X geometry. Ordinary traffic wrappers
  // have already turned the same GLB to +Z before the actor heading is applied.
  const frameYaw=car.collectionVehicle||car.racingAsset?Math.PI/2:Math.PI;
  const seat=driverSocket(car),toEye=new T.Matrix4().makeTranslation(-seat.x,-seat.y,-seat.z)
   .multiply(new T.Matrix4().makeRotationY(frameYaw));
  source.traverse(object=>{
   if(!(object instanceof T.Mesh)||object instanceof T.SkinnedMesh)return;
   const all=Array.isArray(object.material)?object.material:[object.material];
   const selected=all.map(m=>cabinSurface(car,object.name,m.name));if(!selected.some(Boolean))return;
   const mesh=new T.Mesh(object.geometry,object.material);
   // Mixed-material surfaces retain only their cabin draw groups. Original
   // geometry and maps remain owned by the exterior source cache.
   if(selected.some(v=>!v)){
    mesh.geometry=object.geometry.clone();this.geometries.add(mesh.geometry);mesh.geometry.clearGroups();
    for(const g of object.geometry.groups)if(selected[g.materialIndex||0])mesh.geometry.addGroup(g.start,g.count,g.materialIndex);
    if(!mesh.geometry.groups.length)return;
   }
   mesh.name=`Cabin:${object.name}`;mesh.castShadow=false;mesh.receiveShadow=true;
   mesh.matrix.copy(toEye).multiply(inverse).multiply(object.matrixWorld);
   mesh.matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);cabin.add(mesh);
   if(all.some(m=>cabinSteeringSurface(object.name,m.name))){
    mesh.updateMatrixWorld(true);
    // Some original materials also cover seats/door stitching. Do not rotate
    // a material batch larger than a real steering wheel.
    const size=new T.Box3().setFromObject(mesh).getSize(new T.Vector3());
    if(Math.max(size.x,size.y,size.z)<.7)steering.push(mesh);
   }
  });
  if(!cabin.children.length)return undefined;
  // Only explicit steering geometry is reparented; no guessed dashboard mesh
  // is rotated. Imported steering hubs otherwise stay exactly as authored.
  if(steering.length){
   cabin.updateMatrixWorld(true);const bounds=new T.Box3();for(const mesh of steering)bounds.expandByObject(mesh);
   const pivot=new T.Group();pivot.position.copy(bounds.getCenter(new T.Vector3()));cabin.add(pivot);cabin.updateMatrixWorld(true);
   for(const mesh of steering)pivot.attach(mesh);this.wheel=pivot;
  }
  return cabin;
 }
 private basic(car:Driven){
  const group=new T.Group(),seat=driverSocket(car),id=cabinAssetId(car)||car.forceVehicle||car.model||'';
  const bus=car.model==='tirana-bus',sport=/ferrari|bugatti|bmw|sport/.test(id),utility=/range|landrover|defender|van|armored|suv/.test(id);
  const material=(color:T.ColorRepresentation,roughness=.8,metalness=0)=>{const m=new T.MeshStandardMaterial({color,roughness,metalness});this.materials.add(m);return m;};
  const charcoal=material(0x161a1d),trim=material(utility?0x414749:sport?0x303237:0x493d32,.45,.18),metal=material(0x8a9096,.3,.65),black=material(0x080b0d),screen=material(sport?0x203c48:0x233735,.4);
  const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>{
   const geo=new T.BoxGeometry(w,h,d);this.geometries.add(geo);const mesh=new T.Mesh(geo,m);mesh.name=name;mesh.position.set(x,y,z);mesh.receiveShadow=true;group.add(mesh);return mesh;
  };
  const center=-seat.x,width=seat.width*.91,depth=bus?.7:utility?.58:.49;
  box('Basic dashboard',width,.24,depth,center,-.49,-.83,charcoal);
  box('Dashboard trim',width,.035,.04,center,-.48,-.54,trim);
  box('Centre console',bus?.4:.23,.45,.35,center+.12,-.66,-.65,charcoal);
  box('Instrument binnacle',.47,.2,.2,0,-.30,-.73,charcoal);
  box('Instrument glass',.42,.15,.014,0,-.28,-.619,black);
  box('Centre screen',utility?.23:.33,.19,.025,center+.12,-.32,-.56,screen);
  for(const side of [-1,1]){
   box('Door upper',.07,.18,.88,center+side*width*.51,-.52,-.03,charcoal);
   box('Air vent',.17,.07,.015,side<0?center-width*.41:center+width*.4,-.43,-.55,black);
  }
  const pivot=new T.Group();pivot.position.set(0,-.4,-.39);group.add(pivot);this.wheel=pivot;
  const ringGeo=new T.TorusGeometry(bus?.24:.215,.019,8,36);this.geometries.add(ringGeo);const ring=new T.Mesh(ringGeo,charcoal);pivot.add(ring);
  for(const angle of [0,Math.PI*.7,-Math.PI*.7]){
   const geo=new T.BoxGeometry(.025,.19,.025);this.geometries.add(geo);const spoke=new T.Mesh(geo,metal);spoke.rotation.z=angle;spoke.position.set(-Math.sin(angle)*.09,Math.cos(angle)*.09,0);pivot.add(spoke);
  }
  const hubGeo=new T.CylinderGeometry(.065,.065,.04,16);this.geometries.add(hubGeo);const hub=new T.Mesh(hubGeo,charcoal);hub.rotation.x=Math.PI/2;pivot.add(hub);
  const needlePivot=new T.Group();needlePivot.position.set(-.10,-.27,-.605);group.add(needlePivot);this.needle=needlePivot;
  const needleGeo=new T.BoxGeometry(.007,.06,.007);this.geometries.add(needleGeo);const needle=new T.Mesh(needleGeo,material(0xe9b259));needle.position.y=.026;needlePivot.add(needle);
  group.userData.profile=bus?'bus':utility?'utility':sport?'sport':'road';return group;
 }
 private clear(){
  this.model?.removeFromParent();this.model=undefined;this.source=undefined;this.key='';this.wheel=undefined;this.needle=undefined;
  for(const geometry of this.geometries)geometry.dispose();this.geometries.clear();
  for(const material of this.materials)material.dispose();this.materials.clear();
 }
 dispose(){this.clear();this.group.clear();this.group.removeFromParent();}
}
