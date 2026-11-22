// Creative project artwork. No measurements, manufacturing data or external media.
import * as T from '../../webapp/node_modules/three/build/three.module.js';
import { GLTFExporter } from '../../webapp/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from '../../webapp/node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { writeFile } from 'node:fs/promises';
if (!globalThis.FileReader) globalThis.FileReader=class {
 readAsArrayBuffer(blob) {
   blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();}, error=>this.onerror?.(error));
 }
};
const mat=(name,color,metalness=.16,roughness=.45,emissive=0)=>{
 const m=new T.MeshStandardMaterial({color,metalness,roughness,emissive,emissiveIntensity:.72});
 m.name=name;return m;
};
const enamel=mat('White recycled polymer',0xf2f6f0);
const orange=mat('Rescue-visible orange',0xed681e);
const shade=mat('Safety cuffs orange shade',0xa73d13);
const dark=mat('Charcoal protective rubber',0x272e36,.17,.60);
const slate=mat('Dark slate body',0x374350,.24,.43);
const sky=mat('Teal status indicator',0x49e0d8,.17,.32,0x0b8e84);
const black=mat('Survey array privacy cover',0x132a38,.22,.28);
const warm=mat('Amber status indicator',0xffc05b,.15,.35,0xf47814);
const gray=mat('Utility gray',0xa9bbc1,.31,.46);
const geometry=new Map();
const g=(key,make)=>{
 if(!geometry.has(key)) geometry.set(key,make());
 return geometry.get(key);
};
const mesh=(root,name,geo,m,x=0,y=0,z=0)=>{
 const v=new T.Mesh(geo,m);v.name=name;
 v.position.set(x,y,z);root.add(v);return v;
};
const box=(root,name,m,x,y,z,w,h,d,r=.018)=>
 mesh(root,name,g('box-'+[w,h,d,r],()=>new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3))),m,x,y,z);
const band=(root,name,m,x,y,z,r,t)=>{
 const ring=mesh(root,name,g('band-'+[r,t],()=>new T.TorusGeometry(r,t,6,24)),m,x,y,z);
 ring.rotation.x=Math.PI/2;return ring;
};
const cyl=(root,name,m,x,y,z,r,h)=>
 mesh(root,name,g('cyl-'+[r,h],()=>new T.CylinderGeometry(r,r,h,12)),m,x,y,z);
const grp=(root,name,x=0,y=0,z=0)=>{
 const o=new T.Group();o.name=name;o.position.set(x,y,z);root?.add(o);return o;
};
const root=grp(null,'Civil_Survey_Drone');
root.userData={assetRole:'Unarmed fictional municipal survey drone',forward:'+Z',up:'+Y',source:'Original project geometry and materials'};
box(root,'Lower_Shell',slate,0,-.020,0,.485,.145,.608,.050);
box(root,'White_Upper_Shell',enamel,0,.070,.010,.490,.142,.608,.053);
box(root,'Safety_Nose',orange,0,.069,.299,.367,.100,.075,.029);
box(root,'Utility_Saddle',orange,0,.138,-.041,.285,.046,.283,.026);
box(root,'Power_Panel',dark,0,.161,-.051,.200,.022,.181,.011);
box(root,'Power_Status',sky,0,.174,-.020,.057,.011,.035,.004);
box(root,'Status_Rear',warm,0,.070,-.313,.171,.020,.008,.006);
// Broad, flush safety status panel, not a protruding external payload.
box(root,'Survey_Status_Panel',black,0,.047,.339,.221,.046,.013,.012);
box(root,'Survey_Status_Bar',sky,0,.047,.349,.154,.012,.012,.003);
for(const x of [-.263,.263]){
 box(root,'Side_Rail_'+x,gray,x,.057,.010,.050,.075,.311,.025);
 box(root,'Safety_Tag_'+x,orange,x,.059,.046,.057,.036,.128,.012);
 for(const z of [-.203,.203]){
  const shoe=box(root,'Soft_Landing_Pad_'+x+'_'+z,dark,x,-.15,z,.111,.054,.151,.026);
  shoe.rotation.y=x*z*.6;
  const strut=box(root,'Landing_Support_'+x+'_'+z,slate,x,-.108,z,.057,.105,.069,.013);
  strut.rotation.z=Math.sign(x)*.30;
 }
}
for(const [code,x,z,spin] of [['FL',-.570,.475,-1],['FR',.570,.475,1],['RL',-.570,-.475,1],['RR',.570,-.475,-1]]){
 const socket=grp(root,'Arm_'+code,x,.038,z);
 const dx=x-Math.sign(x)*.152, dz=z-Math.sign(z)*.143;
 const arm=box(root,'Composite_Arm_'+code,slate,x-dx*.50,.023,z-dz*.50,.102,.072,Math.hypot(dx,dz)+.158,.021);
 arm.rotation.y=Math.atan2(dx,dz);
 const slip=box(root,'Arm_Deflector_'+code,enamel,x-dx*.42,.063,z-dz*.42,.088,.030,Math.hypot(dx,dz)*.51,.014);
 slip.rotation.y=arm.rotation.y;
 band(socket,'Safety_Duct_'+code,orange,0,.034,0,.231,.027);
 band(socket,'Duct_Lower_Rail_'+code,shade,0,.005,0,.225,.013);
 cyl(socket,'Motor_Housing_'+code,dark,0,.006,0,.069,.092);
 cyl(socket,'Motor_Collar_'+code,gray,0,.047,0,.075,.033);
 for(let k=0;k<3;k++){
  const a=k*2*Math.PI/3;
  const rib=box(socket,'Guard_Spoke_'+code+'_'+k,shade,Math.sin(a)*.136,0,Math.cos(a)*.136,.030,.025,.189,.008);
  rib.rotation.y=a;
 }
 const rotor=grp(socket,'Rotor_'+code,0,.072,0);
 rotor.userData={spinAxis:'Y',spinDirection:spin,animatedByHost:true};
 cyl(rotor,'Rotor_Hub_'+code,dark,0,0,0,.049,.029);
 for(let i=0;i<3;i++){
  const blade=grp(rotor,'Blade_'+code+'_'+i);blade.rotation.y=i*2*Math.PI/3;
  const bladeTip=box(blade,'Prop_Color_'+code+'_'+i,enamel,0,0,.168,.041,.012,.059,.006);
  bladeTip.rotation.y=spin*.16;
  const paddle=box(blade,'Prop_Blade_'+code+'_'+i,slate,0,0,.103,.041,.014,.132,.007);
  paddle.rotation.y=spin*.14;
 }
 box(socket,'Status_Dot_'+code,z>0?sky:warm,0,.053,z>0?.234:-.234,.068,.014,.027,.006);
}
root.updateMatrixWorld(true);
const glb=await new GLTFExporter().parseAsync(root,{binary:true,trs:true});
const result=Buffer.from(glb);
await writeFile(new URL('../../webapp/public/assets/optika-tirana-v1/assets/civil-survey-drone.glb', import.meta.url),result);
console.log('civil-survey-drone.glb',result.length,'bytes');
