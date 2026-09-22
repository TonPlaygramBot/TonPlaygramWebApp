import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {TabakeveQuarterLayer} from '../../tirana-tabakeve/TabakeveQuarterLayer';
import {QUARTER} from '../../tirana-tabakeve/quarterData.mjs';
import {WORLD} from '../shared/world.mjs';
import {facadeModules} from '../../tirana-city-completion/facadeCore.mjs';
import {bakedParts,bakedMaterial} from '../../tirana-city-completion/bakedGeometry';
import {WATER_PATHS,cutChannels,surfaceGeometry,riverRing,bankGeometry} from '../../tirana-environment/riverGeometry';
import './quarter.css';
const views=[
 {id:'bridge',name:'Ura e Tabakëve',x:606,z:120,y:2,d:43},
 {id:'petro',name:'Petro Nini · Njësia 2',x:936,z:237,y:10,d:100},
 {id:'grand',name:'Grandi · Ali Demi',x:1475,z:440,y:12,d:125}
];
export function QuarterReview(){
 const host=useRef<HTMLDivElement>(null),focus=useRef<(id:string)=>void>(()=>{}),[view,setView]=useState(views[0].id),[error,setError]=useState('');
 useEffect(()=>{
  const element=host.current!;let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false});}catch{setError('WebGL nuk është aktiv në këtë pamje.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;element.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Pamje 3D e ndryshimeve të lagjes në Tirana Streets');
  const scene=new T.Scene();scene.background=new T.Color('#b5ced8');scene.fog=new T.Fog('#b5ced8',210,760);
  scene.add(new T.HemisphereLight(0xe4f4ff,0x6c7251,2.7));const sun=new T.DirectionalLight(0xffe5bf,3.2);sun.position.set(100,170,80);scene.add(sun);
  const camera=new T.PerspectiveCamera(48,1,.1,1300),orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.maxPolarAngle=Math.PI*.49;orbit.minDistance=8;orbit.maxDistance=230;
  const layer=new TabakeveQuarterLayer();scene.add(layer.group);
  const resources:T.BufferGeometry[]=[],materials:T.Material[]=[];
  const material=(color:number)=>{const m=new T.MeshStandardMaterial({color,roughness:.85});materials.push(m);return m;};
  const groundMat=material(0x9a9a80),roadMat=material(0x535859),shellMat=material(0xd4c8ae);
  const box=new T.BoxGeometry(1,1,1);resources.push(box);
  function block(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material,yaw=0){const mesh=new T.Mesh(box,m);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.rotation.y=yaw;scene.add(mesh);return mesh;}
  for(const rings of cutChannels([[305,-355],[1855,-355],[1855,795],[305,795]])){
   const geo=surfaceGeometry(rings,-.06);resources.push(geo);scene.add(new T.Mesh(geo,groundMat));}
  const waterMat=material(0x4b7775),bankMat=material(0x71835c);
  for(const path of WATER_PATHS){if(!path.line.some(p=>p[0]>300&&p[0]<1880&&p[1]>-355&&p[1]<795))continue;
   const geo=surfaceGeometry([riverRing(path,0)],-2.85);resources.push(geo);scene.add(new T.Mesh(geo,waterMat));
   for(const side of [-1,1]){const bank=bankGeometry(path,side*path.width/2,-2.85,side*(path.width/2+6.8),-.045);resources.push(bank);scene.add(new T.Mesh(bank,bankMat));}}
  for(const r of WORLD.roads){if(![r.a,r.b].some(p=>p[0]>420&&p[0]<1810&&p[1]>-220&&p[1]<720))continue;
   const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],length=Math.hypot(dx,dz);block((r.a[0]+r.b[0])/2,.01,(r.a[1]+r.b[1])/2,r.w||3,.035,length,roadMat,Math.atan2(dx,dz));}
  for(const b of WORLD.buildings){if(!b.p.some(p=>p[0]>470&&p[0]<1780&&p[1]>-190&&p[1]<680))continue;
   const shape=new T.Shape(b.p.map(p=>new T.Vector2(p[0],-p[1])));
   for(const hole of b.holes||[])shape.holes.push(new T.Path(hole.map(p=>new T.Vector2(p[0],-p[1]))));
   const geo=new T.ExtrudeGeometry(shape,{depth:b.h,bevelEnabled:false});geo.rotateX(-Math.PI/2);resources.push(geo);scene.add(new T.Mesh(geo,shellMat));}
  const trunkGeo=new T.CylinderGeometry(.24,.39,1,7),crownGeo=new T.IcosahedronGeometry(1,1);resources.push(trunkGeo,crownGeo);
  const trunks=new T.InstancedMesh(trunkGeo,material(0x75644b),QUARTER.trees.length),crowns=new T.InstancedMesh(crownGeo,material(0x527540),QUARTER.trees.length),dummy=new T.Object3D();
  QUARTER.trees.forEach((t,i)=>{dummy.position.set(t.x,t.height*.27,t.z);dummy.scale.set(1,t.height*.54,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);dummy.position.y=t.height*.72;dummy.scale.set(t.crown*.5,t.height*.38,t.crown*.5);dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);});scene.add(trunks,crowns);
  const windows=bakedParts('window_bay').map(part=>{resources.push(part.geometry);const mat=bakedMaterial(part.material);materials.push(mat);const mesh=new T.InstancedMesh(part.geometry,mat,1400);scene.add(mesh);return mesh;});
  focus.current=(id)=>{const v=views.find(v=>v.id===id)!;orbit.target.set(v.x,v.y,v.z);camera.position.set(v.x+v.d*.72,v.y+v.d*.38,v.z+v.d*.85);orbit.update();layer.update(-1,orbit.target,false);
   windows.forEach(m=>m.count=0);const nearby=WORLD.buildings.filter(b=>b.p.some(p=>Math.hypot(p[0]-v.x,p[1]-v.z)<125));
   for(const b of nearby)for(const part of facadeModules(b,{allowEstimatedHeight:true})){if(part.model!=='window_bay'||windows[0].count>=1400)continue;dummy.position.set(part.x,part.y,part.z);dummy.rotation.set(0,part.yaw,0);dummy.scale.set(1,1,1);dummy.updateMatrix();windows.forEach(m=>m.setMatrixAt(m.count++,dummy.matrix));}
   windows.forEach(m=>m.instanceMatrix.needsUpdate=true);
  };focus.current(views[0].id);
  const resize=()=>{const w=element.clientWidth,h=element.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const ro=new ResizeObserver(resize);ro.observe(element);resize();
  let raf=0,dead=false;const draw=(t:number)=>{if(dead)return;orbit.update();layer.update(t/1000,orbit.target,false);renderer.render(scene,camera);raf=requestAnimationFrame(draw);};raf=requestAnimationFrame(draw);
  return()=>{dead=true;cancelAnimationFrame(raf);ro.disconnect();orbit.dispose();layer.dispose();trunks.dispose();crowns.dispose();windows.forEach(m=>m.dispose());resources.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <section className="tq-review"><header><strong>TIRANA STREETS</strong><span>Zona e përditësuar · pamje 3D</span></header><label>Zona<select value={view} onChange={e=>{setView(e.target.value);focus.current(e.target.value);}}>{views.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label><div ref={host} className="tq-stage">{error&&<p role="alert">{error}</p>}</div><footer>Zvarrit për rrotullim · dy gishta për zhvendosje dhe zmadhim</footer></section>;
}
const root=document.getElementById('tirana-quarter-preview')||document.getElementById('root');if(root)createRoot(root).render(<QuarterReview/>);
