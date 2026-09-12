import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {createWebGLRenderer} from '../tiranastreets/createWebGLRenderer';
import {ReferenceFacades} from '../tirana-city-source/ReferenceFacades';
import {BUSINESS_BUILDING_PROFILES} from '../tirana-city-source/businessBuildingProfiles.mjs';
import {CITY_BUSINESS_BUILDING_PROFILES} from '../tirana-city-source/cityBusinessProfiles.mjs';
import {BUSINESS_SIGNS} from '../tirana-city-source/businessSignRegistry.mjs';
import {STREET_LIFE} from '../tirana-street-life/registry.mjs';
import {StreetLifeLayer} from '../tirana-street-life/StreetLifeLayer';
import {UrbanRoadCells} from '../tirana-neighbourhood/UrbanRoadCells';
import {MappedBuildingCells} from '../tirana-neighbourhood/MappedBuildingCells';
import {MatureTreeLayer} from '../tirana-street-life/MatureTreeLayer';
import {CANOPY_TREES} from '../tirana-street-life/canopyRegistry.mjs';
const REVIEW_PROFILES=document.getElementById('tirana-business-review-root')?.dataset.edition==='city'?CITY_BUSINESS_BUILDING_PROFILES:BUSINESS_BUILDING_PROFILES;
const views=Object.entries(REVIEW_PROFILES).sort(([,a],[,b])=>a.name.localeCompare(b.name)).filter(([,p])=>p.category!=='hotel-part').map(([id,p])=>{
 const b=WORLD.buildings.find(b=>b.id===id)!;
 const xs=b.p.map(v=>v[0]),zs=b.p.map(v=>v[1]);
 return {name:p.name,x:p.detailAnchor?.[0]??(Math.min(...xs)+Math.max(...xs))/2,z:p.detailAnchor?.[1]??(Math.min(...zs)+Math.max(...zs))/2,height:id==='400647876'?44.8:b.h,span:p.detailRadius??Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs)),yaw:Math.atan2(p.front![0],p.front![1])};
});
export function BusinessReview(){
 const host=useRef<HTMLDivElement>(null),switchView=useRef<(i:number)=>void>();
 const [selected,setSelected]=useState(0),[error,setError]=useState('');
 useEffect(()=>{
  const root=host.current!;let renderer:T.WebGLRenderer;
  try{renderer=createWebGLRenderer();}catch{setError('Pamja 3D kërkon WebGL të aktivizuar.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;root.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color(0xc1d4dd);scene.fog=new T.Fog(0xc1d4dd,350,1000);
  scene.add(new T.HemisphereLight(0xe2f2ff,0x858471,2.3));const sun=new T.DirectionalLight(0xffedcf,2.7);sun.position.set(-400,600,150);scene.add(sun);
  const camera=new T.PerspectiveCamera(53,1,.15,1500),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.screenSpacePanning=true;controls.minDistance=5;controls.maxDistance=350;controls.maxPolarAngle=Math.PI*.48;
  const wall=new T.MeshStandardMaterial({vertexColors:true,roughness:.9}),glass=new T.MeshStandardMaterial({color:0x486475,roughness:.4}),groundMaterial=new T.MeshStandardMaterial({color:0x858b74,roughness:1});
  const ground=new T.Mesh(new T.PlaneGeometry(12000,12000).rotateX(-Math.PI/2),groundMaterial);ground.position.y=-.02;
  const buildings=new MappedBuildingCells(WORLD.buildings.filter(b=>!REVIEW_PROFILES[b.id]),wall,glass,false,false),roads=new UrbanRoadCells(false),trees=new MatureTreeLayer(CANOPY_TREES);
  const facades=new ReferenceFacades(WORLD,new Set(Object.keys(REVIEW_PROFILES))),signs=new StreetLifeLayer({storefronts:[...BUSINESS_SIGNS,...STREET_LIFE.storefronts],stops:[],fuel:[],advertising:[]} as any,{},true);
  scene.add(ground,buildings.group,roads.group,trees.group,facades.group,signs.group);
  switchView.current=i=>{const v=views[i],distance=Math.max(v.span,v.height)*1.6/Math.min(1,camera.aspect);controls.target.set(v.x,v.height*.38,v.z);camera.position.set(v.x+Math.sin(v.yaw)*distance,v.height*.55+distance*.24,v.z+Math.cos(v.yaw)*distance);controls.update();};
  const resize=()=>{renderer.setSize(root.clientWidth,root.clientHeight,false);camera.aspect=root.clientWidth/root.clientHeight;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(root);resize();switchView.current(0);
  let frame=0;const start=performance.now();
  const draw=(now:number)=>{try{controls.update();const t=(now-start)/1000,v=controls.target;buildings.update(v,false);roads.update(t,v,false);trees.update(t,v,false);facades.update(v,false);signs.update(t,v,false,true);renderer.render(scene,camera);frame=requestAnimationFrame(draw);}catch(e){setError('Pamja nuk u ngarkua: '+String(e));}};frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();buildings.dispose();roads.dispose();trees.dispose();facades.dispose();signs.dispose();ground.geometry.dispose();wall.dispose();glass.dispose();groundMaterial.dispose();renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div className="business-review"><div ref={host} className="business-stage" role="img" aria-label="Godinat dhe tabelat e bizneseve të Tirana Streets në 3D">{error&&<p role="alert">{error}</p>}</div><label className="business-controls">Godina<select value={selected} onChange={e=>{const i=Number(e.target.value);setSelected(i);switchView.current?.(i);}}>{views.map((v,i)=><option key={v.name} value={i}>{v.name}</option>)}</select></label></div>;
}
const root=document.getElementById('tirana-business-review-root');if(root)createRoot(root).render(<BusinessReview/>);
