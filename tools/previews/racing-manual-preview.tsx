// A portable in-chat handling preview. Uses production physics, controls and
// driver articulation; only the surrounding city's rendering is reduced.
import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {buildModernKart,KART_DESIGNS} from '../assets/modernKartModel';
import {prepareVehicleAsset} from '../../webapp/src/games/kartroyale/vehicleAssetAdapter';
import {KartMotion} from '../../webapp/src/games/kartroyale/KartMotion';
import {createBoostPadLayer} from '../../webapp/src/games/kartroyale/BoostPadLayer';
import {createRoadBumpLayer} from '../../webapp/src/games/kartroyale/RoadBumpLayer';
import {createTyreBarrierMeshes} from '../../webapp/src/games/kartroyale/TyreBarrierLayer';
import {createKerbLayer} from '../../webapp/src/games/kartroyale/KerbLayer';
import {RaceEffects} from '../../webapp/src/games/kartroyale/raceEffects';
import {driftTier} from '../../webapp/src/games/kartroyale/arcadeRules.mjs';
import {KartDriver} from '../../webapp/src/games/kartroyale/KartDriver';
import {KartControls} from '../../webapp/src/games/kartroyale/KartControls';
import {createHeldRaceInput} from '../../webapp/src/games/kartroyale/heldRaceInput.mjs';
import {STEP,createRacer,equipKart,stepRace,COLORS,standings} from '../../webapp/src/games/kartroyale/legacySimulation.mjs';
import {createRaceSurfaceGeometry} from '../../webapp/src/games/kartroyale/RaceSurface';
import {boostPads} from '../../webapp/src/games/kartroyale/arcadeRules.mjs';
import DATA from 'preview-data';
const choices=KART_DESIGNS.map(k=>[k.id,k.name]);
function App(){
 const host=useRef<HTMLDivElement>(null),controller=useRef<any>(null),input=useRef(createHeldRaceInput());
 const [course,setCourse]=useState(0),[difficulty,setDifficulty]=useState('street');
 const [kart,setKart]=useState('apex'),[ready,setReady]=useState(false),[racing,setRacing]=useState(false),[paused,setPaused]=useState(false),[error,setError]=useState('');
 const [hud,setHud]=useState({speed:0,boost:45,lap:1,position:1,drifting:false,time:0,finished:false,turbo:0,driftCharge:0,slipstream:0,bump:0,impact:0});
 useEffect(()=>{
  let alive=true,raf=0;const el=host.current!;setReady(false);setRacing(false);setError('');input.current.clear();
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false});}catch{setError('3D graphics could not start on this device.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  renderer.domElement.setAttribute('aria-label','Racing Royal: eight modern karts, six Tirana circuits; drag the kart to inspect');el.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#bdd4e0');scene.fog=new T.Fog('#bdd4e0',100,350);
  const camera=new T.PerspectiveCamera(52,1,.08,600),world=new T.Group(),kartGroup=new T.Group(),effectVisuals=new Map<string,T.Group>();scene.add(world,kartGroup);
  const orbitControls=new OrbitControls(camera,renderer.domElement);orbitControls.target.set(0,.55,0);orbitControls.enablePan=false;orbitControls.enableDamping=true;orbitControls.minDistance=3.8;orbitControls.maxDistance=8;orbitControls.maxPolarAngle=Math.PI*.47;
  const showroom=new T.Group();scene.add(showroom);
  const platform=new T.Mesh(new T.CylinderGeometry(2.5,2.5,.09,64),new T.MeshStandardMaterial({color:'#37434c',roughness:.7,metalness:.15}));platform.position.y=-.055;showroom.add(platform);
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room);scene.environment=environment.texture;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight('#edfbff','#627450',2.2));const sun=new T.DirectionalLight('#fff3dc',3);sun.position.set(20,35,10);scene.add(sun);
  const {track,buildings,trees,tyres}=DATA.courses[course];
  const ground=new T.Mesh(new T.PlaneGeometry(1800,1800),new T.MeshStandardMaterial({color:'#96a48d',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(track.center.x,.10,track.center.z);world.add(ground);
  const geo=createRaceSurfaceGeometry(track);world.add(new T.Mesh(geo,new T.MeshStandardMaterial({color:'#4b5861',roughness:.94})));
  const dummy=new T.Object3D();world.add(createKerbLayer(track));
  const cityBatches=new Map<string,{color:string,geometries:T.BufferGeometry[]}>();
  for(const b of buildings){const shape=new T.Shape(b.p.map(p=>new T.Vector2(p[0],-p[1]))),g=new T.ExtrudeGeometry(shape,{depth:b.h,bevelEnabled:false});g.rotateX(-Math.PI/2);const key=`${b.color}/${Math.floor(b.p[0][0]/64)}/${Math.floor(b.p[0][1]/64)}`;if(!cityBatches.has(key))cityBatches.set(key,{color:b.color,geometries:[]});cityBatches.get(key)!.geometries.push(g);}
  for(const {color,geometries} of cityBatches.values()){const geometry=mergeGeometries(geometries,false);world.add(new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.9})));geometries.forEach(g=>g.dispose());}
  const trunks=new T.InstancedMesh(new T.CylinderGeometry(.18,.26,1,5),new T.MeshStandardMaterial({color:'#75634d'}),trees.length),leaves=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:'#507a56',flatShading:true}),trees.length);
  trees.forEach((p,i)=>{dummy.position.set(p.x,p.h*.4,p.z);dummy.rotation.set(0,0,0);dummy.scale.set(1,p.h*.8,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);dummy.position.y=p.h*.76;dummy.scale.set(p.c*.42,p.h*.3,p.c*.42);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);});world.add(trunks,leaves);
  world.add(createBoostPadLayer(track),createRoadBumpLayer(track),createTyreBarrierMeshes(tyres));const effects=new RaceEffects(camera);world.add(effects.group);
  const start=track.points[0];for(let i=0;i<12;i++)for(let j=0;j<2;j++){const tile=new T.Mesh(new T.PlaneGeometry(start.width/12,.6),new T.MeshBasicMaterial({color:(i+j)%2?'#182a31':'#f5f5e9'}));tile.rotation.x=-Math.PI/2;const x=(i-5.5)*start.width/12,z=(j-.5)*.6;tile.position.set(start.x+Math.cos(start.yaw)*x+Math.sin(start.yaw)*z,.14,start.z-Math.sin(start.yaw)*x+Math.cos(start.yaw)*z);tile.rotation.z=-start.yaw;world.add(tile);}
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(el);resize();
  const lastImpacts=new Map<string,number>(),wheelBases=new Map<T.Object3D,number>(),wheelScale=new T.Vector3();
  let racers=[],models=[],drivers=[],motions=[],bases=[],radii=[],run=false,pause=false,time=0,accumulator=0,last=performance.now(),ui=0;
  const selectedId=(i:number)=>i?choices[(i-1)%choices.length][0]:kart;
  const garageCamera=()=>{const fit=Math.max(1,.60/camera.aspect);camera.fov=42;camera.position.set(3.7*fit,2.8*fit,4.7*fit);orbitControls.target.set(0,-.20,0);orbitControls.update();camera.updateProjectionMatrix();};garageCamera();
  const clear=()=>input.current.clear();
  const setPause=(value:boolean)=>{pause=value;clear();setPaused(value);};
  const begin=()=>{clear();effects.clear();lastImpacts.clear();motions=models.map(()=>new KartMotion());racers=Array.from({length:6},(_,i)=>equipKart(createRacer(track,String(i),i?'Rival':'You',i,i>0),selectedId(i)));run=true;orbitControls.enabled=false;time=0;accumulator=0;const r=racers[0];camera.position.set(r.x-Math.sin(r.yaw)*7,3.5,r.z-Math.cos(r.yaw)*7);setPause(false);setRacing(true);};
  controller.current={begin,pause:()=>setPause(!pause),garage:()=>{clear();run=false;orbitControls.enabled=true;garageCamera();setRacing(false);setPause(false);}};
  const key=(e:KeyboardEvent,on:boolean)=>{const map={ArrowLeft:['steer',-1],ArrowRight:['steer',1],ArrowUp:['throttle',true],ArrowDown:['brake',true],a:['steer',-1],d:['steer',1],w:['throttle',true],s:['brake',true],' ':['drift',true],Shift:['boost',true]};const action=map[e.key];if(!action||!run)return;e.preventDefault();if(on&&!pause)input.current.hold('key:'+e.key,...action);else input.current.release('key:'+e.key);};
  const down=e=>key(e,true),up=e=>key(e,false),blur=()=>{if(run)setPause(true);else clear();},visibility=()=>{if(document.hidden)blur();};window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  const loader=new GLTFLoader(),parse=(base64:string)=>new Promise<any>((resolve,reject)=>{const binary=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));loader.parse(binary.buffer,'',resolve,reject);});
  const animate=(now:number)=>{
   if(!alive)return;const dt=Math.min(.04,(now-last)/1000);last=now;
   if(run&&!pause&&!racers[0].finished){accumulator+=dt;while(accumulator>=STEP){Object.assign(racers[0].input,input.current.read());time+=STEP;stepRace(racers,track,STEP,time,difficulty);accumulator-=STEP;}}
   models.forEach((m,i)=>{const r=run?racers[i]:{steering:0,acceleration:0,yawRate:0,speed:0,throttle:0,braking:false};m.visible=run||i===0;
    if(run){m.position.set(r.x,.13,r.z);m.rotation.y=r.yaw;}else{m.position.set(0,0,0);m.rotation.y=0;}
    if(run && (r.impactId||0)>(lastImpacts.get(r.id)||0)){lastImpacts.set(r.id,r.impactId);effects.crash(r);}
    const motion=motions[i];motion.update(r,run&&!pause?dt:0,radii[i],matchMedia('(prefers-reduced-motion: reduce)').matches);
    const body=m.getObjectByName('body');if(body){body.rotation.x=bases[i].x+motion.pitch;body.rotation.z=bases[i].z+motion.roll;body.position.y=bases[i].y+motion.height+(!matchMedia('(prefers-reduced-motion: reduce)').matches&&r.hop>0?Math.sin((1-r.hop/.24)*Math.PI)*.18:0);}
    drivers[i].update(r,time,false,matchMedia('(prefers-reduced-motion: reduce)').matches);
    for(const name of ['fl','fr','rl','rr']){const w=m.getObjectByName('wheel_'+name);if(w){w.rotation.x=motion.wheelSpin;if(!wheelBases.has(w))wheelBases.set(w,w.position.y);const scale=w.parent.getWorldScale(wheelScale).y;w.position.y=wheelBases.get(w)!+(matchMedia('(prefers-reduced-motion: reduce)').matches?0:r.suspension?.wheels[['fl','fr','rl','rr'].indexOf(name)]||0)/scale;}}
    for(const name of ['steer_fl','steer_fr']){const w=m.getObjectByName(name);if(w)w.rotation.y=name==='steer_fl'?motion.leftSteer:motion.rightSteer;}
    const wheel=m.getObjectByName('steering_wheel');if(wheel)wheel.rotation.z=r.steering*.65;
    const wing=m.getObjectByName('aero_wing');if(wing)wing.rotation.x=r.braking?.35:r.turbo>0?-.12:0;
    m.traverse(o=>{if(o.isMesh){if(o.material.name==='brake_light')o.material.emissiveIntensity=r.braking?4:.3;if(o.material.name==='energy')o.material.emissiveIntensity=.8+(r.throttle||0)*2;}});
   });
   world.visible=run;showroom.visible=!run;if(run)effects.update(pause||racers[0].finished?0:dt,racers,effectVisuals,'0',false);
   if(run){const r=racers[0],target=new T.Vector3(r.x-Math.sin(r.yaw)*7,3.5,r.z-Math.cos(r.yaw)*7);camera.position.lerp(target,1-Math.exp(-dt*7));camera.lookAt(r.x+Math.sin(r.yaw)*3,1.1,r.z+Math.cos(r.yaw)*3);camera.fov+=(60+(matchMedia('(prefers-reduced-motion: reduce)').matches?0:r.speed*.12)-camera.fov)*(1-Math.exp(-dt*5));camera.updateProjectionMatrix();}
   else{orbitControls.update();}
   if(run&&now-ui>100){ui=now;const r=racers[0];setHud({speed:r.speed,boost:r.boost,lap:Math.max(1,Math.min(3,r.lap)),position:standings(racers).findIndex(r=>r.id==='0')+1,drifting:r.drifting,time,finished:r.finished,turbo:r.turbo,driftCharge:r.driftCharge,slipstream:r.slipstream,bump:r.bumpImpact||0,impact:r.hitFlash||0});}
   renderer.render(scene,camera);raf=requestAnimationFrame(animate);
  };
  parse(DATA.models.driver).then(asset=>{
   if(!alive){asset.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return;}
   models=Array.from({length:6},(_,i)=>{const id=selectedId(i),source=prepareVehicleAsset(buildModernKart(id,true),id),model=new T.Group();model.add(source);radii.push(source.userData.wheelRadius);model.traverse(o=>{if(o.isMesh&&o.material.name==='paint'&&i)o.material.color.set(COLORS[i]);});const driver=new KartDriver(asset.scene,i?COLORS[i]:KART_DESIGNS.find(k=>k.id===id)!.paint,id==='oopi');drivers.push(driver);(model.getObjectByName('body')||model).add(driver.root);kartGroup.add(model);return model;});
   motions=models.map(()=>new KartMotion());bases=models.map(m=>{const b=m.getObjectByName('body');return {x:b?.rotation.x||0,z:b?.rotation.z||0,y:b?.position.y||0};});setReady(true);raf=requestAnimationFrame(animate);
  }).catch(()=>{if(alive)setError('The kart models could not be opened.');});
  return()=>{alive=false;cancelAnimationFrame(raf);clear();observer.disconnect();orbitControls.dispose();environment.dispose();effects.dispose();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);const geos=new Set<T.BufferGeometry>(),mats=new Set<T.Material>(),textures=new Set<T.Texture>();scene.traverse(o=>{if(o instanceof T.Mesh){geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){mats.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}if(o instanceof T.InstancedMesh)o.dispose();}});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();};
 },[kart,course,difficulty]);
 return <div className="rr-preview rr-remake">
  <div className="rr-preview-canvas" ref={host}/>
  <header><span><b>RACING ROYAL</b><small>{DATA.courses[course].track.name} · {(DATA.courses[course].track.length/1000).toFixed(2)} km</small></span>{racing?<button onClick={()=>controller.current?.pause()}>{paused?'RESUME':'PAUSE'}</button>:<span className="rr-preview-tag">KART SERIES</span>}</header>
  {!racing&&<div className="rr-preview-garage"><label className="rr-kart-choice">KART<select aria-label="Kart model" value={kart} onChange={e=>setKart(e.target.value)}>{choices.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><div className="rr-preview-options"><label>CIRCUIT<select aria-label="Preview circuit" value={course} onChange={e=>setCourse(Number(e.target.value))}>{DATA.courses.map((c,i)=><option key={c.track.id} value={i}>{c.track.name}</option>)}</select></label><label>RIVALS<select aria-label="Rival difficulty" value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option value="street">Street</option><option value="pro">Pro</option></select></label></div><button className="rr-preview-start" disabled={!ready} onClick={()=>controller.current?.begin()}>{ready?'START RACE':'LOADING KARTS…'}</button></div>}
  {racing&&<><div className="rr-preview-stats"><b>{hud.position}/6</b><span>LAP {hud.lap}/3</span><time>{Math.floor(hud.time/60)}:{(hud.time%60).toFixed(1).padStart(4,'0')}</time></div><div className="rr-speed"><b>{Math.round(hud.speed*3.6)}</b><span>KM/H</span></div>
   <div className="rr-preview-feedback">{hud.drifting?<><strong>{['DRIFT','MINI TURBO','SUPER TURBO','ROYAL TURBO'][driftTier(hud.driftCharge)]}</strong><progress max={1.9} value={hud.driftCharge}/></>:hud.turbo>0?<strong>TURBO!</strong>:hud.slipstream>.35?<strong>SLIPSTREAM</strong>:hud.impact>.05?<strong>IMPACT</strong>:hud.bump>.24?<strong>BUMP</strong>:null}</div>
   <KartControls boost={hud.boost} drifting={hud.drifting} disabled={paused||hud.finished} hold={(id,key,value)=>input.current.hold(id,key,value)} release={id=>input.current.release(id)}/>
   {(paused||hud.finished)&&<div className="rr-preview-overlay"><b>{hud.finished?'FINISH':'PAUSED'}</b><button onClick={()=>hud.finished?controller.current?.begin():controller.current?.pause()}>{hud.finished?'RACE AGAIN':'RESUME'}</button><button onClick={()=>controller.current?.garage()}>GARAGE</button></div>}
  </>}
  {error&&<div className="rr-preview-overlay" role="alert">{error}</div>}
 </div>;
}
createRoot(document.getElementById('racing-royal-upgrade')!).render(<App/>);
