import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {CANOPY_TREES} from '../tirana-street-life/canopyRegistry.mjs';
import {CITY_COMPLETION} from '../tirana-city-completion/data.mjs';
import {LandscapeVisuals} from '../tiranastreets/landscapeVisuals';
import {UrbanRoadCells} from '../tirana-neighbourhood/UrbanRoadCells';
import {MappedBuildingCells} from '../tirana-neighbourhood/MappedBuildingCells';
import {MatureTreeLayer} from '../tirana-street-life/MatureTreeLayer';
import {createWebGLRenderer} from '../tiranastreets/createWebGLRenderer';
import {cutChannels,surfaceGeometry} from './riverGeometry';
import {ReferenceFacades} from '../tirana-city-source/ReferenceFacades';
import {InstitutionLayer} from '../tirana-city-source/InstitutionLayer';
import {BuildingBrandLayer} from '../tirana-city-source/BuildingBrandLayer';
import {StreetLifeLayer} from '../tirana-street-life/StreetLifeLayer';
import {NEIGHBOURHOOD_REFERENCE_PROFILES} from '../tirana-city-source/neighbourhoodProfiles.mjs';
const VIEWS=[{name:'Sami',x:12,z:-620,height:30,distance:95,yaw:-1.7},{name:'Servete',x:255,z:-550,height:24,distance:75,yaw:.95},{name:'Book',x:140,z:-15,height:44,distance:150,yaw:.65},{name:'Lagjja',x:-360,z:465,height:90,distance:170,yaw:.5},{name:'Toptani',x:333,z:122,height:20,distance:90,yaw:2.9}];
export function RealismReview(){
 const host=useRef<HTMLDivElement>(null),switchView=useRef<(i:number)=>void>(),quality=useRef(false);
 const [selected,setSelected]=useState(0),[battery,setBattery]=useState(false),[status,setStatus]=useState('Duke ngarkuar…'),[error,setError]=useState('');
 useEffect(()=>{
  const root=host.current!;let renderer:T.WebGLRenderer;
  try{renderer=createWebGLRenderer();}catch{setError('Pamja 3D kërkon WebGL të aktivizuar.');return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.35));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;root.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color(0xc1d4dd);scene.fog=new T.Fog(0xc1d4dd,1350,2700);
  scene.add(new T.HemisphereLight(0xe2f2ff,0x858471,2.3));const sun=new T.DirectionalLight(0xffedcf,2.7);sun.position.set(-400,600,150);scene.add(sun);
  const camera=new T.PerspectiveCamera(53,1,.15,3500),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=8;controls.maxDistance=1600;controls.maxPolarAngle=Math.PI*.47;controls.screenSpacePanning=true;
  const landscape=new LandscapeVisuals(false),roads=new UrbanRoadCells(false);
  const wall=new T.MeshStandardMaterial({vertexColors:true,roughness:.9}),glass=new T.MeshStandardMaterial({color:0x486475,roughness:.4});
  const buildings=new MappedBuildingCells(WORLD.buildings.filter(b=>!NEIGHBOURHOOD_REFERENCE_PROFILES[b.id]&&b.id!=='177186612'),wall,glass,false,false),trees=new MatureTreeLayer([...CANOPY_TREES,...CITY_COMPLETION.trees]);
  const facades=new ReferenceFacades(WORLD,new Set([...Object.keys(NEIGHBOURHOOD_REFERENCE_PROFILES),'177186612'])),institutions=new InstitutionLayer(),brands=new BuildingBrandLayer(),shops=new StreetLifeLayer();
  scene.add(landscape.group,roads.group,buildings.group,trees.group,facades.group,institutions.group,brands.group,shops.group);
  const grass=new T.MeshStandardMaterial({color:0x769463,roughness:1}),stone=new T.MeshStandardMaterial({color:0xbcb9a9,roughness:1});
  for(const [polygons,material,y] of [[WORLD.parks,grass,.05],[WORLD.areas,stone,.065]] as const)for(const p of polygons)for(const dry of cutChannels(p))scene.add(new T.Mesh(surfaceGeometry(dry,y),material));
  switchView.current=i=>{const v=VIEWS[i];controls.target.set(v.x,3,v.z);camera.position.set(v.x+Math.sin(v.yaw)*v.distance,v.height,v.z+Math.cos(v.yaw)*v.distance);controls.update();};switchView.current(0);
  const resize=()=>{renderer.setSize(root.clientWidth,root.clientHeight,false);camera.aspect=root.clientWidth/root.clientHeight;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(root);resize();
  let frame=0,start=performance.now(),labelAt=0;
  const draw=(now:number)=>{
   try{
    const seconds=(now-start)/1000;controls.update();const viewer=controls.target;
    roads.update(seconds,viewer,quality.current);buildings.update(viewer,quality.current);trees.update(seconds,viewer,quality.current);landscape.update(viewer,seconds,quality.current);
    facades.update(viewer,quality.current);institutions.update(seconds,viewer,quality.current);brands.update(seconds,viewer,quality.current);shops.update(seconds,viewer,quality.current);
    renderer.render(scene,camera);
    if(now-labelAt>750){labelAt=now;const loading=roads.group.userData.pendingJobs+buildings.group.userData.pendingJobs;setStatus(`${trees.group.userData.visibleTrunks||0} pemë · ${loading?'duke ngarkuar':'Tirana Streets'}`);}
    frame=requestAnimationFrame(draw);
   }catch(e){setError('Pamja nuk u ngarkua: '+String(e));}
  };frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();facades.dispose();institutions.dispose();brands.dispose();shops.dispose();roads.dispose();buildings.dispose();trees.dispose();landscape.dispose();scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});for(const m of [wall,glass,grass,stone])m.dispose();renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div className="canopy-review"><div className="canopy-stage" ref={host} role="img" aria-label="Harta 3D e Tirana Streets me pemët dhe trotuaret e përditësuara">{error&&<p role="alert">{error}</p>}</div><div className="canopy-controls">{VIEWS.map((v,i)=><button type="button" key={v.name} aria-pressed={selected===i} onClick={()=>{setSelected(i);switchView.current?.(i);}}>{v.name}</button>)}</div><div className="canopy-status"><span aria-live="polite">{status}</span><button type="button" aria-pressed={battery} onClick={()=>{quality.current=!battery;setBattery(!battery);}}>Kursim</button></div></div>;
}
const root=document.getElementById('tirana-realism-review-root');if(root)createRoot(root).render(<RealismReview/>);
