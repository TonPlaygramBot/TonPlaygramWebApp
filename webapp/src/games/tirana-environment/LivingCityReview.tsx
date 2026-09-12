import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {createWebGLRenderer} from '../tiranastreets/createWebGLRenderer';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {StreetLifeLayer} from '../tirana-street-life/StreetLifeLayer';
import {MappedBuildingCells} from '../tirana-neighbourhood/MappedBuildingCells';
import {UrbanRoadCells} from '../tirana-neighbourhood/UrbanRoadCells';
import {AgedHousingLayer} from '../tirana-city-source/AgedHousingLayer';
import {MappedParkLife} from './MappedParkLife';
import {RainPuddles} from './RainPuddles';
import {MatureTreeLayer} from '../tirana-street-life/MatureTreeLayer';
import {CANOPY_TREES} from '../tirana-street-life/canopyRegistry.mjs';
import {STREET_LIFE} from '../tirana-street-life/registry.mjs';
import {LIVING_REVIEW} from './livingReviewData.mjs';

export function LivingCityReview(){
 const host=useRef<HTMLDivElement>(null),switchView=useRef<(i:number)=>void>(),changeWeather=useRef<(i:number)=>void>(),move=useRef<(x:number,z:number)=>void>();
 const [selected,setSelected]=useState(0),[weather,setWeather]=useState(0),[error,setError]=useState('');
 useEffect(()=>{
  const element=host.current!;let renderer:T.WebGLRenderer;
  try{renderer=createWebGLRenderer();}catch{setError('Pamja 3D kërkon WebGL.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.4));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;element.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(53,1,.04,1600),controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.screenSpacePanning=true;controls.minDistance=1.6;controls.maxDistance=160;controls.maxPolarAngle=Math.PI*.49;
  const hemi=new T.HemisphereLight(0xdcecff,0x817963,2.5),sun=new T.DirectionalLight(0xffebcf,2.6);sun.position.set(-80,100,80);scene.add(hemi,sun);
  const lamps=Array.from({length:4},()=>new T.PointLight(0xffc885,0,28,2));lamps.forEach(l=>scene.add(l));
  const wall=new T.MeshStandardMaterial({vertexColors:true,roughness:.92}),glass=new T.MeshStandardMaterial({color:0x57717e,metalness:.3,roughness:.4}),groundMat=new T.MeshStandardMaterial({color:0x93917c,roughness:1});
  const ground=new T.Mesh(new T.PlaneGeometry(14000,14000).rotateX(-Math.PI/2),groundMat);ground.position.y=-.025;scene.add(ground);
  const buildings=new MappedBuildingCells(WORLD.buildings,wall,glass,true,false),roads=new UrbanRoadCells(false),shops=new StreetLifeLayer(STREET_LIFE as any,{}),housing=new AgedHousingLayer(undefined,false),parks=new MappedParkLife(),rain=new RainPuddles(),trees=new MatureTreeLayer(CANOPY_TREES);
  scene.add(buildings.group,roads.group,shops.group,housing.group,parks.group,rain.group,trees.group);
  const agent=new T.Group();
  for(const part of LIVING_REVIEW.agent){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(part.positions,3));geo.computeVertexNormals();agent.add(new T.Mesh(geo,new T.MeshStandardMaterial({color:part.color,roughness:.8})));}
  scene.add(agent);
  // Display the actual bundled knife geometry beside the full player model.
  const knifeGeo=new T.BufferGeometry();knifeGeo.setAttribute('position',new T.Float32BufferAttribute(LIVING_REVIEW.knife.positions,3));knifeGeo.setAttribute('uv',new T.Float32BufferAttribute(LIVING_REVIEW.knife.uv,2));knifeGeo.computeVertexNormals();
  const knifeMap=new T.TextureLoader().load(LIVING_REVIEW.knife.texture);knifeMap.flipY=false;knifeMap.colorSpace=T.SRGBColorSpace;
  const knife=new T.Mesh(knifeGeo,new T.MeshStandardMaterial({map:knifeMap,roughness:.42,metalness:.45}));knife.position.set(.62,1,0);knife.rotation.set(.1,Math.PI/2,.6);agent.add(knife);
  let phase=0,current=0;
  switchView.current=i=>{current=i;const v=LIVING_REVIEW.views[i],d=v.distance;controls.target.set(v.x,v.height,v.z);camera.position.set(v.x+Math.sin(v.yaw)*d,v.height+d*.24,v.z+Math.cos(v.yaw)*d);agent.visible=i===0;controls.update();lamps.forEach((l,j)=>l.position.set(v.x+Math.cos(j*Math.PI/2)*6,4.2,v.z+Math.sin(j*Math.PI/2)*6));};
  changeWeather.current=i=>{phase=i;const night=i===1;scene.background=new T.Color(night?0x122333:i===2?0x778997:0xc3d8e0);scene.fog=new T.Fog(scene.background,180,700);hemi.intensity=night?.45:i===2?1.4:2.5;sun.intensity=night?.08:i===2?.8:2.6;lamps.forEach(l=>l.intensity=night?95:i===2?18:0);};
  move.current=(x,z)=>{const right=new T.Vector3().setFromMatrixColumn(camera.matrix,0);right.y=0;right.normalize();const forward=new T.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const delta=right.multiplyScalar(x).addScaledVector(forward,z).multiplyScalar(current===0?.32:2);controls.target.add(delta);camera.position.add(delta);controls.update();};
  const resize=()=>{renderer.setSize(element.clientWidth,element.clientHeight,false);camera.aspect=element.clientWidth/element.clientHeight;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(element);resize();switchView.current(0);changeWeather.current(0);
  let frame=0;const start=performance.now();
  const draw=(now:number)=>{try{controls.update();const t=(now-start)/1000,v=controls.target;buildings.update(v,false);roads.update(t,v,false);shops.update(t,v,false);housing.update(t,v,false);parks.update(t,v,false);trees.update(t,v,false);rain.update(t,v,phase===2?1:0,phase===2?1:0,false);renderer.render(scene,camera);frame=requestAnimationFrame(draw);}catch(e){setError('Pamja nuk u ngarkua: '+String(e));}};frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();buildings.dispose();roads.dispose();shops.dispose();housing.dispose();parks.dispose();trees.dispose();rain.dispose();ground.geometry.dispose();groundMat.dispose();wall.dispose();glass.dispose();agent.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose();}});knifeMap.dispose();renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div className="living-review"><div ref={host} className="living-stage" role="img" aria-label="Agjenti dhe vende reale të Tirana Streets në pamje 3D">{error&&<p role="alert">{error}</p>}</div><div className="living-controls"><label>Pamja<select value={selected} onChange={e=>{const i=Number(e.target.value);setSelected(i);switchView.current?.(i);}}>{LIVING_REVIEW.views.map((v,i)=><option key={v.name} value={i}>{v.name}</option>)}</select></label><label>Atmosfera<select value={weather} onChange={e=>{const i=Number(e.target.value);setWeather(i);changeWeather.current?.(i);}}>{['Ditë','Natë','Shi · pellgje'].map((x,i)=><option value={i} key={x}>{x}</option>)}</select></label><div className="living-navigation" aria-label="Lëviz sipas ekranit">{[['←',-1,0,'Majtas'],['↑',0,1,'Përpara'],['↓',0,-1,'Prapa'],['→',1,0,'Djathtas']].map(([icon,x,z,label])=><button key={String(label)} aria-label={String(label)} onClick={()=>move.current?.(Number(x),Number(z))}>{icon}</button>)}</div></div></div>;
}
const root=document.getElementById('tirana-living-review-root');if(root)createRoot(root).render(<LivingCityReview/>);
