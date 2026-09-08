import {useEffect,useRef,useState,type PointerEvent as PE} from 'react';
import {StreetCareerRuntime,campaign,type StreetView} from './StreetCareerRuntime';
import {screenStick,HUMAN_ROSTER} from './humanRoster.mjs';
import {CityMap} from '../map/CityMap';
import {StreetArsenal} from './StreetArsenal';
import {difficultyOf,WEAPON_BY_ID} from '../shared/weapons.mjs';
import {wantedStars} from '../shared/cityLife.mjs';
import '../city.css';
import './street-career.css';
const storage=()=>{try{return window.localStorage;}catch{return undefined;}};
type Panel='journal'|'arsenal'|'map'|null;
export function StreetCareerGame({onExit}:{onExit:()=>void}){
  const root=useRef<HTMLDivElement>(null),runtime=useRef<StreetCareerRuntime>(),modal=useRef<HTMLDialogElement>(null);
  const [view,setView]=useState<StreetView|null>(null),[panel,setPanel]=useState<Panel>('journal'),[error,setError]=useState(''),[loading,setLoading]=useState('Loading Tirana'),[difficulty,setDifficulty]=useState('normal'),[stick,setStick]=useState({x:0,y:0});
  const look=useRef<{id:number;x:number;y:number}|null>(null),stickId=useRef<number|null>(null);
  useEffect(()=>{let g:StreetCareerRuntime|undefined,cancelled=false;
    try{if(root.current){g=new StreetCareerRuntime(root.current,v=>{if(!cancelled)setView({...v});},storage(),p=>{if(!cancelled)setPanel(p);});runtime.current=g;void g.load(m=>{if(!cancelled)setLoading(m);}).catch(e=>{if(!cancelled)setError(String(e));});}}catch(e){setError(String(e));}
    return()=>{cancelled=true;g?.dispose();runtime.current=undefined;};
  },[]);
  useEffect(()=>{const d=modal.current;if(panel&&d&&!d.open)d.showModal();if(!panel)d?.close();return()=>{d?.close();};},[panel]);
  const reset=()=>{stickId.current=null;setStick({x:0,y:0});if(runtime.current){runtime.current.input.touch.x=0;runtime.current.input.touch.y=0;}};
  const open=(p:Panel)=>{runtime.current?.pause();reset();setPanel(p);};
  const resume=()=>{const g=runtime.current;if(!g?.ready||g.state.phase==='finished')return;setPanel(null);g.resume();};
  const start=(id:string)=>{if(runtime.current?.start(id,difficulty))setPanel(null);};
  const drag=(e:PE<HTMLDivElement>)=>{if(!runtime.current||view?.paused)return;const b=e.currentTarget.getBoundingClientRect(),s=screenStick(e.clientX-b.left-b.width/2,e.clientY-b.top-b.height/2);runtime.current.input.touch.x=s.x;runtime.current.input.touch.y=s.y;setStick({x:s.x*35,y:-s.y*35});};
  const hold=(key:'gas'|'fast'|'brake'|'fire',value:number|boolean)=>({
    onPointerDown:(e:PE<HTMLButtonElement>)=>{e.preventDefault();if(!runtime.current||view?.paused)return;e.currentTarget.setPointerCapture(e.pointerId);Object.assign(runtime.current.input.touch,{[key]:value});},
    onPointerUp:()=>{if(runtime.current)Object.assign(runtime.current.input.touch,{[key]:key==='gas'?0:false});},
    onPointerCancel:()=>{if(runtime.current)Object.assign(runtime.current.input.touch,{[key]:key==='gas'?0:false});},
    onLostPointerCapture:()=>{if(runtime.current)Object.assign(runtime.current.input.touch,{[key]:key==='gas'?0:false});}
  });
  const p=view?.state.players.local,driving=!!p?.carId,mission=campaign.chapters.find(m=>m.id===view?.state.missionId),target=mission?.stops[p?.index||0];
  return <main className="tsc" aria-label="Tirana Streets solo career">
    <div ref={root} className="tsc-world"/>
    <div className="tsc-look" aria-label="Drag to look" onPointerDown={e=>{if(view?.paused||look.current)return;e.currentTarget.setPointerCapture(e.pointerId);look.current={id:e.pointerId,x:e.clientX,y:e.clientY};}} onPointerMove={e=>{const l=look.current;if(!l||l.id!==e.pointerId||view?.paused)return;runtime.current?.renderer.orbit(e.clientX-l.x,e.clientY-l.y);l.x=e.clientX;l.y=e.clientY;}} onPointerUp={()=>{look.current=null;}} onPointerCancel={()=>{look.current=null;}} onLostPointerCapture={()=>{look.current=null;}}/>
    <header className="tsc-header"><strong>TIRANA STREETS<small>STREET CAREER · SOLO</small></strong><button onClick={()=>open('journal')}>JOURNAL</button><button onClick={onExit}>EXIT</button></header>
    {error&&<div className="tsc-error" role="alert">{error}<button onClick={onExit}>RETURN TO GAMES</button></div>}
    {view&&p&&!panel&&!error&&<>
      <section className="tsc-objective"><small>{mission?.title||'FREE ROAM'}</small><strong>{view.state.phase==='finished'?view.state.message:target?.name||'Explore, drive and visit Arben’s arsenal.'}</strong><span>Health {Math.ceil(p.health)} · ${p.cash} street cash · {'★'.repeat(wantedStars(p.wanted))||'No pursuit'}</span><span>{mission?`${Math.max(0,Math.ceil(mission.time*difficultyOf(view.state.difficulty).time-view.state.elapsed))}s · ${p.index}/${mission.stops.length} stops`:''} {view.fps} FPS</span>{view.state.objectiveRemaining!==undefined&&mission?.type==='combat'&&<span>{view.state.objectiveRemaining} opponents remaining</span>}</section>
      <nav className="tsc-tools"><button onClick={()=>open('map')}>MAP</button><button onClick={()=>open('arsenal')}>ARSENAL</button></nav>
      <div className="tsc-stick" role="group" aria-label={driving?'Steer left or right':'Movement joystick'} onPointerDown={e=>{if(stickId.current!==null)return;e.preventDefault();stickId.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);drag(e);}} onPointerMove={e=>{if(stickId.current===e.pointerId)drag(e);}} onPointerUp={e=>{if(stickId.current===e.pointerId)reset();}} onPointerCancel={reset} onLostPointerCapture={reset}><span style={{transform:`translate(${stick.x}px,${stick.y}px)`}}>↑</span></div>
      <div className="tsc-actions"><button onClick={()=>runtime.current?.action('vehicle')}>{driving?'EXIT CAR':'ENTER CAR'}</button>{driving?<><button {...hold('gas',1)}>ACCELERATE</button><button {...hold('gas',-1)}>REVERSE</button><button {...hold('brake',true)}>BRAKE</button></>:<><button {...hold('fire',true)}>FIRE</button><button onClick={()=>runtime.current?.action('reload')}>RELOAD</button><button {...hold('fast',true)}>SPRINT</button></>}</div>
      <footer>{driving?'Steer: left stick · Pedals: right':'Move: left stick · Look: drag · Fire: hold'}{!driving&&p.weapon&&<small>{WEAPON_BY_ID.get(p.weapon)?.label} · {p.inventory[p.weapon]?.ammo||0}/{p.inventory[p.weapon]?.reserve||0}</small>}</footer>
    </>}
    {panel&&!error&&<dialog ref={modal} className="tsc-dialog" aria-label={panel==='journal'?'Career journal':panel==='arsenal'?'Street arsenal':'Tirana city map'} onCancel={e=>{e.preventDefault();resume();}}>
      <header><h2>{panel==='journal'?'Your name in Tirana':panel==='arsenal'?'Arben · Arsenal':'Tirana city map'}</h2><button disabled={!view?.ready||view.state.phase==='finished'} onClick={resume}>RESUME</button></header>
      {!view?.ready?<p role="status">{loading}…</p>:view&&p&&<>
        {panel==='journal'?<>
          <p>Build your reputation through deliveries, street races, patrol escapes and armed confrontations. This is an original campaign, not a copy of GTA’s story.</p>
          <p><strong>{view.profile.completed.length}/{campaign.chapters.length} chapters</strong> · ${p.cash} street cash · Saved on this device, not TPG.</p>
          {view.state.phase==='finished'&&<p role="status">{view.state.message}{p.finished&&!p.failed?' Completion saved. Replays do not pay a second reward.':''}</p>}
          {view.profile.active&&<><p>Checkpoint: {campaign.chapters.find(m=>m.id===view.profile.active?.id)?.title}. Reopening or retrying restarts this mission with its starting loadout.</p><button onClick={()=>{if(runtime.current?.retry())setPanel(null);}}>RESTART SAVED MISSION</button></>}
          <button className="tsc-primary" onClick={()=>{runtime.current?.explore();setPanel(null);}}>{view.profile.active?'END JOB & FREE ROAM':'FREE ROAM'}</button>
          <label>Difficulty <select value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option value="easy">Explorer</option><option value="normal">Street</option><option value="hard">Veteran</option></select></label>
          <div className="tsc-chapters">{campaign.chapters.map((m,i)=><button key={m.id} disabled={i>view.profile.completed.length} onClick={()=>start(m.id)}><strong>{i+1}. {m.title}</strong><small>{i>view.profile.completed.length?'Complete the previous chapter':view.profile.completed.includes(m.id)?'Completed · Replay without duplicate payout':`${m.type} · $${Math.round(m.reward*difficultyOf(difficulty).reward)} first completion`}</small><span>{m.description}</span></button>)}</div>
          <details><summary>Shared human cast</summary><p>{HUMAN_ROSTER.map(h=>h.label).join(' · ')}</p><p>Civilians and patrols reuse the existing human rigs; the military uses the existing soldier. Original model licences remain in force.</p></details>
          <label>Graphics <select defaultValue="auto" onChange={e=>runtime.current?.renderer.setQuality(e.target.value as 'auto'|'high'|'battery')}><option value="auto">Automatic</option><option value="high">High</option><option value="battery">Battery saver</option></select></label>
        </>:panel==='arsenal'?<StreetArsenal player={p} state={view.state} onAction={a=>runtime.current?.action(a)}/>:<CityMap player={p} state={view.state} route={view.route} large/>}
        {!view.storageOK&&<p role="alert">Device storage unavailable. Progress is session-only.</p>}
        {!!view.assetErrors.length&&<details><summary>Asset problems ({view.assetErrors.length})</summary>{view.assetErrors.map((s,i)=><p key={i}>{s}</p>)}</details>}
      </>}
      <button onClick={onExit}>BACK TO OPERATION / CITY STORIES</button>
    </dialog>}
  </main>;
}
