import {useEffect,useRef,useState} from 'react';
import {KartRenderer,type Frame,type Result} from './renderer';
import {CUPS,TRACKS,KARTS,normalizeKart,GRAND_ROUTE_DIAGNOSTICS} from './simulation.mjs';
import {loadCareer,recordRace,formatTime} from './career';
import {createHeldRaceInput} from './heldRaceInput.mjs';
import {KART_TASKS,loadKartTasks,saveKartTasks,finishKartTask,kartTaskXP} from './kartTaskCore.mjs';
import '../tirana-social/explore.css';
import './kart-royale.css';
const storage=()=>{try{return window.localStorage;}catch{return undefined;}};
/** Existing KartRenderer and cups; new tasks are optional device-local goals.
 * A single renderer and input owner are mounted for a career session. */
export function RacingCareerGame({onExit}:{onExit:()=>void}){
  const host=useRef<HTMLDivElement>(null),engine=useRef<KartRenderer|null>(null);
  const active=useRef<number|null>(null),task=useRef<string|null>(null),finished=useRef(true);
  const held=useRef(createHeldRaceInput());
  const [kartId,setKartId]=useState(()=>{try{return normalizeKart(storage()?.getItem('racingRoyal.kart')||'apex');}catch{return 'apex';}});
  const [ready,setReady]=useState(false),[error,setError]=useState('');
  const [loadedKartId,setLoadedKartId]=useState(''),[vehicleError,setVehicleError]=useState(''),[vehicleRetry,setVehicleRetry]=useState(0);
  const [career,setCareer]=useState(loadCareer),[tasks,setTasks]=useState(()=>loadKartTasks(storage()));
  const [hud,setHud]=useState<Frame|null>(null),[result,setResult]=useState<Result|null>(null);
  const [racing,setRacing]=useState(false),[paused,setPaused]=useState(false),[saved,setSaved]=useState(true),[notice,setNotice]=useState('');
  const progress=useRef(career),taskProgress=useRef(tasks),pausedRef=useRef(paused);
  progress.current=career;taskProgress.current=tasks;pausedRef.current=paused;
  const clear=()=>{held.current.clear();engine.current?.clearInput();};
  const pause=(p:boolean)=>{pausedRef.current=p;setPaused(p);clear();engine.current?.pause(p);};
  useEffect(()=>{
    let alive=true,game:KartRenderer|undefined;
    try{
      if(host.current){
        game=new KartRenderer(host.current,f=>{if(alive)setHud(f);},r=>{
          if(!alive||finished.current)return;
          finished.current=true;held.current.clear();game?.clearInput();
          const me=r.racers.find(p=>p.id===r.playerId),place=me?.finished?r.racers.indexOf(me)+1:7;
          const n=recordRace(progress.current,r.trackId,place,me?.finished?me.finishTime:0,active.current);
          progress.current=n.career;setCareer(n.career);
          let taskSaved=true;
          if(task.current){
            const out=finishKartTask(taskProgress.current,task.current,r);
            taskProgress.current=out.profile;setTasks(out.profile);taskSaved=saveKartTasks(storage(),out.profile);
            setNotice(`${out.reason}${out.xp?` +${out.xp} task XP`:''}`);
          }
          setSaved(n.saved&&taskSaved);setResult(r);setRacing(false);setPaused(false);pausedRef.current=false;
        },message=>{if(alive)setError(message);});
        engine.current=game;game.setCameraMode('chase');
        void game.load().then(()=>{if(alive){setReady(true);}}).catch(e=>{if(alive)setError(String(e));});
      }
    }catch(e){setError(e instanceof Error?e.message:'Renderer unavailable');}
    const blur=()=>{if(!alive)return;held.current.clear();game?.clearInput();game?.pause(true);pausedRef.current=true;setPaused(true);};
    const visibility=()=>{if(document.hidden)blur();};
    const keymap:Record<string,['steer'|'brake'|'boost',number|boolean]>={arrowleft:['steer',-1],a:['steer',-1],arrowright:['steer',1],d:['steer',1],' ':['brake',true],s:['brake',true],shift:['boost',true]};
    const down=(e:KeyboardEvent)=>{
      if((e.target as HTMLElement)?.closest?.('input,textarea,select,[contenteditable="true"]')||e.ctrlKey||e.metaKey||e.altKey)return;
      const key=e.key.toLowerCase(),value=keymap[key];
      if(!value||finished.current||pausedRef.current)return;e.preventDefault();held.current.hold(`key:${key}`,...value);if(game)Object.assign(game.input,held.current.read());
    };
    const up=(e:KeyboardEvent)=>{held.current.release(`key:${e.key.toLowerCase()}`);if(game)Object.assign(game.input,held.current.read());};
    window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);
    return()=>{alive=false;held.current.clear();window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);game?.destroy();engine.current=null;};
  },[]);
  useEffect(()=>{
    if(!ready||!engine.current)return;
    let active=true;setVehicleError('');
    void engine.current.setKart(kartId).then(()=>{if(active)setLoadedKartId(kartId);}).catch(()=>{if(active)setVehicleError('This vehicle could not load. Retry or choose another vehicle.');});
    return()=>{active=false;};
  },[kartId,ready,vehicleRetry]);
  const vehicleReady=ready&&loadedKartId===kartId;
  function chooseVehicle(id:string){const next=normalizeKart(id);setKartId(next);try{storage()?.setItem('racingRoyal.kart',next);}catch{/* Session choice still works without storage. */}}
  function start(index:number|null,taskId?:string){
    if(!vehicleReady||!engine.current)return;
    const mission=taskId?KART_TASKS.find(t=>t.id===taskId):undefined;
    if(mission&&KART_TASKS.indexOf(mission)>taskProgress.current.completed.length)return;
    if(index!==null&&(index<0||index>=CUPS.length||index>0&&!progress.current.cups[index-1]))return;
    const config=mission||(index===null?undefined:CUPS[index]);if(!config)return;
    if(!TRACKS.some(t=>t.id===config.track)){setError('This route is unavailable in the current game files.');return;}
    clear();setError('');setNotice('');setResult(null);pause(false);
    try{
      active.current=index;task.current=taskId||null;finished.current=false;
      engine.current.startLocal(config.track,config.difficulty);setRacing(true);
    }catch(e){finished.current=true;setRacing(false);setError(e instanceof Error?e.message:'Race could not start.');}
  }
  function hold(id:string,key:'steer'|'brake'|'boost',value:number|boolean){if(pausedRef.current||finished.current)return;held.current.hold(id,key,value);if(engine.current)Object.assign(engine.current.input,held.current.read());}
  function release(id:string){held.current.release(id);if(engine.current)Object.assign(engine.current.input,held.current.read());}
  const button=(key:'steer'|'brake'|'boost',value:number|boolean,label:string)=><button key={label} aria-label={label}
    onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);hold(`touch:${e.pointerId}`,key,value);}}
    onPointerUp={e=>release(`touch:${e.pointerId}`)} onPointerCancel={e=>release(`touch:${e.pointerId}`)}
    onLostPointerCapture={e=>release(`touch:${e.pointerId}`)}>{label}</button>;
  return <main className="te-game" aria-label="Racing Royal Career"><div className="te-canvas" ref={host}/>
    <header className="te-header"><div><b>RACING ROYAL · KART CAREER</b><small>{hud?`${Math.round(hud.speed)} · LAP ${hud.lap} · ${hud.position} PLACE`:'PREPARING CITY'}</small></div>
      <button onClick={()=>pause(!paused)}>{paused?'RESUME':'PAUSE'}</button><button onClick={onExit}>GARAGE</button></header>
    {error&&<p className="te-error" role="alert">{error}</p>}
    {!racing&&<section className="te-panel"><h1>Your racing career</h1>
      <p>{career.credits} career credits · {career.wins} wins · {kartTaskXP(tasks)} task XP. Saved on this device, not TPG.</p>
      {!saved&&<p role="alert">Device save failed. Progress remains in this session.</p>}
      {result&&<p>Race complete · {formatTime(result.elapsed)}</p>}{notice&&<p role="status">{notice}</p>}
      <label className="rr-career-vehicle">Vehicle<select aria-label="Career vehicle" value={kartId} disabled={!ready} onChange={e=>chooseVehicle(e.target.value)}>{KARTS.map(k=><option value={k.id} key={k.id}>{k.name}</option>)}</select></label>
      {!vehicleReady&&!vehicleError&&<p role="status">Loading vehicle…</p>}
      {vehicleError&&<p role="alert">{vehicleError} <button onClick={()=>setVehicleRetry(n=>n+1)}>Retry</button></p>}
      <h2>Championship cups</h2>
      {CUPS.map((cup,index)=><button className="rr-career-card" key={`${cup.track}:${index}`} disabled={!vehicleReady||index>0&&!career.cups[index-1]} onClick={()=>start(index)}>
        <b>{index+1}. {cup.name}</b><br/><small>{career.cups[index]?'Completed · replay':`Finish in the top ${cup.target}`} · {cup.reward} first-completion credits</small></button>)}
      <h2>Kart driving missions</h2>
      {KART_TASKS.map((mission,index)=><button className="rr-career-card" key={mission.id} disabled={!vehicleReady||index>tasks.completed.length||!TRACKS.some(t=>t.id===mission.track)} onClick={()=>start(null,mission.id)}>
        <b>{mission.title}{tasks.completed.includes(mission.id)?' · COMPLETE':''}</b><br/><small>{mission.description} · {mission.xp} first-completion XP</small></button>)}
      {!!GRAND_ROUTE_DIAGNOSTICS.length&&<details><summary>Route availability</summary><p>{GRAND_ROUTE_DIAGNOSTICS.join('; ')}</p></details>}
    </section>}
    {racing&&<><div className="te-actions rr-steering">{button('steer',-1,'← LEFT')}{button('steer',1,'RIGHT →')}</div><div className="te-actions rr-pedals">{button('brake',true,'BRAKE')}{button('boost',true,'BOOST')}</div></>}
  </main>;
}
