import {GraphicsControl} from '../GraphicsControl';
import {FrameRateControl} from '../FrameRateControl';
import {MovementStick} from '../MovementStick';
import '../weapon-switcher.css';
import {useEffect,useRef,useState} from 'react';
import {CareerRuntime,type CareerView} from './CareerRuntime';
import {CHAPTERS,currentStep,careerBalance} from './careerCore.mjs';
import {CityMap} from '../map/MapPanel';
import './career.css';
const storage=()=>{try{return window.localStorage;}catch{return undefined;}};
/** Original city career: exploration, contacts, deliveries and an authored Dajti
 * excursion. Offline progress is deliberately separate from TPG match balances. */
export function CareerGame({onExit}:{onExit:()=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),surface=useRef<HTMLDivElement>(null),runtime=useRef<CareerRuntime|null>(null);
 const [view,setView]=useState<CareerView|null>(null),[error,setError]=useState(''),[map,setMap]=useState(false);
 const resumeAfterMap=useRef(false),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{let game:CareerRuntime|undefined;try{if(canvas.current&&surface.current){game=new CareerRuntime(canvas.current,surface.current,setView,storage());runtime.current=game;}}catch(e){setError(e instanceof Error?e.message:'Career could not load.');}return()=>{game?.dispose();runtime.current=null;};},[]);
 useEffect(()=>{if(map)dialog.current?.showModal();return()=>dialog.current?.close();},[map]);
 const reset=()=>{if(runtime.current)runtime.current.input.move={x:0,y:0};};
 const closeMap=()=>{setMap(false);if(resumeAfterMap.current)runtime.current?.resume();resumeAfterMap.current=false;};
 const step=view?currentStep(view.profile):null,active=CHAPTERS.find(c=>c.id===view?.profile.active?.id);
 return <main className={`tc-game${view?.settings.leftHanded?' is-left-handed':''}`} aria-label="Tirana Streets career">
  <canvas ref={canvas}/><div ref={surface} className="tc-look" aria-label="Drag to look around"/>
  <header className="tc-header"><strong>TIRANA STREETS<small>ORIGINAL CAREER</small></strong><button className="tc-menu-button" onClick={()=>runtime.current?.pause()}>MENU</button><button onClick={onExit}>EXIT</button></header>
  {error?<section className="tc-journal" role="alert"><h2>Career could not start</h2><p>{error}</p><button onClick={onExit}>Back to game</button></section>:!view?<p className="tc-status">Loading the shared Tirana city…</p>:<>
   {!view.paused&&<section className="tc-objective"><small>{active?.title||'FREE EXPLORATION'}</small><strong>{step?.text||'Explore the city, or open the journal to take a job.'}</strong><span>{Number.isFinite(view.distance)?`${Math.round(view.distance)} m · `:''}{view.fps} FPS{active?.limit?` · ${Math.max(0,Math.ceil(active.limit-(view.profile.active?.elapsed||0)))}s left`:''}</span></section>}
   {!view.paused&&!view.ride&&!view.overlook&&<>
    <button className="tc-map-button" onClick={()=>{resumeAfterMap.current=!view.paused;runtime.current?.pause();reset();setMap(true);}}>CITY MAP</button>
    <MovementStick className="tc-stick" label="Movement joystick" disabled={view.paused||view.ride||view.overlook} deadzone={view.settings.joystickDeadzone}
      claim={()=>!!runtime.current?.input.active} release={reset} move={(x,y)=>{if(runtime.current)runtime.current.input.move={x,y};}}/>
    <button className="tc-interact" disabled={!step||view.distance>4} onClick={()=>runtime.current?.interact()}>{step?.action==='ride'?'TRAVEL TO DAJTI':step?.action==='inspect'?'OBSERVE':step?.action==='deliver'?'DELIVER':'TALK'}</button>
    <p className="tc-controls">Move: left stick / WASD · Look: drag · Interact: E</p>
   </>}
   {view.overlook&&!view.paused&&<section className="tc-ride"><strong>PANORAMA E TIRANËS · DAJTI</strong><p>Rrëshqit për të parë qytetin dhe horizontin drejt Durrësit.</p><button onClick={()=>runtime.current?.returnFromOverlook()}>KTHEHU NË QYTET</button></section>}
   {view.ride&&<section className="tc-ride"><strong>DAJTI EKSPRES · AUTHOR-MODELED EXCURSION</strong><progress max={1} value={view.rideProgress}/><p>90-second game-time journey. Terminal map locations are sourced; relief, support positions and elevations are approximate. The transfer from the city is not a modeled road.</p><button onClick={()=>runtime.current?.cancel()}>Return to city without completing</button></section>}
   {view.paused&&!map&&<section className="tc-journal" aria-label="Career journal">
    <section aria-label="Graphics and performance"><h2>Graphics & performance</h2>
      <FrameRateControl value={view.settings.targetFps} onChange={targetFps=>runtime.current?.setSettings({targetFps})}/>
      <GraphicsControl value={view.settings.quality} onChange={quality=>runtime.current?.setSettings({quality})}/>
      <label>Look sensitivity<input type="range" min="0.4" max="2" step="0.05" value={view.settings.sensitivity} onChange={e=>runtime.current?.setSettings({sensitivity:Number(e.target.value)})}/></label>
      <label>Joystick dead zone<input type="range" min="0" max="0.25" step="0.01" value={view.settings.joystickDeadzone} onChange={e=>runtime.current?.setSettings({joystickDeadzone:Number(e.target.value)})}/></label>
      <label><input type="checkbox" checked={view.settings.leftHanded} onChange={e=>runtime.current?.setSettings({leftHanded:e.target.checked})}/> Left-handed layout</label>
    </section>
    <small>FICTIONAL CONTACTS · REAL CITY FOOTPRINTS</small><h1>Your name in Tirana.</h1><p>Meet contacts, complete jobs and unlock the Dajti excursion. Progress is saved on this device.</p>
    <div className="tc-balance"><strong>{careerBalance(view.profile)}</strong> career credits · Not TPG <span>{view.profile.completed.length}/{CHAPTERS.length} chapters</span></div>
    {view.profile.active&&<p role="status">{view.profile.active.status==='failed'?view.profile.active.reason:`Checkpoint saved: ${currentStep(view.profile)?.text||active?.title}`}</p>}
    {!view.playerReady&&(view.playerError?<div role="alert"><p>{view.playerError}</p><button onClick={()=>void runtime.current?.loadPlayer()}>Retry player download</button></div>:<p role="status">Loading your selected player…</p>)}
    <button className="tc-primary" disabled={!view.playerReady} onClick={()=>runtime.current?.freeExplore()}>{view.profile.active?.status==='active'?'CONTINUE JOB':'FREE EXPLORATION'}</button>
    {CHAPTERS.map((chapter,i)=>{const locked=i>view.profile.completed.length,blocked=view.blocked.includes(chapter.id);return <button className="tc-chapter" key={chapter.id} disabled={!view.playerReady||locked||blocked} onClick={()=>runtime.current?.select(chapter.id)}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{chapter.title}</strong><small>{blocked?'Mapped access unavailable — requires map review':locked?'Complete the previous chapter':view.profile.completed.includes(chapter.id)?'Completed · Replay without duplicate rewards':`${chapter.contact} · ${chapter.reward} career credits`}</small></div></button>;})}
    {!view.storageOK&&<p role="alert">Device storage is unavailable. Progress will last for this session only.</p>}
    {view.assetErrors.length>0&&<details><summary>Asset loading problems</summary>{view.assetErrors.map((e,i)=><p key={i}>{e}</p>)}</details>}
    <p className="tc-fine">Uses your selected player with its original textures. Explore on foot, meet contacts and complete delivery jobs. Building facades are authored reconstructions.</p>
   </section>}
   {map&&<dialog ref={dialog} className="tc-map-dialog" onCancel={e=>{e.preventDefault();closeMap();}}><header><h2>CAREER · CITY MAP</h2><button onClick={closeMap}>CLOSE</button></header><CityMap player={view.player} state={null} route={view.route} large routeNotice={view.routeNotice}/><p>Career route shown in green. Solo play is paused.</p></dialog>}
  </>}
 </main>;
}
