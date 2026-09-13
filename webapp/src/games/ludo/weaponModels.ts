import * as THREE from 'three';
import { V } from './characterContact';
export type WeaponKind = 'pistol'|'revolver'|'smg'|'rifle'|'marksman'|'shotgun'|'rocket'|'launcher'|'grenade'|'dynamite'|'bottle'|'canister'|'tank';
export type WeaponSpec = { kind: WeaponKind; length: number; twoHands: boolean; ejectsCase: boolean; impact: 'bullet'|'blast'|'fire' };
const spec = (kind: WeaponKind, length: number): WeaponSpec => ({ kind, length,
  twoHands: ['smg','rifle','marksman','shotgun','rocket','launcher'].includes(kind),
  ejectsCase: ['pistol','smg','rifle','marksman','shotgun','launcher','tank'].includes(kind),
  impact: kind==='bottle'?'fire':['rocket','launcher','grenade','dynamite','canister','tank'].includes(kind)?'blast':'bullet' });
// Nominal relative lengths, sharing the human's scale. Vehicles are miniatures.
export const LUDO_WEAPON_SPECS: Readonly<Record<string, WeaponSpec>> = Object.freeze({
  assaultRifleAttack:spec('rifle',.80),fpsGunAttack:spec('rifle',.76),glockSidearmAttack:spec('pistol',.204),
  uziSprayAttack:spec('smg',.47),ak47VolleyAttack:spec('rifle',.88),krsvBurstAttack:spec('rifle',.78),
  smithSidearmAttack:spec('revolver',.25),mosinMarksmanAttack:spec('marksman',1.23),sigsauerTacticalAttack:spec('pistol',.20),
  grenadeBlastAttack:spec('grenade',.095),shotgunBlastAttack:spec('shotgun',1.02),sniperShotAttack:spec('marksman',1.12),
  smgBurstAttack:spec('smg',.50),compactCarbineAttack:spec('rifle',.72),marksmanDmrAttack:spec('marksman',1.0),
  polyShotgun01Attack:spec('shotgun',.96),polyAssaultRifle01Attack:spec('rifle',.82),polyPistol01Attack:spec('pistol',.20),
  polyRevolver01Attack:spec('revolver',.29),polySawedOff01Attack:spec('shotgun',.50),polyRevolver02Attack:spec('revolver',.25),
  polyShotgun02Attack:spec('shotgun',1.0),polyShotgun03Attack:spec('shotgun',.93),polySmg01Attack:spec('smg',.46),
  polyRobotLargeGunAttack:spec('rifle',.95),polyRobotFlyingGunAttack:spec('smg',.53),polyBazooka01Attack:spec('rocket',1.05),
  polyGrenadeLauncher01Attack:spec('launcher',.74),polyDynamiteBomb01Attack:spec('dynamite',.23),polyMolotov01Attack:spec('bottle',.30),
  polyGasTank01Attack:spec('canister',.49),polyHandGrenade01Attack:spec('grenade',.095),polyTank01Attack:spec('tank',.30)
});
export const weaponSpec = (id: string) => LUDO_WEAPON_SPECS[id] || LUDO_WEAPON_SPECS.assaultRifleAttack;
export const isThrownWeapon = (id: string) => ['grenade','dynamite','bottle','canister'].includes(weaponSpec(id).kind);
export const VEHICLE_LENGTHS = Object.freeze({ fighter: .40, helicopter: .32, drone: .18, missile: .27 });
export function fitVehicle(root: THREE.Object3D, kind: keyof typeof VEHICLE_LENGTHS) {
  root.updateWorldMatrix(true,true);
  const size=new THREE.Box3().setFromObject(root).getSize(V());
  root.scale.multiplyScalar(VEHICLE_LENGTHS[kind]/Math.max(size.x,size.z,.001));
}
const steel = new THREE.MeshStandardMaterial({color:'#333a3c',metalness:.75,roughness:.36});
const polymer = new THREE.MeshStandardMaterial({color:'#29302c',roughness:.77});
const wood = new THREE.MeshStandardMaterial({color:'#735038',roughness:.64});
function box(root:THREE.Object3D, size:number[], position:number[], material=polymer) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size as [number,number,number]),material);
  mesh.position.fromArray(position);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
}
function tube(root:THREE.Object3D,radius:number,length:number,position:number[],material=steel) {
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,16),material);
  mesh.rotation.x=Math.PI/2;mesh.position.fromArray(position);mesh.castShadow=true;root.add(mesh);return mesh;
}
function anchor(root:THREE.Object3D,name:string,point:THREE.Vector3) {const o=new THREE.Object3D();o.name=name;o.position.copy(point);root.add(o);return o;}
export function makeWeaponFallback(id:string, scale=.65) {
  const s=weaponSpec(id), L=s.length, root=new THREE.Group();root.name=`ludo-${id}`;
  const pistol=['pistol','revolver'].includes(s.kind), thrown=isThrownWeapon(id);
  if(thrown){
    const radius=s.kind==='canister'?L*.26:s.kind==='bottle'?L*.13:L*.32;
    const mat=new THREE.MeshStandardMaterial({color:s.kind==='bottle'?'#395839':s.kind==='dynamite'?'#964c39':'#526146',roughness:.6,metalness:s.kind==='bottle'?.08:.35});
    const body=tube(root,radius,L*.7,[0,0,0],mat);body.rotation.x=0;
    const cap=tube(root,radius*.45,L*.2,[0,L*.45,0],steel);cap.rotation.x=0;
    if(s.kind==='grenade')box(root,[.012,L*.48,.024],[radius*.8,L*.27,0],steel);
    if(s.kind==='bottle')box(root,[radius*.5,L*.18,radius*.5],[0,L*.6,0],wood);
    if(s.kind==='dynamite')for(const x of [-1,1]){const stick=tube(root,radius*.45,L*.7,[x*radius,0,0],mat);stick.rotation.x=0;}
  }else if(s.kind==='tank'){
    box(root,[L*.48,L*.18,L*.74],[0,0,0]);
    for(const x of [-1,1]){box(root,[L*.13,L*.17,L*.76],[x*L*.25,-L*.055,0],steel);for(let i=0;i<6;i++){const wheel=tube(root,L*.07,L*.025,[x*L*.31,-L*.05,-L*.29+i*L*.115]);wheel.rotation.set(0,0,Math.PI/2);}}
    box(root,[L*.30,L*.14,L*.36],[0,L*.15,-L*.05]);tube(root,L*.022,L*.56,[0,L*.18,L*.26]);
  }else if(['rocket','launcher'].includes(s.kind)){
    tube(root,L*.044,L,[0,.025,0],polymer);tube(root,L*.049,L*.04,[0,.025,L*.48]);
    box(root,[.025,.075,.035],[0,-.025,-L*.1]);box(root,[.038,.065,.065],[0,.06,-L*.21]);
  }else{
    box(root,[pistol?.025:.032,pistol?.035:.05,L*.42],[0,.03,-L*.02],steel);
    box(root,[.028,.072,.040],[0,-.02,-L*.18]);tube(root,pistol?.008:.009,L*.56,[0,.037,L*.22]);
    if(!pistol){
      box(root,[.044,.055,L*.27],[0,.032,L*.12],id==='ak47VolleyAttack'?wood:polymer);
      box(root,[.041,.074,L*.23],[0,.017,-L*.365],id==='ak47VolleyAttack'?wood:polymer);
      box(root,[.045,.077,L*.024],[0,.017,-L*.49]);
      const mag=box(root,[.024,s.kind==='shotgun'?.044:.10,.047],[0,-.038,0]);mag.rotation.x=-.16;
      for(let i=0;i<6;i++)box(root,[.045,.006,.009],[0,.063,L*.02+i*L*.031],steel);
    }
    if(s.kind==='revolver')tube(root,.025,L*.2,[0,.02,-L*.04]);
    if(s.kind==='marksman'){tube(root,.019,L*.24,[0,.095,-L*.02]);box(root,[.015,.027,L*.13],[0,.07,-L*.02]);}
    box(root,[.009,.018,.012],[0,.065,L*.4],steel);
  }
  const grip=thrown?V():V(0,-.02,-L*.18);
  anchor(root,'ludoGrip',grip);anchor(root,'ludoSupport',pistol?grip.clone().add(V(.005,-.01,.012)):V(0,.007,Math.min(L*.13,-L*.49+.35)));
  anchor(root,'ludoMuzzle',thrown?V():V(0,s.kind==='tank'?L*.18:.037,L*.5));
  if(s.twoHands)anchor(root,'ludoStock',V(0,.025,-L*.49));
  anchor(root,'ludoEjection',V(.022,.035,-L*.03));root.scale.setScalar(scale);root.userData.ludoWeaponId=id;
  return root;
}

// Normalize once. Never independently resize the parked and held instances.
export function prepareWeaponModel(source:THREE.Object3D,id:string,scale=.65) {
  const s=weaponSpec(id);if(isThrownWeapon(id)||s.kind==='tank')return makeWeaponFallback(id,scale);
  const root=new THREE.Group();root.name=`ludo-${id}`;root.add(source);source.position.set(0,0,0);source.updateWorldMatrix(true,true);
  const named=(words:RegExp)=>{let result:THREE.Object3D|undefined;source.traverse(n=>{if(!result&&words.test(n.name))result=n;});return result;};
  const muzzleNode=named(/muzzle|barrel.?tip|nozzle/i),gripNode=named(/trigger.?grip|pistol.?grip|right.?grip/i);
  const bounds=new THREE.Box3().setFromObject(source),center=bounds.getCenter(V()),size=bounds.getSize(V());
  const axis=size.x>size.y&&size.x>size.z?0:size.y>size.z?1:2;
  const upAxis=[0,1,2].filter(a=>a!==axis).sort((a,b)=>size.getComponent(b)-size.getComponent(a))[0];
  let sign=1;
  if(muzzleNode)sign=Math.sign(muzzleNode.getWorldPosition(V()).getComponent(axis)-center.getComponent(axis))||1;
  else {
    const spread=[0,0],count=[0,0];
    source.traverse(n=>{const mesh=n as THREE.Mesh;if(!mesh.isMesh||!mesh.visible)return;const pos=mesh.geometry.attributes.position;if(!pos)return;
      for(let i=0;i<pos.count;i+=Math.max(1,Math.floor(pos.count/3000))){const p=V().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld).sub(center);const a=p.getComponent(axis)/Math.max(size.getComponent(axis),.001);if(Math.abs(a)<.38)continue;
        const end=a>0?1:0;p.setComponent(axis,0);spread[end]+=p.lengthSq();count[end]++;}});
    if(count[0]&&count[1]&&spread[0]/count[0]<spread[1]/count[1])sign=-1;
  }
  const forward=V().setComponent(axis,sign),up=V().setComponent(upAxis,1),right=up.clone().cross(forward).normalize();
  const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,forward.clone().cross(right),forward)).invert();
  source.quaternion.premultiply(q);source.updateWorldMatrix(true,true);
  let b=new THREE.Box3().setFromObject(root),sz=b.getSize(V());
  source.scale.multiplyScalar(s.length/Math.max(sz.z,.001));source.updateWorldMatrix(true,true);
  b=new THREE.Box3().setFromObject(root);sz=b.getSize(V());source.position.sub(b.getCenter(V()));source.updateWorldMatrix(true,true);
  b=new THREE.Box3().setFromObject(root);const boreY=b.max.y-sz.y*.22;
  const grip=gripNode?root.worldToLocal(gripNode.getWorldPosition(V())):V(0,b.min.y+sz.y*.36,-s.length*.19);
  anchor(root,'ludoGrip',grip);anchor(root,'ludoSupport',s.twoHands?V(0,boreY-sz.y*.26,Math.min(s.length*.12,b.min.z+.35)):grip.clone().add(V(.004,-.006,.012)));
  anchor(root,'ludoMuzzle',muzzleNode?root.worldToLocal(muzzleNode.getWorldPosition(V())):V(0,boreY,b.max.z));
  if(s.twoHands)anchor(root,'ludoStock',V(0,boreY-.008,b.min.z));
  anchor(root,'ludoEjection',V(sz.x*.5,boreY,-s.length*.06));root.scale.setScalar(scale);root.userData.ludoWeaponId=id;return root;
}
export function weaponPoints(root:THREE.Object3D) {
  const point=(name:string)=>root.getObjectByName(name)!;
  return {grip:point('ludoGrip'),support:point('ludoSupport'),muzzle:point('ludoMuzzle'),stock:root.getObjectByName('ludoStock'),ejection:point('ludoEjection')};
}
