import React,{useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {LandscapeVisuals} from '../tiranastreets/landscapeVisuals';
import {CinematicAtmosphere} from './CinematicAtmosphere';
import {MappedBuildingCells} from '../tirana-neighbourhood/MappedBuildingCells';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {cutChannels,surfaceGeometry} from './riverGeometry';
import {environmentAt} from './weatherCore.mjs';

type Props={textures:Record<string,string>;seed:number};
const views=[{name:'Lana',x:26,z:421,y:1.5,d:48,yaw:.8},{name:'Ura',x:72,z:413,y:1.6,d:38,yaw:1.45},{name:'Lagjja',x:-80,z:520,y:5,d:68,yaw:-.65}];
export default function EnvironmentReview({textures,seed:initialSeed}:Props){
 const host=useRef<HTMLDivElement>(null),viewRef=useRef(views[0]),weatherRef=useRef(60),[seed,setSeed]=useState(initialSeed),[view,setView]=useState(0),[label,setLabel]=useState(''),[error,setError]=useState('');
 useEffect(()=>{
  const root=host.current!;let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false});}catch{setError('Pamja 3D kërkon WebGL në këtë pajisje.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;root.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(55,1,.12,1100),landscape=new LandscapeVisuals(false);scene.add(landscape.group);
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.06);scene.environment=environment.texture;room.dispose();pmrem.dispose();
  const loaded=new Set<T.Texture>(),materials=new Set<T.Material>();
  const bind=(material:T.MeshStandardMaterial,asset:string)=>{
   const source=textures[asset];if(source){const texture=new T.TextureLoader().load(source);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;loaded.add(texture);material.map=texture;material.needsUpdate=true;}materials.add(material);
  };
  landscape.group.traverse(o=>{if(o instanceof T.Mesh){const m=o.material as T.MeshStandardMaterial;if(m.name.startsWith('Tirana PBR:')&&!m.map)bind(m,m.name.split(':')[1]);}});
  const asphalt=new T.MeshStandardMaterial({roughness:.95}),paving=new T.MeshStandardMaterial({roughness:.9}),wall=new T.MeshStandardMaterial({vertexColors:true,roughness:.9}),glass=new T.MeshStandardMaterial({color:0x34515d,roughness:.3,metalness:.3});
  asphalt.userData.environmentSurface=true;paving.userData.environmentSurface=true;glass.userData.environmentWindow=true;
  bind(asphalt,'asphalt_02');bind(paving,'concrete_pavement');bind(wall,'plastered_wall_02');materials.add(glass);
  const add=(g:T.BufferGeometry,m:T.Material)=>{const mesh=new T.Mesh(g,m);mesh.receiveShadow=true;scene.add(mesh);};
  for(const p of WORLD.areas)for(const rings of cutChannels(p))add(surfaceGeometry(rings,.05),paving);
  for(const r of WORLD.roads){if(r.tunnel)continue;const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],length=Math.hypot(dx,dz);if(length<.1)continue;
   const strip=(width:number,y:number,material:T.Material)=>{const g=new T.PlaneGeometry(width,length+.04).rotateX(-Math.PI/2).rotateY(Math.atan2(dx,dz)).translate((r.a[0]+r.b[0])/2,y,(r.a[1]+r.b[1])/2);const pos=g.getAttribute('position'),uv=g.getAttribute('uv');for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/3,pos.getZ(i)/3);add(g,material);};
   if(!r.bridge&&!r.walk)strip(r.w+3.8,.065,paving);strip(r.w,r.bridge?.16:.09,r.walk?paving:asphalt);
  }
  const buildings=new MappedBuildingCells(WORLD.buildings,wall,glass,false,false),blocks=buildings.build(WORLD.buildings);scene.add(blocks);
  const atmosphere=new CinematicAtmosphere(scene,renderer,seed);
  let frame=0,last=performance.now(),elapsed=0,labelAt=0;let yawOffset=0,pitchOffset=0,drag:{x:number;y:number}|undefined;
  const down=(e:PointerEvent)=>{drag={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);};
  const move=(e:PointerEvent)=>{if(!drag)return;yawOffset-=(e.clientX-drag.x)*.006;pitchOffset=T.MathUtils.clamp(pitchOffset+(e.clientY-drag.y)*.04,-4,18);drag={x:e.clientX,y:e.clientY};};
  const up=()=>{drag=undefined;};renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);
  const resize=new ResizeObserver(()=>{renderer.setSize(root.clientWidth,root.clientHeight,false);camera.aspect=root.clientWidth/root.clientHeight;camera.updateProjectionMatrix();});resize.observe(root);
  const draw=(now:number)=>{const dt=Math.min(.05,(now-last)/1000);last=now;elapsed+=dt;const v=viewRef.current,angle=v.yaw+yawOffset;camera.position.set(v.x+Math.sin(angle)*v.d,v.y+8+pitchOffset,v.z+Math.cos(angle)*v.d);camera.lookAt(v.x,v.y,v.z);const seconds=weatherRef.current+elapsed;landscape.update(camera.position,seconds,false);scene.traverse(o=>{if(o instanceof T.Mesh){const m=o.material as T.MeshStandardMaterial;if(m.name.startsWith('Tirana PBR:')&&!m.map)bind(m,m.name.split(':')[1]);}});atmosphere.update(seconds,camera,false);renderer.render(scene,camera);if(now-labelAt>500){labelAt=now;setLabel(`${atmosphere.current.clock} · ${atmosphere.current.name}`);}frame=requestAnimationFrame(draw);};frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);resize.disconnect();atmosphere.dispose();landscape.dispose();buildings.dispose();scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});loaded.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());environment.dispose();renderer.dispose();renderer.domElement.remove();};
 },[seed,textures]);
 const changeView=(i:number)=>{setView(i);viewRef.current=views[i];};
 const random=()=>{weatherRef.current=60;setSeed(Math.floor(Math.random()*0xffffffff));};
 return <div className="tirana-env-review"><div className="tirana-env-stage" ref={host} role="img" aria-label="Pamje 3D e Lanës dhe urave me materialet e lojës">{error&&<p role="alert">{error}</p>}</div><div className="tirana-env-bar"><span aria-live="polite">{label}</span><button type="button" onClick={random}>Mot rastësor</button></div><div className="tirana-env-views">{views.map((v,i)=><button key={v.name} type="button" aria-pressed={view===i} onClick={()=>changeView(i)}>{v.name}</button>)}</div></div>;
}
