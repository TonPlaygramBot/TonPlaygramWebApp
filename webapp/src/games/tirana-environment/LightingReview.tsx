import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {LandscapeVisuals} from '../tiranastreets/landscapeVisuals';
import {MappedBuildingCells} from '../tirana-neighbourhood/MappedBuildingCells';
import {CinematicAtmosphere} from './CinematicAtmosphere';
import {StreetLifeLayer} from '../tirana-street-life/StreetLifeLayer';
import {createWebGLRenderer} from '../tiranastreets/createWebGLRenderer';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {environmentAt} from './weatherCore.mjs';

const WEATHER=['Day','Sunset','Night','Rain'];
const VIEWS=[{name:'Lana bridge',x:26,z:421,d:48,y:7,yaw:.8},{name:'Apartments',x:-100,z:525,d:36,y:5,yaw:-.7},{name:'City centre',x:30,z:0,d:85,y:14,yaw:.5}];
// Keep the direct development entry as bounded as the in-chat export.
const inReview=(p:number[])=>p[0]>-440&&p[0]<440&&p[1]>-250&&p[1]<850;
const reviewBuildings=WORLD.buildings.filter(b=>b.p.some(inReview));
const reviewRoads=WORLD.roads.filter(r=>inReview(r.a)||inReview(r.b));
// Testable presentation presets select the real deterministic weather function.
function preset(name:string){
 for(let seed=0;seed<5000;seed++){
  const p=environmentAt(seed,90);
  if(name==='Day'&&p.hour>12&&p.hour<14&&p.cloud<.2||name==='Sunset'&&p.hour>17.4&&p.hour<18.1&&p.cloud<.3||name==='Night'&&p.hour>20&&p.hour<22&&p.cloud<.5||name==='Rain'&&p.hour>13&&p.hour<17&&p.rain>.9)return seed;
 }
 return 17;
}
export function LightingReview(){
 const host=useRef<HTMLDivElement>(null),view=useRef(VIEWS[0]),[weather,setWeather]=useState('Night'),[label,setLabel]=useState('Loading scene…'),[error,setError]=useState('');
 useEffect(()=>{
  const root=host.current!;let renderer:T.WebGLRenderer;setError('');
  try{renderer=createWebGLRenderer();}catch{setError('This device cannot create a WebGL view.');return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.4));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;root.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(55,1,.1,1400),landscape=new LandscapeVisuals(false);scene.add(landscape.group);
  const wall=new T.MeshStandardMaterial({color:0xffffff,roughness:.88,vertexColors:true}),glass=new T.MeshStandardMaterial({color:0x345663,roughness:.3,metalness:.3});glass.userData.environmentWindow=true;
  const buildings=new MappedBuildingCells(reviewBuildings,wall,glass,false,false);scene.add(buildings.build(reviewBuildings));
  const paving=new T.MeshStandardMaterial({color:0xb9b6ac,roughness:.9}),asphalt=new T.MeshStandardMaterial({color:0x424849,roughness:.92});asphalt.userData.environmentSurface=true;paving.userData.environmentSurface=true;
  const roadGeometries:T.BufferGeometry[]=[];
  for(const r of reviewRoads){if(r.tunnel)continue;const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],len=Math.hypot(dx,dz);if(len<.1)continue;
   for(const [w,y,m] of [[r.w+3.8,.066,paving],[r.w,r.bridge?.16:.09,r.walk?paving:asphalt]] as const){
    const geo=new T.PlaneGeometry(w,len).rotateX(-Math.PI/2).rotateY(Math.atan2(dx,dz)).translate((r.a[0]+r.b[0])/2,y,(r.a[1]+r.b[1])/2);roadGeometries.push(geo);const mesh=new T.Mesh(geo,m);mesh.receiveShadow=true;scene.add(mesh);
   }
  }
  const signs=new StreetLifeLayer();scene.add(signs.group);
  const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(room,.06);scene.environment=env.texture;room.dispose();pmrem.dispose();
  const atmosphere=new CinematicAtmosphere(scene,renderer,preset(weather));
  let frame=0,previous=performance.now(),elapsed=0,lastLabel=0,drag:{x:number;y:number}|undefined,yaw=0,lift=0;
  const down=(e:PointerEvent)=>{drag={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);};
  const move=(e:PointerEvent)=>{if(!drag)return;yaw-=(e.clientX-drag.x)*.005;lift=T.MathUtils.clamp(lift+(e.clientY-drag.y)*.035,-3,20);drag={x:e.clientX,y:e.clientY};};
  const up=()=>{drag=undefined;};
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);
  const resize=new ResizeObserver(()=>{renderer.setSize(root.clientWidth,root.clientHeight,false);camera.aspect=root.clientWidth/root.clientHeight;camera.updateProjectionMatrix();});resize.observe(root);
  const draw=(now:number)=>{
   elapsed+=Math.min(.05,(now-previous)/1000);previous=now;const v=view.current,angle=v.yaw+yaw;
   camera.position.set(v.x+Math.sin(angle)*v.d,v.y+lift,v.z+Math.cos(angle)*v.d);camera.lookAt(v.x,2.2,v.z);
   const time=90+elapsed;landscape.update(camera.position,time,false);signs.update(time,camera.position,false);atmosphere.update(time,camera,false);renderer.render(scene,camera);
   if(now-lastLabel>600){lastLabel=now;setLabel(`${atmosphere.current.clock} · ${atmosphere.current.name}`);}frame=requestAnimationFrame(draw);
  };frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);resize.disconnect();atmosphere.dispose();landscape.dispose();signs.dispose();buildings.dispose();scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});roadGeometries.forEach(g=>g.dispose());wall.dispose();glass.dispose();paving.dispose();asphalt.dispose();env.dispose();renderer.dispose();renderer.domElement.remove();};
 },[weather]);
 return <div className="lighting-review"><div className="lighting-review-stage" ref={host} role="img" aria-label="Tirana Streets environment preview">{error&&<p role="alert">{error}</p>}</div><div className="lighting-review-bar"><span aria-live="polite">{error?'WebGL unavailable':label}</span><span>Drag to look</span></div><div className="lighting-review-controls">{WEATHER.map(name=><button key={name} type="button" aria-pressed={name===weather} onClick={()=>setWeather(name)}>{name}</button>)}</div><div className="lighting-review-controls">{VIEWS.map(v=><button key={v.name} type="button" onClick={()=>{view.current=v;}}>{v.name}</button>)}</div></div>;
}
const element=document.getElementById('tirana-lighting-review-root');if(element)createRoot(element).render(<LightingReview/>);
