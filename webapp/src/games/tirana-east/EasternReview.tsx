import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {EAST} from './data.mjs';
import {TerrainLayer} from './TerrainLayer';
import {DajtiCableway} from './DajtiCableway';
import {housingGeometry} from './HousingDetails';
import {housingProfile} from './housingCore.mjs';
import {appendBuildingShell,shellGeometry} from '../tirana-neighbourhood/buildingShell';
import {groundHeight} from './terrainCore.mjs';
import {CABLE_STATIONS,cablePoint} from './cableCore.mjs';
import {modelMesh} from './blenderModels';
import {REVIEW} from './reviewData.mjs';
function EasternReview(){
 const holder=useRef<HTMLDivElement>(null),api=useRef<{view:(i:number)=>void;night:(v:boolean)=>void}>(),[selected,setSelected]=useState(0),[night,setNight]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!holder.current)return;const el=holder.current;let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false});}catch{setError('Pamja 3D kërkon WebGL.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;el.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(48,1,.08,55000),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=3;controls.maxDistance=30000;controls.maxPolarAngle=Math.PI*.49;
  const light=new T.DirectionalLight(0xfff1d8,3),hemi=new T.HemisphereLight(0xc8e1ef,0x5e6746,1.5);light.position.set(-100,800,-150);scene.add(light,hemi);
  const terrain=new TerrainLayer(),cable=new DajtiCableway();scene.add(terrain.group,cable.group);
  const pos:number[]=[],colors:number[]=[];for(const b of WORLD.buildings)appendBuildingShell(b,pos,colors);const shell=new T.Mesh(shellGeometry(pos,colors),new T.MeshStandardMaterial({vertexColors:true,roughness:.88}));scene.add(shell);
  const detailParts=WORLD.buildings.filter(b=>housingProfile(b)&&REVIEW.views.slice(0,3).some((v:any)=>Math.hypot(b.p[0][0]-v.x,b.p[0][1]-v.z)<90)).map(b=>housingGeometry(b)).filter(g=>g.hasAttribute('position'));
  if(detailParts.length){const geo=mergeGeometries(detailParts,false);detailParts.forEach(g=>g.dispose());if(geo)scene.add(new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.75})));}
  // The exact sourced road lines remain visible over the same sampled relief.
  const roadPoints:T.Vector3[]=[];for(const r of WORLD.roads){const n=Math.ceil(Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1])/15);for(let j=0;j<n;j++){const a=j/n,b=(j+1)/n;for(const t of [a,b]){const x=r.a[0]+(r.b[0]-r.a[0])*t,z=r.a[1]+(r.b[1]-r.a[1])*t;roadPoints.push(new T.Vector3(x,groundHeight(x,z)+.14,z));}}}
  scene.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(roadPoints),new T.LineBasicMaterial({color:0x9a9c89})));
  const ground=new T.Mesh(new T.PlaneGeometry(11000,10000),new T.MeshStandardMaterial({color:0x9b9a7a,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(-320,-.06,-274);scene.add(ground);
  const market=REVIEW.views[3],stall=modelMesh('produce');stall.position.set(market.x,groundHeight(market.x,market.z)+.1,market.z);stall.rotation.y=market.yaw;scene.add(stall);
  const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=80;const ctx=signCanvas.getContext('2d')!;ctx.fillStyle='#234f26';ctx.fillRect(0,0,512,80);ctx.fillStyle='#fff4d6';ctx.font='500 40px Arial';ctx.textAlign='center';ctx.fillText('FRUTA • PERIME',256,53);const texture=new T.CanvasTexture(signCanvas);texture.colorSpace=T.SRGBColorSpace;const sign=new T.Mesh(new T.PlaneGeometry(4.5,.55),new T.MeshBasicMaterial({map:texture}));sign.position.set(market.x+Math.sin(market.yaw)*.3,groundHeight(market.x,market.z)+3.12,market.z+Math.cos(market.yaw)*.3);sign.rotation.y=market.yaw;scene.add(sign);
  let active=0,time=0,frame=0,disposed=false;const setView=(i:number)=>{active=i;const v=REVIEW.views[i],h=groundHeight(v.x,v.z);controls.target.set(v.x,h+v.height,v.z);camera.position.set(v.x+Math.sin(v.yaw)*v.distance,h+v.height+v.distance*v.lift,v.z+Math.cos(v.yaw)*v.distance);if(v.camera)camera.position.set(...v.camera as [number,number,number]);if(v.target)controls.target.set(...v.target as [number,number,number]);controls.update();terrain.update({x:v.x,z:v.z});};
  api.current={view:setView,night:(n)=>{scene.background=new T.Color(n?0x172d3e:0xa9c9d5);scene.fog=new T.FogExp2(n?0x172d3e:0xa9c9d5,n?.00007:.000022);light.intensity=n?.3:3;hemi.intensity=n?.55:1.5;renderer.toneMappingExposure=n?1.3:1;}};api.current.night(false);setView(0);
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const ro=new ResizeObserver(resize);ro.observe(el);resize();const animate=()=>{if(disposed)return;time+=1/60;controls.update();cable.update(time*10);renderer.render(scene,camera);frame=requestAnimationFrame(animate);};animate();
  return()=>{disposed=true;cancelAnimationFrame(frame);ro.disconnect();controls.dispose();terrain.dispose();cable.dispose();scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});texture.dispose();renderer.dispose();renderer.domElement.remove();api.current=undefined;};
 },[]);
 return <div className="east-review"><div className="east-toolbar"><label>Eksploro <select value={selected} onChange={e=>{const i=Number(e.target.value);setSelected(i);api.current?.view(i);}}>{REVIEW.views.map((v:any,i:number)=><option key={v.name} value={i}>{v.name}</option>)}</select></label><button type="button" aria-pressed={night} onClick={()=>{setNight(!night);api.current?.night(!night);}}>{night?'Ditë':'Natë'}</button></div><div ref={holder} className="east-stage" role="img" aria-label="Pamje 3D e aseteve të Tirana Streets. Tërhiq për ta rrotulluar; zmadho me dy gishta."/>{error&&<p role="alert">{error}</p>}<div className="east-caption" aria-live="polite">{REVIEW.views[selected].name}</div><small className="east-credit">© OpenStreetMap · Mapzen / EU-DEM / USGS · Modele origjinale Blender</small></div>;
}
const root=document.getElementById('tirana-east-review');if(root)createRoot(root).render(<EasternReview/>);
