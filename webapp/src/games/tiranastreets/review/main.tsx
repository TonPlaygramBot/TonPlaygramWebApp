import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {StreetRenderer} from '../street-career/StreetRenderer';
import {createState,stepState,emptyInput,roadPoint,WORLD,type State} from '../shared/engine.mjs';
import {VEHICLE_COLLECTION} from '../shared/vehicleCollection.mjs';
import {NEIGHBOURHOOD} from '../../tirana-neighbourhood/data.mjs';
import './review.css';

const places:[string,number,number][]=[['Qendër',0,0],['Liqeni',16.7,1614],...NEIGHBOURHOOD.districts.map(d=>[d.name,d.point[0],d.point[1]] as [string,number,number]).sort((a,b)=>a[0].localeCompare(b[0],'sq'))];
function Review(){
 const host=useRef<HTMLDivElement>(null),runtime=useRef<{renderer:StreetRenderer;state:State}>();
 const [car,setCar]=useState('benz'),[status,setStatus]=useState('Duke ngarkuar qytetin…'),[driving,setDriving]=useState(false);
 const keys=useRef(new Set<string>());
 const travel=(index:number)=>{const r=runtime.current;if(!r)return;const [,x,z]=places[index];
  const p=r.state.players.review,point=roadPoint(x,z);
  Object.assign(p,point);const c=r.state.cars.find(c=>c.id===p.carId);if(c)Object.assign(c,point,{speed:0,vx:0,vz:0});
 };
 const enter=(id=car)=>{const r=runtime.current;if(!r)return;const p=r.state.players.review;
  if(p.carId){const old=r.state.cars.find(c=>c.id===p.carId);if(old)old.driver=null;}
  const c=r.state.cars.find(c=>c.collectionVehicle===id);if(!c)return;
  Object.assign(c,{x:p.x,z:p.z,heading:p.heading,driver:p.id,speed:0,vx:0,vz:0});p.carId=c.id;setDriving(true);
 };
 useEffect(()=>{
  const node=host.current!;let renderer:StreetRenderer;
  try{renderer=new StreetRenderer(node);}catch(error){setStatus('WebGL nuk u hap: '+String(error));return;}
  const state=createState([{id:'review',name:'Review'}],'free-roam');renderer.setQuality('auto');runtime.current={renderer,state};
  let frame=0,last=performance.now(),display=0;const loop=(now:number)=>{
   const dt=Math.min(.05,(now-last)/1000);last=now;
   const p=state.players.review;p.input={...emptyInput(),x:Number(keys.current.has('d'))-Number(keys.current.has('a')),y:Number(keys.current.has('w'))-Number(keys.current.has('s')),yaw:renderer.yaw};p.inputAt=state.elapsed;
   stepState(state,dt);renderer.render(state,p.id,dt,false);
   if(now-display>1000){display=now;setStatus(`${renderer.renderer.capabilities.isWebGL2?'WebGL 2':'WebGL'} · ${renderer.fps} FPS · ${WORLD.buildings.length.toLocaleString()} ndërtesa`);}
   frame=requestAnimationFrame(loop);
  };frame=requestAnimationFrame(loop);
  const down=(e:KeyboardEvent)=>keys.current.add(e.key.toLowerCase()),up=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
  const lost=()=>setStatus('Pamja 3D u ndërpre. Ringarko pamjen për të vazhduar.');
  renderer.renderer.domElement.addEventListener('webglcontextlost',lost);
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);
  let pointer:number|undefined,x=0,y=0;
  const start=(e:PointerEvent)=>{pointer=e.pointerId;x=e.clientX;y=e.clientY;node.setPointerCapture(pointer);};
  const move=(e:PointerEvent)=>{if(pointer!==e.pointerId)return;renderer.orbit(e.clientX-x,e.clientY-y);x=e.clientX;y=e.clientY;};
  const stop=()=>{pointer=undefined;};
  node.addEventListener('pointerdown',start);node.addEventListener('pointermove',move);node.addEventListener('pointerup',stop);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);node.removeEventListener('pointerdown',start);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',stop);renderer.destroy();runtime.current=undefined;};
 },[]);
 return <main className="realism-review"><div className="realism-scene" ref={host}/><header><strong>TIRANA STREETS</strong><output aria-live="polite">{status}</output></header>
  <section className="realism-controls" aria-label="Kontrollet e pamjes">
   <label>Lagjja<select onChange={e=>travel(Number(e.target.value))}>{places.map((p,i)=><option key={p[0]} value={i}>{p[0]}</option>)}</select></label>
   <label>Makina<select value={car} onChange={e=>{setCar(e.target.value);if(driving)enter(e.target.value);}}>{VEHICLE_COLLECTION.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <button onClick={()=>{if(driving){const r=runtime.current;if(r){const p=r.state.players.review,c=r.state.cars.find(c=>c.id===p.carId);if(c)c.driver=null;p.carId=null;p.x+=2.3;setDriving(false);}}else enter();}}>{driving?'Dil nga makina':'Ulu te shoferi'}</button>
   <div className="drive-buttons">{[['a','Majtas'],['w','Përpara'],['s','Prapa'],['d','Djathtas']].map(([key,label])=><button key={key} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);keys.current.add(key);}} onPointerUp={()=>keys.current.delete(key)} onPointerCancel={()=>keys.current.delete(key)}>{label}</button>)}</div>
   <small>Rrëshqit pamjen për të parë rreth vetes. © OpenStreetMap contributors</small>
  </section></main>;
}
createRoot(document.getElementById('root')!).render(<Review/>);
