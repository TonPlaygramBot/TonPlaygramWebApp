// Original geometric artwork. No models, photos, raster textures or likenesses imported.
// From assets-source/optika-3d: node build-optika-actors.mjs ../../webapp/public/assets/optika-3d-v1/worlds
import * as THREE from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Three's browser-oriented GLTFExporter uses FileReader for glb assembly.
if (!globalThis.FileReader) globalThis.FileReader=class {
  readAsArrayBuffer(blob){
    blob.arrayBuffer().then(buffer=>{
      this.result=buffer;
      this.onloadend?.();
    },error=>this.onerror?.(error));
  }
};
const out=path.resolve(process.argv[2]||'.');
await mkdir(out,{recursive:true});
const { Group, Mesh, MeshStandardMaterial, AnimationClip, QuaternionKeyframeTrack,
   VectorKeyframeTrack, Quaternion, Vector3, SphereGeometry, CylinderGeometry, TorusGeometry }=THREE;
const p=(color,metalness=.30,roughness=.45,emissive=0)=>new MeshStandardMaterial({color,metalness,roughness,emissive,emissiveIntensity:.8});
const slate=p(0x27323b,.55,.57), rubber=p(0x152029,.08,.74), silver=p(0xb4bdc3,.72,.28),
  dark=p(0x101b24,.3,.3), seam=p(0x53636d,.68,.31);
const teal=p(0x18adad,.5,.3,0x056266), amber=p(0xe6922c,.42,.38,0x6a2e04),
  white=p(0xe1e7df,.23,.41), orange=p(0x994f20,.48,.58),
  glass=p(0x183643,.65,.18), ink=p(0x10232c,.32,.42);
const safe=(name)=>name.replace(/[^a-zA-Z0-9_]/g,'_');
function group(parent,name,x=0,y=0,z=0) {
 const g=new Group();g.name=safe(name);g.position.set(x,y,z);
 parent?.add(g);return g;
}
function mesh(parent,name,geometry,m,x=0,y=0,z=0){
 const v=new Mesh(geometry,m); v.name=safe(name);v.position.set(x,y,z);parent.add(v);return v;
}
function panel(parent,name,m,x,y,z,w,h,d,r=.018){
 return mesh(parent,name,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),m,x,y,z);
}
function sphere(parent,name,m,x,y,z,w,h,d){
 const v=mesh(parent,name,new SphereGeometry(1,12,8),m,x,y,z);v.scale.set(w,h,d);return v;
}
function axisY(parent,name,m,x,y,z,r,h){
 return mesh(parent,name,new CylinderGeometry(r,r,h,14),m,x,y,z);
}
function joint(parent,name,m,x,y,z,r,h){
 const v=axisY(parent,name,m,x,y,z,r,h); v.rotation.z=Math.PI/2;return v;
}
function ring(parent,name,m,x,y,z,r,thickness){
 return mesh(parent,name,new TorusGeometry(r,thickness,7,22),m,x,y,z);
}
const AX=new Vector3(1,0,0), AY=new Vector3(0,1,0), AZ=new Vector3(0,0,1);
const clipAngles=(node,axis,frames,angles)=>new QuaternionKeyframeTrack(node.name+'.quaternion',frames,angles.flatMap(a=>new Quaternion().setFromAxisAngle(axis,a).toArray()));
function animation(actor, name,duration,magnitude,step){
 const {frame,head,hipL,hipR,kneeL,kneeR,armL,armR,elbowL,elbowR}=actor;
 const t=name==='Idle'?[0,.62,1.22,1.8,2.4]:[0,duration*.25,duration*.5,duration*.75,duration];
 const tracks=[];
 const sway=name==='Idle'?[0,.013,0,-.013,0]:[0,step,0,step,0];
 tracks.push(new VectorKeyframeTrack(frame.name+'.position',t,sway.flatMap(v=>[0,v,0])));
 if(name==='Idle'){
  tracks.push(clipAngles(head,AY,t,[0,-.032,0,.032,0]),clipAngles(armL,AZ,t,[-.08,-.10,-.08,-.06,-.08]),clipAngles(armR,AZ,t,[.08,.06,.08,.10,.08]));
 }else{
  tracks.push(clipAngles(hipL,AX,t,[-magnitude,0,magnitude,0,-magnitude]));
  tracks.push(clipAngles(hipR,AX,t,[magnitude,0,-magnitude,0,magnitude]));
  tracks.push(clipAngles(kneeL,AX,t,[0,.10,.05,magnitude*.95,0]));
  tracks.push(clipAngles(kneeR,AX,t,[.05,magnitude*.95,0,.10,.05]));
  tracks.push(clipAngles(armL,AX,t,[magnitude*.63,.04,-magnitude*.63,-.04,magnitude*.63]));
  tracks.push(clipAngles(armR,AX,t,[-magnitude*.63,-.04,magnitude*.63,.04,-magnitude*.63]));
  tracks.push(clipAngles(elbowL,AX,t,[-.21,-.29,-.37,-.29,-.21]));
  tracks.push(clipAngles(elbowR,AX,t,[-.37,-.29,-.21,-.29,-.37]));
  tracks.push(clipAngles(head,AY,t,[.026,0,-.026,0,.026]));
 }
 return new AnimationClip(name,duration,tracks);
}
function makeActor(patrol){
 const root=group(null,patrol?'Survey_Patrol_Robot':'Optika_Explorer_Robot');
 root.userData.provenance='Original generated geometry and materials, no external data or likenesses.';
 const frame=group(root,'Frame');
 const a=patrol?amber:teal, shell=patrol?orange:white;
 panel(frame,'Pelvis',slate,0,.88,0,.30,.19,.22,.036);
 panel(frame,'Chest_Chassis',slate,0,1.26,0,.40,.46,.27,.053);
 panel(frame,'Chest_Enamel',shell,0,1.31,.124,.345,.31,.08,.04);
 panel(frame,'Dorsal_Battery',rubber,0,1.24,-.153,.28,.36,.116,.032);
 panel(frame,'Dorsal_Display',a,0,1.34,-.216,.15,.045,.012,.004);
 panel(frame,'Waist_Lintel',silver,0,1.012,.06,.27,.045,.112,.012);
 ring(frame,'Survey_Wave_Bezel',seam,0,1.336,.168,.067,.009);
 ring(frame,'Survey_Wave',a,0,1.336,.181,.054,.008);
 sphere(frame,'Core_Signal',a,0,1.336,.18,.021,.021,.009);
 for (let i=0;i<3;i++) panel(frame,'Dorsal_Heatsink_'+i,seam,-.07+i*.07,1.18,-.218,.014,.119,.017,.005);
 axisY(frame,'Neck_Collar',silver,0,1.527,0,.072,.077);
 const head=group(frame,'Head_Pivot',0,1.54,0);
 panel(head,'Helmet',shell,0,.12,.014,.285,.234,.258,.057);
 panel(head,'Visor_Recess',glass,0,.111,.142,.243,.073,.041,.016);
 for(const x of [-.066,0,.066]) panel(head,'Optical_Pixel_'+(x+1),a,x,.112,.165,x===0?.036:.026,.027,.012,.004);
 panel(head,'Forehead_Tile',slate,0,.205,.116,.137,.035,.049,.01);
 panel(head,'Crown_Beacon',a,0,.247,-.018,.103,.027,.073,.009);
 for(const s of [-1,1]){
   joint(head,'Ear_Radome_'+s,silver,s*.15,.128,-.024,.056,.039);
   joint(head,'Ear_Detail_'+s,dark,s*.175,.128,-.024,.039,.015);
 }
 const parts={root,frame,head};
 for(const [s,id] of [[-1,'L'],[1,'R']]){
   const hip=group(frame,'Hip_'+id,s*.099,.86,0);
   joint(hip,'Hip_Bearing_'+id,seam,0,-.015,0,.068,.154);
   panel(hip,'Upper_Leg_'+id,slate,0,-.173,0,.144,.285,.153,.026);
   panel(hip,'Upper_Enamel_'+id,shell,0,-.149,.072,.127,.191,.056,.014);
   const knee=group(hip,'Knee_'+id,0,-.334,0);
   joint(knee,'Knee_Bearing_'+id,silver,0,0,0,.061,.154);
   panel(knee,'Knee_Pad_'+id,rubber,0,.001,.055,.099,.092,.073,.027);
   panel(knee,'Shin_'+id,slate,0,-.185,0,.149,.287,.159,.029);
   panel(knee,'Shin_Enamel_'+id,shell,0,-.169,.071,.125,.198,.070,.025);
   panel(knee,'Shin_ID_'+id,a,0,-.192,.109,.072,.014,.013,.004);
   panel(knee,'Sole_'+id,rubber,0,-.49,.046,.174,.067,.244,.012);
   panel(knee,'Boot_'+id,dark,0,-.452,.043,.162,.085,.232,.021);
   panel(knee,'Toe_Marking_'+id,a,0,-.420,.115,.068,.022,.062,.005);
   const arm=group(frame,'Shoulder_'+id,s*.247,1.4,0);
   joint(arm,'Shoulder_Bearing_'+id,seam,0,0,0,.088,.148);
   panel(arm,'Shoulder_Plate_'+id,shell,s*.028,-.009,0,.173,.157,.218,.039);
   panel(arm,'Arm_Frame_'+id,slate,0,-.157,0,.115,.212,.132,.021);
   const elbow=group(arm,'Elbow_'+id,0,-.258,0);
   joint(elbow,'Elbow_Bearing_'+id,silver,0,0,0,.051,.125);
   panel(elbow,'Forearm_'+id,shell,0,-.124,.020,.116,.179,.145,.025);
   panel(elbow,'Wrist_Edge_'+id,a,0,-.173,.081,.068,.021,.014,.006);
   panel(elbow,'Three_Digit_Manipulator_'+id,rubber,0,-.243,.025,.088,.092,.094,.023);
   for(let j=-1;j<=1;j++) panel(elbow,'Finger_'+id+'_'+j,dark,j*.024,-.276,.055,.013,.059,.019,.004);
   parts['hip'+id]=hip; parts['knee'+id]=knee; parts['arm'+id]=arm; parts['elbow'+id]=elbow;
 }
 return [root,[animation(parts,'Idle',2.4,0,0),animation(parts,'Walk',.98,.37,.020),animation(parts,'Run',.63,.70,.055)]];
}
function makeFPV(){
 const root=group(null,'Handheld_Survey_Viewer');
 root.userData.provenance='Original fictional display instrument. No firearm, external model, photograph or likeness.';
 // A compact survey display low in the camera view, with beveled overlay and
 // two articulated-looking rover manipulators. Negative Z is into the lens.
 const lower=group(root,'Viewer',.052,-.145,-.62);
 lower.scale.setScalar(.77);lower.rotation.z=-.07;lower.rotation.x=-.13;
 panel(lower,'Enclosure',ink,0,0,0,.228,.139,.091,.022);
 panel(lower,'Front_Frame',white,0,0,.040,.211,.117,.026,.016);
 panel(lower,'Screen',glass,0,.010,.056,.162,.067,.009,.007);
 ring(lower,'Scan_Outer',teal,-.004,.010,.064,.023,.002);
 ring(lower,'Scan_Inner',teal,-.004,.010,.065,.011,.0018);
 for(let i=0;i<3;i++)panel(lower,'Signal_'+i,teal,.055+i*.013,-.01+i*.006,.064,.005,.016+i*.007,.003,.001);
 panel(lower,'Control_Bead',amber,0,-.037,.058,.024,.009,.006,.002);
 for(const [x,s] of [[-.042,-1],[.111,1]]){
  const hand=group(root,'Cuff_'+s,x,-.183,-.605);
  hand.scale.setScalar(.78);hand.rotation.z=s*.22; hand.rotation.x=.40;
  panel(hand,'Forearm_'+s,slate,0,-.073,.109,.074,.082,.246,.028);
  panel(hand,'Cuff_Detail_'+s,teal,0,-.036,.025,.064,.015,.068,.006);
  sphere(hand,'Receiver_Hand_'+s,rubber,0,.006,-.009,.047,.037,.06);
  for(const k of [-1,0,1])panel(hand,'Digit_'+s+'_'+k,rubber,k*.018,.02,-.031,.014,.022,.052,.006);
 }
 return [root,[]];
}
async function save(file,[scene,animations]){
 scene.updateMatrixWorld(true);
 const glb=await new GLTFExporter().parseAsync(scene,{binary:true,animations,trs:true});
 const b=Buffer.from(glb); await writeFile(path.join(out,file),b);
 console.log(file,b.byteLength);
}
await save('hero.glb',makeActor(false));
await save('guard.glb',makeActor(true));
await save('rig-fpv.glb',makeFPV());
