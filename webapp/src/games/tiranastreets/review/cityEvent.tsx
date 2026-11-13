import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {StreetRenderer} from '../street-career/StreetRenderer';
import {StreetSimulation} from '../street-career/StreetSimulation.mjs';
import {createState} from '../shared/engine.mjs';
import {CITY_EVENT_PHASES} from '../shared/cityEvents.mjs';
import {groundHeight} from '../../tirana-east/terrainCore.mjs';
import type {GraphicsSetting} from '../graphicsQuality';

declare global {interface Window {__tiranaEventReview?:{renderer:StreetRenderer;sim:StreetSimulation;ready:boolean}}}
/** Review the actual city renderer, models and simulation at portrait sizes. */
function CityEventReview(){
 const host=useRef<HTMLDivElement>(null),[status,setStatus]=useState('Loading the city'),[ready,setReady]=useState(false),[phase,setPhase]=useState('gathering'),[paused,setPaused]=useState(false);
 const pause=useRef(false),[quality,setQuality]=useState<GraphicsSetting>('balanced');
 useEffect(()=>{
  if(!host.current)return;
  let renderer:StreetRenderer;
  try{renderer=new StreetRenderer(host.current);}catch(error){setStatus(String(error));return;}
  const state=createState([{id:'local',name:'Review'}],'free-roam','solo'),sim=new StreetSimulation(state);
  Object.assign(sim.player,{x:0,z:37,heading:0,weapon:''});sim.body.y=groundHeight(0,37)+.08;
  sim.step(1/30);
  renderer.simulation=sim;renderer.yaw=0;renderer.pitch=0;renderer.setQuality('balanced');
  window.__tiranaEventReview={renderer,sim,ready:false};
  let dead=false,frame=0,last=0,display=0,pointer:number|undefined,x=0,y=0;
  const canvas=renderer.renderer.domElement;
  const down=(e:PointerEvent)=>{pointer=e.pointerId;x=e.clientX;y=e.clientY;canvas.setPointerCapture(pointer);};
  const move=(e:PointerEvent)=>{if(pointer!==e.pointerId)return;renderer.orbit(e.clientX-x,e.clientY-y);x=e.clientX;y=e.clientY;};
  const up=()=>{pointer=undefined;};
  canvas.style.touchAction='none';canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  void renderer.load(setStatus).then(()=>{
   if(dead)return;setReady(true);window.__tiranaEventReview!.ready=true;
   const loop=(now:number)=>{
    const dt=last?Math.min(.05,(now-last)/1000):1/60;last=now;
    sim.body.yaw=renderer.yaw;sim.body.pitch=renderer.pitch;
    sim.setIntent({...sim.intent,yaw:renderer.yaw,pitch:renderer.pitch,fire:false});
    if(!pause.current)sim.step(dt);
    renderer.render(state,'local',pause.current?0:dt,false);
    if(now-display>500){display=now;setPhase(state.cityEvent!.phase);setStatus(state.cityEvent!.report);}
    frame=requestAnimationFrame(loop);
   };frame=requestAnimationFrame(loop);
  }).catch(error=>{if(!dead)setStatus(String(error));});
  return()=>{dead=true;cancelAnimationFrame(frame);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);renderer.destroy();delete window.__tiranaEventReview;};
 },[]);
 const jump=(index:number)=>{
  const sim=window.__tiranaEventReview?.sim;if(!sim?.state.cityEvent||index<0)return;
  sim.setCityEvents(false);sim.setCityEvents(true);sim.step(1/30);
  const age=index?CITY_EVENT_PHASES[index-1].until+1:1;
  sim.state.cityEvent.startedAt=sim.state.elapsed-age;sim.state.cityEvent.orderAt=0;sim.state.cityEvent.nextPyro=sim.state.elapsed;
  sim.step(1/30);setPhase(CITY_EVENT_PHASES[index].id);
 };
 return <main style={{height:'100%',display:'flex',flexDirection:'column'}}>
  <header style={{padding:12}}><strong>TIRANA STREETS · CITY EVENT</strong><p role="status" style={{margin:'6px 0'}}>{status}</p>
   <div style={{display:'flex',gap:8}}><select aria-label="Event phase" disabled={!ready} value={phase} onChange={e=>jump(CITY_EVENT_PHASES.findIndex(p=>p.id===e.target.value))}><option value="waiting" disabled>Event finished</option>{CITY_EVENT_PHASES.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select>
   <button disabled={!ready} aria-pressed={paused} onClick={()=>{pause.current=!pause.current;setPaused(pause.current);}}>{paused?'Resume':'Pause'}</button></div>
  </header>
  <div ref={host} role="img" aria-label="Tirana city and protest at player eye level" style={{flex:1,minHeight:320,position:'relative',overflow:'hidden'}}/>
  <footer style={{padding:12,display:'flex',gap:8,alignItems:'center'}}><label>Graphics <select aria-label="Graphics" value={quality} onChange={e=>{const value=e.target.value as GraphicsSetting;setQuality(value);window.__tiranaEventReview?.renderer.setQuality(value);}}><option value="battery">Battery</option><option value="balanced">Balanced</option><option value="high">High</option></select></label><small>Drag to look · fictional event</small></footer>
 </main>;
}
createRoot(document.getElementById('root')!).render(<CityEventReview/>);
