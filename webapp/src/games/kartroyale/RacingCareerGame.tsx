import {useEffect,useRef,useState} from 'react';
import {KartRenderer,type Frame,type Result} from './renderer';
import {CUPS,GRAND_ROUTE_DIAGNOSTICS} from './simulation.mjs';
import {loadCareer,recordRace,formatTime} from './career';
import '../tirana-social/explore.css';
export function RacingCareerGame({onExit}:{onExit:()=>void}){
  const host=useRef<HTMLDivElement>(null),engine=useRef<KartRenderer|null>(null),active=useRef<number|null>(null),finished=useRef(true);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[career,setCareer]=useState(loadCareer),[hud,setHud]=useState<Frame|null>(null),[result,setResult]=useState<Result|null>(null),[racing,setRacing]=useState(false),[paused,setPaused]=useState(false),[saved,setSaved]=useState(true);
  const progress=useRef(career);progress.current=career;
  useEffect(()=>{let alive=true;let game:KartRenderer|undefined;
    try{if(host.current){game=new KartRenderer(host.current,f=>{if(alive)setHud(f);},r=>{if(!alive||finished.current)return;finished.current=true;const i=r.racers.findIndex(p=>p.id===r.playerId),me=r.racers[i],n=recordRace(progress.current,r.trackId,me?.finished?i+1:7,me?.finished?me.finishTime:0,active.current);progress.current=n.career;setCareer(n.career);setSaved(n.saved);setResult(r);setRacing(false);},setError);engine.current=game;game.setCameraMode('chase');void game.load().then(()=>{if(alive)setReady(true);}).catch(e=>{if(alive)setError(String(e));});}}
    catch(e){setError(e instanceof Error?e.message:'Renderer unavailable');}
    const blur=()=>{game?.pause(true);setPaused(true);};const visibility=()=>{if(document.hidden)blur();};window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
    return()=>{alive=false;window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);game?.destroy();engine.current=null;};
  },[]);
  const drive=(key:'steer'|'brake'|'boost',value:number|boolean)=>{if(!engine.current||paused)return;const input=engine.current.input;if(key==='steer')input.steer=Number(value);else input[key]=!!value;};
  const clear=()=>engine.current?.clearInput();
  function start(index:number){if(!ready||index>0&&!career.cups[index-1])return;active.current=index;finished.current=false;setResult(null);setPaused(false);engine.current?.startLocal(CUPS[index].track,CUPS[index].difficulty);setRacing(true);}
  return <main className="te-game" aria-label="Racing Royal Career"><div className="te-canvas" ref={host}/><header className="te-header"><div><b>RACING ROYAL · CAREER</b><small>{hud?`${Math.round(hud.speed)} · LAP ${hud.lap} · ${hud.position} PLACE`:'PREPARING CITY'}</small></div><button onClick={()=>{const p=!paused;setPaused(p);engine.current?.pause(p);}}>{paused?'RESUME':'PAUSE'}</button><button onClick={onExit}>MODES</button></header>
    {error&&<p className="te-error" role="alert">{error}</p>}
    {!racing&&<section className="te-panel"><h1>Your racing career</h1><p>Existing progress and credits are retained. Grand cups use larger connected road circuits where the map supports a valid closed route.</p><p>{career.credits} career credits · {career.wins} wins · saved on this device, not TPG.</p>{!saved&&<p role="alert">Device save failed. Keep this session open.</p>}{result&&<p>Race complete · {formatTime(result.elapsed)}</p>}
      {CUPS.map((cup,index)=><button key={`${cup.track}:${index}`} style={{display:'block',width:'100%',margin:'8px 0',textAlign:'left'}} disabled={!ready||index>0&&!career.cups[index-1]} onClick={()=>start(index)}><b>{index+1}. {cup.name}</b><br/><small>{career.cups[index]?'Completed · replay':`Finish in the top ${cup.target}`} · {cup.reward} first-completion credits</small></button>)}
      {!!GRAND_ROUTE_DIAGNOSTICS.length&&<details><summary>Map coverage</summary><p>{GRAND_ROUTE_DIAGNOSTICS.join('; ')}</p></details>}
    </section>}
    {racing&&<><div className="te-actions" style={{left:12,right:'auto',maxWidth:'45%',display:'flex'}}>{[-1,1].map(d=><button key={d} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);drive('steer',d);}} onPointerUp={clear} onPointerCancel={clear} onLostPointerCapture={clear}>{d<0?'←':'→'}</button>)}</div><div className="te-actions">{(['brake','boost'] as const).map(key=><button key={key} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);drive(key,true);}} onPointerUp={clear} onPointerCancel={clear} onLostPointerCapture={clear}>{key.toUpperCase()}</button>)}</div></>}
  </main>;
}
