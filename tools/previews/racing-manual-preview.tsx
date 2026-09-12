// A portable in-chat handling preview. Uses production physics, controls and
// driver articulation; only the surrounding city's rendering is reduced.
import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {KartMotion} from '../../webapp/src/games/kartroyale/KartMotion';
import {createBoostPadLayer} from '../../webapp/src/games/kartroyale/BoostPadLayer';
import {RaceEffects} from '../../webapp/src/games/kartroyale/raceEffects';
import {driftTier} from '../../webapp/src/games/kartroyale/arcadeRules.mjs';
import {KartDriver} from '../../webapp/src/games/kartroyale/KartDriver';
import {KartControls} from '../../webapp/src/games/kartroyale/KartControls';
import {createHeldRaceInput} from '../../webapp/src/games/kartroyale/heldRaceInput.mjs';
import {STEP,createRacer,equipKart,stepRace,COLORS,standings} from '../../webapp/src/games/kartroyale/legacySimulation.mjs';
import {circuitSides} from '../../webapp/src/games/kartroyale/trackEdges.mjs';
import {boostPads} from '../../webapp/src/games/kartroyale/arcadeRules.mjs';
import DATA from 'preview-data';
const choices=[['photon','Photon GT'],['vortex','Vortex R'],['aegis','Aegis XR']];
function App(){
 const host=useRef<HTMLDivElement>(null),controller=useRef<any>(null),input=useRef(createHeldRaceInput());
 const [kart,setKart]=useState('photon'),[ready,setReady]=useState(false),[racing,setRacing]=useState(false),[paused,setPaused]=useState(false),[error,setError]=useState('');
 const [hud,setHud]=useState({speed:0,boost:45,lap:1,position:1,drifting:false,time:0,finished:false,turbo:0,driftCharge:0,slipstream:0});
 useEffect(()=>{
  let alive=true,raf=0;const el=host.current!;setReady(false);setRacing(false);setError('');input.current.clear();
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false});}catch{setError('3D graphics could not start on this device.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  renderer.domElement.setAttribute('aria-label','Playable Racing Royal preview with Blender karts and helmeted drivers');el.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#bdd4e0');scene.fog=new T.Fog('#bdd4e0',100,350);
  const camera=new T.PerspectiveCamera(52,1,.08,600),world=new T.Group(),kartGroup=new T.Group(),effectVisuals=new Map<string,T.Group>();scene.add(world,kartGroup);
  scene.add(new T.HemisphereLight('#edfbff','#627450',2.2));const sun=new T.DirectionalLight('#fff3dc',3);sun.position.set(20,35,10);scene.add(sun);
  const track=DATA.track;
  const ground=new T.Mesh(new T.PlaneGeometry(1800,1800),new T.MeshStandardMaterial({color:'#96a48d',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(track.center.x,-.04,track.center.z);world.add(ground);
  const sides=circuitSides(track.points,track.width/2),positions=[],indices=[];
  for(let i=0;i<=track.points.length;i++){for(const side of ['left','right']){const p=sides[side][i%track.points.length];positions.push(p.x,.04,p.z);}if(i<track.points.length){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();world.add(new T.Mesh(geo,new T.MeshStandardMaterial({color:'#4b5861',roughness:.94})));
  const curb=new T.InstancedMesh(new T.BoxGeometry(.4,.14,1),new T.MeshStandardMaterial(),track.points.length*2),dummy=new T.Object3D();
  for(let i=0;i<track.points.length;i++)for(let side=0;side<2;side++){const edge=sides[side?'right':'left'],p=edge[i],q=edge[(i+1)%edge.length];dummy.position.set((p.x+q.x)/2,.07,(p.z+q.z)/2);dummy.rotation.set(0,Math.atan2(q.x-p.x,q.z-p.z),0);dummy.scale.set(1,1,Math.hypot(q.x-p.x,q.z-p.z)+.05);dummy.updateMatrix();curb.setMatrixAt(i*2+side,dummy.matrix);curb.setColorAt(i*2+side,new T.Color(i%6<3?'#f15c48':'#e9e7d7'));}world.add(curb);
  for(const b of DATA.buildings){const shape=new T.Shape(b.p.map(p=>new T.Vector2(p[0],-p[1]))),g=new T.ExtrudeGeometry(shape,{depth:b.h,bevelEnabled:false});g.rotateX(-Math.PI/2);world.add(new T.Mesh(g,new T.MeshStandardMaterial({color:b.color,roughness:.9})));}
  const trunks=new T.InstancedMesh(new T.CylinderGeometry(.18,.26,1,5),new T.MeshStandardMaterial({color:'#75634d'}),DATA.trees.length),leaves=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:'#507a56',flatShading:true}),DATA.trees.length);
  DATA.trees.forEach((p,i)=>{dummy.position.set(p.x,p.h*.4,p.z);dummy.rotation.set(0,0,0);dummy.scale.set(1,p.h*.8,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);dummy.position.y=p.h*.76;dummy.scale.set(p.c*.42,p.h*.3,p.c*.42);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);});world.add(trunks,leaves);
  world.add(createBoostPadLayer(track));const effects=new RaceEffects(camera);world.add(effects.group);
  const start=track.points[0];for(let i=0;i<12;i++)for(let j=0;j<2;j++){const tile=new T.Mesh(new T.PlaneGeometry(start.width/12,.6),new T.MeshBasicMaterial({color:(i+j)%2?'#182a31':'#f5f5e9'}));tile.rotation.x=-Math.PI/2;const x=(i-5.5)*start.width/12,z=(j-.5)*.6;tile.position.set(start.x+Math.cos(start.yaw)*x+Math.sin(start.yaw)*z,.052,start.z-Math.sin(start.yaw)*x+Math.cos(start.yaw)*z);tile.rotation.z=-start.yaw;world.add(tile);}
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(el);resize();
  let racers=[],models=[],drivers=[],motions=[],bases=[],run=false,pause=false,time=0,accumulator=0,last=performance.now(),ui=0,orbit=0;
  const clear=()=>input.current.clear();
  const setPause=(value:boolean)=>{pause=value;clear();setPaused(value);};
  const begin=()=>{clear();effects.clear();motions=models.map(()=>new KartMotion());racers=Array.from({length:3},(_,i)=>equipKart(createRacer(track,String(i),i?'Rival':'You',i,i>0),i?choices[i][0]:kart));run=true;time=0;accumulator=0;const r=racers[0];camera.position.set(r.x-Math.sin(r.yaw)*7,3.5,r.z-Math.cos(r.yaw)*7);setPause(false);setRacing(true);};
  controller.current={begin,pause:()=>setPause(!pause),garage:()=>{clear();run=false;setRacing(false);setPause(false);}};
  const key=(e:KeyboardEvent,on:boolean)=>{const map={ArrowLeft:['steer',-1],ArrowRight:['steer',1],ArrowUp:['throttle',true],ArrowDown:['brake',true],a:['steer',-1],d:['steer',1],w:['throttle',true],s:['brake',true],' ':['drift',true],Shift:['boost',true]};const action=map[e.key];if(!action||!run)return;e.preventDefault();if(on&&!pause)input.current.hold('key:'+e.key,...action);else input.current.release('key:'+e.key);};
  const down=e=>key(e,true),up=e=>key(e,false),blur=()=>{if(run)setPause(true);else clear();},visibility=()=>{if(document.hidden)blur();};window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  const loader=new GLTFLoader(),parse=(base64:string)=>new Promise<any>((resolve,reject)=>{const binary=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));loader.parse(binary.buffer,'',resolve,reject);});
  const animate=(now:number)=>{
   if(!alive)return;const dt=Math.min(.04,(now-last)/1000);last=now;
   if(run&&!pause&&!racers[0].finished){accumulator+=dt;while(accumulator>=STEP){Object.assign(racers[0].input,input.current.read());time+=STEP;stepRace(racers,track,STEP,time,'rookie');accumulator-=STEP;}}
   models.forEach((m,i)=>{const r=run?racers[i]:{steering:0,acceleration:0,yawRate:0,speed:0,throttle:0,braking:false};m.visible=run||i===0;
    if(run){m.position.set(r.x,.13,r.z);m.rotation.y=r.yaw;}else{m.position.set(0,0,0);m.rotation.y=0;}
    const motion=motions[i];motion.update(r,run&&!pause?dt:0,.28,matchMedia('(prefers-reduced-motion: reduce)').matches);
    const body=m.getObjectByName('body');if(body){body.rotation.x=bases[i].x+motion.pitch;body.rotation.z=bases[i].z+motion.roll;body.position.y=bases[i].y+motion.height+(!matchMedia('(prefers-reduced-motion: reduce)').matches&&r.hop>0?Math.sin((1-r.hop/.24)*Math.PI)*.18:0);}
    drivers[i].update(r,time,false,matchMedia('(prefers-reduced-motion: reduce)').matches);
    for(const name of ['fl','fr','rl','rr']){const w=m.getObjectByName('wheel_'+name);if(w)w.rotation.x=motion.wheelSpin;}
    for(const name of ['steer_fl','steer_fr']){const w=m.getObjectByName(name);if(w)w.rotation.y=name==='steer_fl'?motion.leftSteer:motion.rightSteer;}
    const wheel=m.getObjectByName('steering_wheel');if(wheel)wheel.rotation.z=r.steering*.65;
    const wing=m.getObjectByName('aero_wing');if(wing)wing.rotation.x=r.braking?.35:r.turbo>0?-.12:0;
    m.traverse(o=>{if(o.isMesh){if(o.material.name==='brake_light')o.material.emissiveIntensity=r.braking?4:.3;if(o.material.name==='energy')o.material.emissiveIntensity=.8+(r.throttle||0)*2;}});
   });
   world.visible=run;if(run)effects.update(pause||racers[0].finished?0:dt,racers,effectVisuals,'0',false);
   if(run){const r=racers[0],target=new T.Vector3(r.x-Math.sin(r.yaw)*7,3.5,r.z-Math.cos(r.yaw)*7);camera.position.lerp(target,1-Math.exp(-dt*7));camera.lookAt(r.x+Math.sin(r.yaw)*3,1.1,r.z+Math.cos(r.yaw)*3);camera.fov+=(60+(matchMedia('(prefers-reduced-motion: reduce)').matches?0:r.speed*.12)-camera.fov)*(1-Math.exp(-dt*5));camera.updateProjectionMatrix();}
   else{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)orbit+=dt*.15;camera.position.set(Math.sin(.65+orbit)*4.5,2.3,Math.cos(.65+orbit)*4.5);camera.lookAt(0,.65,0);}
   if(run&&now-ui>100){ui=now;const r=racers[0];setHud({speed:r.speed,boost:r.boost,lap:Math.max(1,Math.min(3,r.lap)),position:standings(racers).findIndex(r=>r.id==='0')+1,drifting:r.drifting,time,finished:r.finished,turbo:r.turbo,driftCharge:r.driftCharge,slipstream:r.slipstream});}
   renderer.render(scene,camera);raf=requestAnimationFrame(animate);
  };
  Promise.all([parse(DATA.models[kart]),parse(DATA.models.vortex),parse(DATA.models.aegis),parse(DATA.models.driver)]).then(assets=>{
   if(!alive){assets.forEach(a=>a.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();}));return;}
   models=assets.slice(0,3).map((a,i)=>{const model=a.scene;model.traverse(o=>{if(o.isMesh&&o.material.name==='paint')o.material.color.set(i?COLORS[i]:'#46c8f0');});const driver=new KartDriver(assets[3].scene,i?COLORS[i]:'#46c8f0');drivers.push(driver);(model.getObjectByName('body')||model).add(driver.root);kartGroup.add(model);return model;});
   motions=models.map(()=>new KartMotion());bases=models.map(m=>{const b=m.getObjectByName('body');return {x:b?.rotation.x||0,z:b?.rotation.z||0,y:b?.position.y||0};});setReady(true);raf=requestAnimationFrame(animate);
  }).catch(()=>{if(alive)setError('The kart models could not be opened.');});
  return()=>{alive=false;cancelAnimationFrame(raf);clear();observer.disconnect();effects.dispose();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});renderer.dispose();renderer.domElement.remove();};
 },[kart]);
 return <div className="rr-preview rr-remake">
  <div className="rr-preview-canvas" ref={host}/>
  <header><span><b>RACING ROYAL</b><small>Blloku · faster karts</small></span>{racing?<button onClick={()=>controller.current?.pause()}>{paused?'RESUME':'PAUSE'}</button>:<span className="rr-preview-tag">FUTURE SERIES</span>}</header>
  {!racing&&<div className="rr-preview-garage"><div className="rr-preview-picks">{choices.map(([id,name])=><button key={id} aria-pressed={kart===id} onClick={()=>setKart(id)}>{name}</button>)}</div><button className="rr-preview-start" disabled={!ready} onClick={()=>controller.current?.begin()}>{ready?'DRIVE BLLOKU':'LOADING KARTS…'}</button></div>}
  {racing&&<><div className="rr-preview-stats"><b>{hud.position}/3</b><span>LAP {hud.lap}/3</span><time>{Math.floor(hud.time/60)}:{(hud.time%60).toFixed(1).padStart(4,'0')}</time></div><div className="rr-speed"><b>{Math.round(hud.speed*3.6)}</b><span>KM/H</span></div>
   <div className="rr-preview-feedback">{hud.drifting?<><strong>{['DRIFT','MINI TURBO','SUPER TURBO','ROYAL TURBO'][driftTier(hud.driftCharge)]}</strong><progress max={1.9} value={hud.driftCharge}/></>:hud.turbo>0?<strong>TURBO!</strong>:hud.slipstream>.35?<strong>SLIPSTREAM</strong>:null}</div>
   <KartControls boost={hud.boost} drifting={hud.drifting} disabled={paused||hud.finished} hold={(id,key,value)=>input.current.hold(id,key,value)} release={id=>input.current.release(id)}/>
   {(paused||hud.finished)&&<div className="rr-preview-overlay"><b>{hud.finished?'FINISH':'PAUSED'}</b><button onClick={()=>hud.finished?controller.current?.begin():controller.current?.pause()}>{hud.finished?'RACE AGAIN':'RESUME'}</button><button onClick={()=>controller.current?.garage()}>GARAGE</button></div>}
  </>}
  {error&&<div className="rr-preview-overlay" role="alert">{error}</div>}
 </div>;
}
createRoot(document.getElementById('racing-royal-upgrade')!).render(<App/>);
