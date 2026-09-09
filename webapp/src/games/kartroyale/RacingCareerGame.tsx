import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {KartRenderer,type Frame,type Result,type CameraMode} from './renderer';
import {CUPS,TRACKS,KARTS,normalizeKart} from './simulation.mjs';
import {KartAudio} from './audio';
import {loadCareer,recordRace,recordKartMission,formatTime} from './career';
import {KART_MISSIONS,normalizeKartJobs,availableKartJob,KartControlState,KART_KEYS,type KartAction} from './kartMissionCore.mjs';
import '../tirana-social/explore.css';
import './kart-missions.css';
type Run={kind:'cup'|'mission'|'practice';id:string;track:string;difficulty:string;cup:number|null;brief:string};
const stored=(key:string,fallback:string)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
/** The existing KartRenderer owns the ONLY update/physics/render loop. All modes
 * keep the original kart assets, acceleration, collision, AI and race circuit. */
export function RacingCareerGame({onExit,practice=false}:{onExit:()=>void;practice?:boolean}){
  const host=useRef<HTMLDivElement>(null),engine=useRef<KartRenderer|null>(null),audio=useRef<KartAudio|null>(null);
  const controls=useRef(new KartControlState()),active=useRef<Run|null>(null),finished=useRef(true),minimumHealth=useRef(100);
  const pausedRef=useRef(false),running=useRef(false),lastCountdown=useRef(-1);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[career,setCareer]=useState(loadCareer),[hud,setHud]=useState<Frame|null>(null);
  const [racing,setRacing]=useState(false),[paused,setPaused]=useState(false),[notice,setNotice]=useState(''),[saved,setSaved]=useState(true),[attempt,setAttempt]=useState(0);
  const [track,setTrack]=useState(TRACKS[0].id),[difficulty,setDifficulty]=useState('rookie');
  const [kart,setKart]=useState(()=>normalizeKart(stored('racingRoyal.kart','apex')));
  const [camera,setCamera]=useState<CameraMode>(()=>stored('racingRoyal.camera','driver')==='chase'?'chase':'driver');
  const [muted,setMuted]=useState(()=>stored('racingRoyal.muted','false')==='true');
  const progress=useRef(career);progress.current=career;
  const preferences=useRef({kart,camera,muted});preferences.current={kart,camera,muted};
  function syncInput(){if(engine.current)Object.assign(engine.current.input,controls.current.read());}
  function pauseGame(value:boolean){pausedRef.current=value;setPaused(value);controls.current.setEnabled(running.current&&!value);syncInput();engine.current?.pause(value);if(value)audio.current?.silence();}
  useEffect(()=>{
    let alive=true,game:KartRenderer|undefined;setReady(false);setError('');
    const sound=new KartAudio();audio.current=sound;sound.setMuted(muted);
    try{
      if(host.current){
        game=new KartRenderer(host.current,frame=>{
          if(!alive)return;setHud(frame);sound.update(frame,running.current&&!pausedRef.current);
          if(running.current&&Number.isFinite(frame.health))minimumHealth.current=Math.min(minimumHealth.current,frame.health);
          if(running.current&&frame.countdown!==lastCountdown.current){lastCountdown.current=frame.countdown;sound.beep(frame.countdown===0?900:500,.13);}
        },result=>{
          if(!alive||finished.current||!active.current)return;
          finished.current=true;running.current=false;controls.current.setEnabled(false);game?.clearInput();sound.silence();
          const run=active.current,index=result.racers.findIndex(p=>p.id===result.playerId),me=result.racers[index];
          const next=run.kind==='mission'?recordKartMission(progress.current,run.id,result,minimumHealth.current):recordRace(progress.current,result.trackId,me?.finished?index+1:7,me?.finished?me.finishTime:0,run.cup);
          progress.current=next.career;setCareer(next.career);setSaved(next.saved);
          const verdict='reason' in next?String(next.reason):me?.finished?`Finished ${index+1} · ${formatTime(me.finishTime)}`:'Race incomplete. Retry from the grid.';
          setNotice(`${verdict}${next.reward?` +${next.reward} career credits`:''}`);setRacing(false);setPaused(false);pausedRef.current=false;
        },message=>{if(alive){setError(message);pauseGame(true);}});
        engine.current=game;game.setCameraMode(camera);game.setKart(kart);
        void game.load().then(()=>{if(alive){game?.setKart(preferences.current.kart);game?.setCameraMode(preferences.current.camera);sound.setMuted(preferences.current.muted);setReady(true);}}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'Kart assets could not load.');});
      }
    }catch(e){setError(e instanceof Error?e.message:'Renderer unavailable');}
    const blur=()=>{if(running.current)pauseGame(true);else{controls.current.clear();syncInput();}};
    const hidden=()=>{if(document.hidden)blur();};
    const down=(e:KeyboardEvent)=>{
      if(e.target instanceof Element&&e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(e.code==='Escape'&&running.current){e.preventDefault();if(!e.repeat)pauseGame(!pausedRef.current);return;}
      const binding=KART_KEYS[e.code];if(!binding||!running.current||pausedRef.current)return;
      e.preventDefault();controls.current.hold(`key:${e.code}`,binding[0],binding[1]);syncInput();
    };
    const up=(e:KeyboardEvent)=>{controls.current.release(`key:${e.code}`);syncInput();};
    window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);window.addEventListener('keydown',down);window.addEventListener('keyup',up);
    return()=>{alive=false;finished.current=true;running.current=false;controls.current.clear();window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);game?.destroy();sound.destroy();engine.current=null;audio.current=null;};
  },[attempt]);
  useEffect(()=>{engine.current?.setCameraMode(camera);try{localStorage.setItem('racingRoyal.camera',camera);}catch{}},[camera]);
  useEffect(()=>{engine.current?.setKart(kart);try{localStorage.setItem('racingRoyal.kart',kart);}catch{}},[kart]);
  useEffect(()=>{audio.current?.setMuted(muted);try{localStorage.setItem('racingRoyal.muted',String(muted));}catch{}},[muted]);
  function start(run:Run){
    if(!ready||running.current||!engine.current)return;
    if(run.kind==='mission'&&!availableKartJob(career.jobs,run.id))return;
    if(run.kind==='cup'&&run.cup!==null&&run.cup>0&&!career.cups[run.cup-1])return;
    active.current=run;finished.current=false;minimumHealth.current=100;lastCountdown.current=-1;setNotice('');setError('');controls.current.clear();audio.current?.unlock();
    try{engine.current.startLocal(run.track,run.difficulty);running.current=true;setRacing(true);pauseGame(false);}
    catch(e){finished.current=true;running.current=false;setRacing(false);setError(e instanceof Error?e.message:'Could not start race');}
  }
  function abort(){finished.current=true;running.current=false;controls.current.setEnabled(false);engine.current?.clearInput();engine.current?.showGarage();audio.current?.silence();setRacing(false);setPaused(false);pausedRef.current=false;setNotice('Run abandoned. Career progress is unchanged.');}
  function press(e:PointerEvent<HTMLButtonElement>,action:KartAction,value:number|boolean=true){e.preventDefault();if(!running.current||pausedRef.current)return;e.currentTarget.setPointerCapture(e.pointerId);controls.current.hold(`pointer:${e.pointerId}`,action,value);syncInput();}
  function release(e:PointerEvent<HTMLButtonElement>){controls.current.release(`pointer:${e.pointerId}`);syncInput();}
  const jobs=normalizeKartJobs(career.jobs);
  const holdButton=(label:string,action:KartAction,value:number|boolean=true)=><button aria-label={label} disabled={paused} onPointerDown={e=>press(e,action,value)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>{label}</button>;
  return <main className="te-game kr-missions" aria-label={practice?'Racing Royal versus AI':'Racing Royal Career'}>
    <div className="te-canvas" ref={host}/>
    <header className="te-header"><div><b>RACING ROYAL · {practice?'VS AI':'CAREER'}</b><small>{racing&&hud?`LAP ${hud.lap} · PLACE ${hud.position} · HEALTH ${Math.round(hud.health)}`:'KART RACING ON TIRANA STREETS'}</small></div>{racing&&<button onClick={()=>pauseGame(!paused)}>{paused?'RESUME':'PAUSE'}</button>}<button onClick={onExit}>MODES</button></header>
    {error&&<div className="te-error" role="alert">{error}<button onClick={()=>{abort();setAttempt(n=>n+1);}}>RELOAD RACE VIEW</button></div>}
    {!racing&&<section className="te-panel kr-job-board" aria-label="Race selection">
      <h1>{practice?'Race the AI':'Your kart career'}</h1><p>Original karts and racing physics. Choose a mapped Tirana circuit, not an on-foot city mission.</p>
      <div className="kr-job-settings"><label>Kart<select value={kart} onChange={e=>setKart(e.target.value)}>{KARTS.map(k=><option key={k.id} value={k.id}>{k.name}</option>)}</select></label><label>Camera<select value={camera} onChange={e=>setCamera(e.target.value as CameraMode)}><option value="driver">Driver view</option><option value="chase">Chase view</option></select></label><button aria-pressed={muted} onClick={()=>setMuted(v=>!v)}>{muted?'ENABLE SOUND':'MUTE SOUND'}</button></div>
      {!ready&&!error&&<p role="status">Loading the original kart and Tirana scene assets…</p>}
      {notice&&<p className="kr-job-result" role="status">{notice}</p>}{!saved&&<p role="alert">Device save failed. Progress is available in this session only.</p>}
      {practice?<><label>Circuit<select value={track} onChange={e=>setTrack(e.target.value)}>{TRACKS.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>AI difficulty<select value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option value="rookie">Rookie</option><option value="street">Street</option><option value="pro">Pro</option></select></label><button className="kr-job-start" disabled={!ready} onClick={()=>start({kind:'practice',id:'practice',track,difficulty,cup:null,brief:'Race the AI through Tirana.'})}>START VS AI</button></>:<>
        <p>{career.credits} career credits · {career.wins} wins · local progress, not TPG.</p>
        <h2>Street missions · {jobs.completed.length}/{KART_MISSIONS.length}</h2>
        {KART_MISSIONS.map((m,i)=><article className="kr-job-card" key={m.id}><small>MISSION {i+1} · {m.objective.toUpperCase()}</small><h3>{m.title}</h3><p>{m.description}</p><button disabled={!ready||!availableKartJob(jobs,m.id)} onClick={()=>start({kind:'mission',id:m.id,track:m.track,difficulty:m.difficulty,cup:null,brief:m.description})}>{jobs.completed.includes(m.id)?'REPLAY · NO DUPLICATE REWARD':availableKartJob(jobs,m.id)?`START · ${m.reward} CREDITS`:'LOCKED · FINISH PREVIOUS MISSION'}</button></article>)}
        <h2>Championship cups</h2>{CUPS.map((cup,i)=><article className="kr-job-card" key={`${i}:${cup.track}`}><h3>{cup.name}</h3><p>Finish in the top {cup.target}. Original cup progress is retained.</p><button disabled={!ready||i>0&&!career.cups[i-1]} onClick={()=>start({kind:'cup',id:`cup-${i}`,track:cup.track,difficulty:cup.difficulty,cup:i,brief:`Finish in the top ${cup.target}.`})}>{career.cups[i]?'REPLAY CUP':`ENTER · ${cup.reward} CREDITS`}</button></article>)}
      </>}
    </section>}
    {racing&&<><section className="kr-job-objective"><b>{active.current?.brief}</b><small>{hud?`${formatTime(hud.time)} · ${hud.fps} FPS`:''}</small>{paused&&<><p>Paused. Your kart is not accepting controls.</p><button onClick={()=>pauseGame(false)}>RESUME RACE</button><button onClick={abort}>ABANDON RUN</button></>}</section><div className="kr-job-steer">{holdButton('←','steer',-1)}{holdButton('→','steer',1)}</div><div className="kr-job-pedals">{holdButton('BRAKE','brake')}{holdButton('DRIFT','drift')}{holdButton('BOOST','boost')}</div></>}
  </main>;
}
