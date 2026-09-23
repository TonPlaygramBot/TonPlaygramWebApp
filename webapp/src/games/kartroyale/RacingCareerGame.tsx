import {useEffect,useRef,useState} from 'react';
import {KartControls} from './KartControls';
import {KartRenderer,type Frame,type Result,type CameraMode} from './renderer';
import {KartAudio} from './audio';
import {CUPS,TRACKS,KARTS,normalizeKart} from './simulation.mjs';
import {loadCareer,recordRace,formatTime} from './career';
import {createHeldRaceInput} from './heldRaceInput.mjs';
import {KART_TASKS,loadKartTasks,saveKartTasks,finishKartTask,kartTaskXP} from './kartTaskCore.mjs';
import {CITY_JOBS,loadCityCareer,saveCityCareer,finishCityJob,cityCareerXP} from './cityJobs.mjs';
import '../tirana-social/explore.css';
import './kart-royale.css';
import './kart-controls.css';
import './racingCareer.css';
const storage=()=>{try{return window.localStorage;}catch{return undefined;}};
type Launch={cup?:number;task?:string;job?:string};
export function RacingCareerGame({onExit}:{onExit:()=>void}){
 const host=useRef<HTMLDivElement>(null),engine=useRef<KartRenderer|null>(null),audio=useRef<KartAudio|null>(null);
 const active=useRef<Launch>({}),finished=useRef(true),held=useRef(createHeldRaceInput());
 const [kartId,setKartId]=useState(()=>{try{return normalizeKart(storage()?.getItem('racingRoyal.kart')||'apex');}catch{return 'apex';}});
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 const [career,setCareer]=useState(loadCareer),[tasks,setTasks]=useState(()=>loadKartTasks(storage())),[city,setCity]=useState(()=>loadCityCareer(storage()));
 const [hud,setHud]=useState<Frame|null>(null),[result,setResult]=useState<Result|null>(null);
 const [racing,setRacing]=useState(false),[paused,setPaused]=useState(false),[saved,setSaved]=useState(true),[notice,setNotice]=useState('');
 const [tab,setTab]=useState<'jobs'|'cups'>('jobs'),[camera,setCamera]=useState<CameraMode>('driver'),[muted,setMuted]=useState(false);
 const progress=useRef(career),taskProgress=useRef(tasks),cityProgress=useRef(city),pausedRef=useRef(false);
 progress.current=career;taskProgress.current=tasks;cityProgress.current=city;
 const clear=()=>{held.current.clear();engine.current?.clearInput();};
 const pause=(p:boolean)=>{pausedRef.current=p;setPaused(p);clear();engine.current?.pause(p);if(p)audio.current?.silence();};
 useEffect(()=>{
  let alive=true,game:KartRenderer|undefined;const sound=new KartAudio();audio.current=sound;
  try{
   if(host.current){
    game=new KartRenderer(host.current,f=>{
     if(!alive)return;setHud(f);sound.update(f,!finished.current&&!pausedRef.current);
    },r=>{
     if(!alive||finished.current)return;
     finished.current=true;held.current.clear();game?.clearInput();sound.silence();
     let didSave=true;
     if(r.cityJob){
      const out=finishCityJob(cityProgress.current,r.cityJob);cityProgress.current=out.profile;setCity(out.profile);
      didSave=saveCityCareer(storage(),out.profile);
      setNotice(`${r.cityJob.reason}${out.xp?` · +${out.xp} career XP`:''}`);
      sound.beep(r.cityJob.status==='complete'?880:220,.2);
     }else{
      const me=r.racers.find(p=>p.id===r.playerId),place=me?.finished?r.racers.indexOf(me)+1:7;
      const n=recordRace(progress.current,r.trackId,place,me?.finished?me.finishTime:0,active.current.cup??null);
      progress.current=n.career;setCareer(n.career);didSave=n.saved;
      if(active.current.task){const out=finishKartTask(taskProgress.current,active.current.task,r);taskProgress.current=out.profile;setTasks(out.profile);didSave=saveKartTasks(storage(),out.profile)&&didSave;setNotice(`${out.reason}${out.xp?` +${out.xp} task XP`:''}`);}
     }
     setSaved(didSave);setResult(r);setRacing(false);setPaused(false);pausedRef.current=false;
    },message=>{if(alive)setError(message);});
    engine.current=game;game.setCameraMode('driver');
    void game.load().then(()=>{if(alive){game?.setKart(kartId);setReady(true);}}).catch(e=>{if(alive)setError(String(e));});
   }
  }catch(e){setError(e instanceof Error?e.message:'Renderer unavailable');}
  const blur=()=>{held.current.clear();game?.clearInput();sound.silence();if(!alive||finished.current)return;game?.pause(true);pausedRef.current=true;setPaused(true);};
  const visibility=()=>{if(document.hidden)blur();};
  const keymap:Record<string,['steer'|'throttle'|'brake'|'boost'|'drift',number|boolean]>={arrowup:['throttle',true],w:['throttle',true],arrowleft:['steer',-1],a:['steer',-1],arrowright:['steer',1],d:['steer',1],' ':['drift',true],arrowdown:['brake',true],s:['brake',true],shift:['boost',true]};
  const down=(e:KeyboardEvent)=>{
   if((e.target as HTMLElement)?.closest?.('input,textarea,select,[contenteditable="true"]')||e.ctrlKey||e.metaKey||e.altKey)return;
   const value=keymap[e.key.toLowerCase()];if(!value||finished.current||pausedRef.current)return;
   e.preventDefault();held.current.hold(`key:${e.key.toLowerCase()}`,...value);if(game)Object.assign(game.input,held.current.read());
  };
  const up=(e:KeyboardEvent)=>{held.current.release(`key:${e.key.toLowerCase()}`);if(game)Object.assign(game.input,held.current.read());};
  window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);window.addEventListener('keydown',down);window.addEventListener('keyup',up);
  return()=>{alive=false;held.current.clear();window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);game?.destroy();sound.destroy();engine.current=null;audio.current=null;};
 },[]);
 function chooseVehicle(id:string){const next=normalizeKart(id);setKartId(next);engine.current?.setKart(next);try{storage()?.setItem('racingRoyal.kart',next);}catch{}}
 function start(selection:Launch){
  if(!ready||!engine.current)return;
  const job=CITY_JOBS.find(j=>j.id===selection.job),task=KART_TASKS.find(t=>t.id===selection.task),cup=selection.cup===undefined?undefined:CUPS[selection.cup];
  if(job&&cityCareerXP(cityProgress.current)<job.unlock)return;
  if(task&&KART_TASKS.indexOf(task)>taskProgress.current.completed.length)return;
  if(cup&&selection.cup!>0&&!progress.current.cups[selection.cup!-1])return;
  const config=job||task||cup;if(!config||!TRACKS.some(t=>t.id===config.track)){setError('This route is unavailable in the current game files.');return;}
  clear();setError('');setNotice('');setResult(null);setHud(null);pause(false);audio.current?.unlock();
  try{active.current=selection;finished.current=false;if(job)engine.current.startCityJob(job.id,job.track);else engine.current.startLocal(config.track,'difficulty' in config?config.difficulty:'street');setRacing(true);}
  catch(e){finished.current=true;setRacing(false);audio.current?.silence();setError(e instanceof Error?e.message:'Session could not start.');}
 }
 function board(){finished.current=true;clear();audio.current?.silence();engine.current?.showGarage();setRacing(false);setResult(null);setNotice('');pause(false);}
 function hold(id:string,key:string,value:number|boolean){if(pausedRef.current||finished.current)return;held.current.hold(id,key,value);if(engine.current)Object.assign(engine.current.input,held.current.read());}
 function release(id:string){held.current.release(id);if(engine.current)Object.assign(engine.current.input,held.current.read());}
 const job=hud?.cityJob,definition=CITY_JOBS.find(j=>j.id===job?.id),target=job?.targets[job.stage];
 const xp=cityCareerXP(city),rank=xp>=700?'City legend':xp>=300?'District specialist':xp>=120?'Trusted driver':'New arrival';
 return <main className="te-game rr-career" aria-label="Racing Royal Career"><div className="te-canvas" ref={host}/>
  <header className="te-header"><div><b>RACING ROYAL</b><small>{racing?(definition?.title||'CHAMPIONSHIP'):rank.toUpperCase()}</small></div>
   {racing&&<button onClick={()=>pause(!paused)}>{paused?'RESUME':'PAUSE'}</button>}
   <button onClick={()=>{clear();audio.current?.silence();onExit();}}>GARAGE</button></header>
  {error&&<p className="te-error" role="alert">{error}</p>}
  {!racing&&<section className="te-panel rr-job-board">
   <div className="rr-career-title"><small>TIRANA CITY STORIES</small><h1>Make your name.</h1><p>{xp} city XP · {Object.keys(city.medals).length}/{CITY_JOBS.length} jobs · {career.wins} race wins</p></div>
   {!saved&&<p role="alert">Device save failed. Progress remains in this session.</p>}
   {result&&<div className="rr-job-result" role="status"><strong>{result.cityJob?.status==='failed'?'Try another run':result.cityJob?'Job complete':'Race complete'}</strong><p>{notice||formatTime(result.elapsed)}</p><button onClick={()=>start(active.current)}>RETRY / REPLAY</button></div>}
   <label className="rr-career-vehicle">YOUR KART<select aria-label="Career kart" value={kartId} disabled={!ready} onChange={e=>chooseVehicle(e.target.value)}>{KARTS.map(k=><option value={k.id} key={k.id}>{k.name}</option>)}</select><small>{KARTS.find(k=>k.id===kartId)?.detail}</small></label>
   <nav className="rr-career-tabs" aria-label="Career activities"><button aria-pressed={tab==='jobs'} onClick={()=>setTab('jobs')}>CITY JOBS</button><button aria-pressed={tab==='cups'} onClick={()=>setTab('cups')}>CHAMPIONSHIPS</button></nav>
   {!ready&&!error&&<p role="status">Preparing karts and the city…</p>}
   {tab==='jobs'?CITY_JOBS.map(m=>{const locked=xp<m.unlock,medal=city.medals[m.id];return <article className="rr-job-card" key={m.id}>
    <div><small>{m.district.toUpperCase()} · {m.kind.toUpperCase()}</small><b>{m.title}</b></div><span>{medal?['','BRONZE','SILVER','GOLD'][medal]:`+${m.xp} XP`}</span>
    <p>{m.brief}</p><footer><small>{m.seconds}s · {m.health}% condition{city.best[m.id]?` · Best ${formatTime(city.best[m.id])}`:''}</small><button disabled={!ready||locked} onClick={()=>start({job:m.id})}>{locked?`${m.unlock} XP TO UNLOCK`:medal?'REPLAY':'ACCEPT JOB'}</button></footer>
   </article> }):<><p>{career.credits} career credits · {kartTaskXP(tasks)} race task XP</p>
    {CUPS.map((cup,index)=><button className="rr-career-card" key={`${cup.track}:${index}`} disabled={!ready||index>0&&!career.cups[index-1]} onClick={()=>start({cup:index})}><b>{cup.name}</b><br/><small>{career.cups[index]?'Completed · replay':`Finish in the top ${cup.target}`} · {cup.reward} first-completion credits</small></button>)}
    <h2>Race challenges</h2>{KART_TASKS.map((m,index)=><button className="rr-career-card" key={m.id} disabled={!ready||index>tasks.completed.length} onClick={()=>start({task:m.id})}><b>{m.title}</b><br/><small>{m.description} · {m.xp} XP</small></button>)}
   </>}
   <p className="rr-save-note">Progress saves on this device. Career XP and credits are separate from TPG.</p>
  </section>}
  {racing&&<>
   <div className="rr-career-tools"><button onClick={()=>{const next=camera==='driver'?'chase':'driver';setCamera(next);engine.current?.setCameraMode(next);}} aria-label="Switch camera">{camera==='driver'?'CHASE VIEW':'DRIVER VIEW'}</button><button onClick={()=>{setMuted(!muted);audio.current?.setMuted(!muted);}} aria-label={muted?'Enable sound':'Mute sound'}>{muted?'SOUND OFF':'SOUND ON'}</button></div>
   <div className="rr-job-hud">
    {job&&definition?<><b>{target?.label||(definition.kind==='drift'?'Bank the remaining drift points':'Complete the skill target')}</b><span>{Math.ceil(Math.max(0,definition.seconds-job.elapsed))}s · {Math.min(job.stage+1,job.targets.length)}/{job.targets.length} stops · {Math.round(hud?.health??100)}% condition</span>
      {target&&<small>{Math.round(job.distance)} m {definition.kind==='delivery'&&job.distance<4?'· Stop, then release both pedals':''}</small>}
      {definition.score&&<small>{Math.floor(job.score)}/{definition.score} {definition.kind==='precision'?'smooth driving seconds':'drift points'}{job.chain>0?` · ${Math.floor(job.chain)} to bank`:''}</small>}
      {job.hold>0&&<progress max={1.5} value={job.hold} aria-label="Delivery handover"/>}</>:<><b>LAP {hud?.lap||1}/3 · POSITION {hud?.position||1}/6</b><span>{hud?.countdown?`START IN ${hud.countdown}`:formatTime(hud?.time||0)}</span></>}
   </div>
   <div className="rr-career-speed"><b>{Math.round(Math.abs(hud?.speed||0)*3.6)}</b><small>KM/H</small><button disabled={paused} onClick={()=>{if(engine.current)engine.current.input.recover=true;setTimeout(()=>{if(engine.current)engine.current.input.recover=false;},80);}}>RECOVER</button></div>
   <KartControls boost={hud?.boost||0} drifting={hud?.drifting} driftCharge={hud?.driftCharge} turbo={hud?.turbo} boostEvent={hud?.boostEvent} reversing={hud?.reversing} disabled={paused} hold={hold} release={release}/>
   {paused&&<section className="rr-career-pause" aria-label="Paused"><h2>Paused</h2><button onClick={()=>pause(false)}>RESUME DRIVE</button><button onClick={()=>start(active.current)}>RESTART</button><button onClick={board}>JOB BOARD</button></section>}
  </>}
 </main>;
}
