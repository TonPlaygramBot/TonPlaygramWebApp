import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {sendFriendRequest} from '../../utils/api.js';
import {ExploreConnection} from './ExploreConnection';
import {ExploreRuntime} from './ExploreRuntime';
import {useExploreMedia} from './useExploreMedia';
import type {ExploreSnapshot} from './types';
import './explore.css';
function RemoteAudio({stream}:{stream:MediaStream}){const ref=useRef<HTMLAudioElement>(null);const [blocked,setBlocked]=useState(false);useEffect(()=>{const a=ref.current;if(!a)return;a.srcObject=stream;void a.play().then(()=>setBlocked(false)).catch(()=>setBlocked(true));return()=>{a.pause();a.srcObject=null;};},[stream]);return <><audio ref={ref} autoPlay onPlaying={()=>setBlocked(false)}/>{blocked&&<button className="te-audio-unlock" onClick={()=>{document.querySelectorAll<HTMLAudioElement>('.te-game audio').forEach(a=>{void a.play().catch(()=>{});});}}>TAP TO HEAR CALL</button>}</>;}
export function ExploreGame({onExit,sourceGame='streets'}:{onExit:()=>void;sourceGame?:'streets'|'racing'}){
  const root=useRef<HTMLDivElement>(null),connection=useRef<ExploreConnection|null>(null),runtime=useRef<ExploreRuntime|null>(null);
  const [snapshot,setSnapshot]=useState<ExploreSnapshot|null>(null),[error,setError]=useState(''),[fps,setFps]=useState(0),[ready,setReady]=useState(false),[panel,setPanel]=useState(false),[paused,setPaused]=useState(false),[text,setText]=useState(''),[notice,setNotice]=useState(''),[sent,setSent]=useState<Set<string>>(()=>new Set());
  const request=(a:string,p?:Record<string,unknown>)=>connection.current?.request(a,p)||Promise.reject(Error('Connect first'));
  const media=useExploreMedia(snapshot,request);
  useEffect(()=>{
    let accountId='';try{accountId=localStorage.getItem('accountId')||'';}catch{}
    if(!accountId){setError('Sign in to your existing TonPlaygram account to meet other players.');return;}
    let alive=true;const c=new ExploreConnection(accountId,s=>{if(alive){setSnapshot(s);runtime.current?.accept(s);}},e=>{if(alive)setError(e);});connection.current=c;
    let r:ExploreRuntime|undefined;try{if(root.current){r=new ExploreRuntime(root.current,c,e=>{if(alive)setError(e);},s=>{if(alive){setFps(s.fps);setReady(s.ready);}});runtime.current=r;}}catch(e){setError(e instanceof Error?e.message:'Unable to open 3D view');return()=>{alive=false;c.dispose();};}
    const params=new URLSearchParams(window.location.search),room=params.get('exploreRoom')||undefined;
    void c.join('rpm-current',room).catch(e=>{if(alive)setError(e.message);});
    return()=>{alive=false;void media.stop();c.dispose();r?.dispose();runtime.current=null;connection.current=null;};
  },[]);
  useEffect(()=>{if(!snapshot)return;const streams={...media.remote};if(media.local)streams[snapshot.playerId]=media.local;runtime.current?.media(streams);},[snapshot,media.local,media.remote]);
  const stopMove=()=>{if(runtime.current)runtime.current.input.touch={x:0,y:0,gas:0,fast:false,brake:false,fire:false};};
  const look=useRef<{id:number;x:number;y:number}|null>(null);
  function dragLook(e:PointerEvent<HTMLDivElement>){const p=look.current;if(!p||e.pointerId!==p.id||!runtime.current)return;runtime.current.yaw-=(e.clientX-p.x)*.005;runtime.current.pitch=Math.max(.05,Math.min(.8,runtime.current.pitch+(e.clientY-p.y)*.004));look.current={id:e.pointerId,x:e.clientX,y:e.clientY};}
  function move(e:PointerEvent<HTMLDivElement>){if(!runtime.current||!ready||panel||paused)return;const box=e.currentTarget.getBoundingClientRect();let x=(e.clientX-box.left-box.width/2)/38,y=-(e.clientY-box.top-box.height/2)/38;const m=Math.max(1,Math.hypot(x,y));x/=m;y/=m;runtime.current.input.touch.x=x;runtime.current.input.touch.y=y;runtime.current.input.touch.gas=y;}
  function togglePanel(){const open=!panel;setPanel(open);runtime.current?.pause(open||paused);stopMove();}
  const run=async(fn:()=>Promise<unknown>)=>{setError('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Action failed');}};
  const me=snapshot?.members.find(m=>m.id===snapshot.playerId);
  return <main className="te-game" aria-label="Tirana shared exploration">
    <div ref={root} className="te-canvas"/>
    <div className="te-look" aria-label="Drag to look" onPointerDown={e=>{void runtime.current?.audio.unlock().catch(()=>{});e.currentTarget.setPointerCapture(e.pointerId);look.current={id:e.pointerId,x:e.clientX,y:e.clientY};}} onPointerMove={dragLook} onPointerUp={()=>{look.current=null;}} onPointerCancel={()=>{look.current=null;}} onLostPointerCapture={()=>{look.current=null;}}/>
    <header className="te-header"><div><b>{sourceGame==='racing'?'RACING ROYAL':'TIRANA STREETS'}</b><small>EXPLORE · {snapshot?`${snapshot.members.length}/4 people`:'CONNECTING'} · {fps} FPS</small></div><button onClick={togglePanel}>PEOPLE / CHAT</button><button onClick={()=>{void media.stop();onExit();}}>EXIT</button></header>
    {(error||media.error)&&<p className="te-error" role="alert">{error||media.error}</p>}
    {!ready&&!error&&<p className="te-loading" role="status">Loading the mapped city and your shared human character…</p>}
    {!panel&&<><div className="te-stick" role="group" aria-label="Movement joystick" onPointerDown={e=>{void runtime.current?.audio.unlock().catch(()=>{});e.currentTarget.setPointerCapture(e.pointerId);move(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))move(e);}} onPointerUp={stopMove} onPointerCancel={stopMove} onLostPointerCapture={stopMove}><span>↑</span></div><div className="te-actions"><button disabled={!ready} onClick={()=>void run(()=>request('interact',{interaction:'vehicle'}))}>ENTER / EXIT CAR</button><button onClick={()=>{const next=!paused;setPaused(next);runtime.current?.pause(next);stopMove();}}>{paused?'RESUME MOVEMENT':'PAUSE MOVEMENT'}</button></div></>}
    {panel&&<section className="te-panel" aria-label="Social controls"><h1>Meet in Tirana</h1><p>No fighting, race clock or TPG stake. Movement pauses while this panel is open; other people remain live.</p>
      <div className="te-live"><b>{media.local?'LIVE WITH THIS ROOM':'CAMERA & MICROPHONE OFF'}</b><p>{media.local?'Your media is shared with opted-in people listed below. Leaving or hiding the page stops capture.':'Choose voice or camera explicitly. Your profile avatar stays on your character until you go live.'}</p>
        {media.local?<><button onClick={()=>void media.mute()}>{me?.media.microphone?'MUTE MICROPHONE':'UNMUTE MICROPHONE'}</button><button onClick={()=>void media.stop()}>STOP LIVE · USE AVATAR</button></>:<><button disabled={media.starting||!snapshot} onClick={()=>void media.start(false)}>JOIN VOICE</button><button disabled={media.starting||!snapshot} onClick={()=>void media.start(true)}>GO LIVE · CAMERA + MIC</button></>}
      </div>
      <label>Room invitation<input readOnly value={snapshot?`${window.location.origin}${sourceGame==='racing'?'/games/kartroyale':'/games/tiranastreets'}?mode=ai&activity=explore&exploreRoom=${snapshot.id}`:''} onFocus={e=>e.currentTarget.select()}/></label>
      <div className="te-people">{snapshot?.members.map(m=><article key={m.id}><strong>{m.name}{m.id===snapshot.playerId?' (you)':''}</strong><small>{m.media.camera?'Camera live':m.media.microphone?'Voice live':m.callJoined?'Call joined · muted':'Avatar only'}</small>{m.id!==snapshot.playerId&&<><button disabled={sent.has(m.id)} onClick={()=>void run(async()=>{if(!me)throw Error('Connect first');await sendFriendRequest(me.socialId,m.socialId);setSent(old=>new Set([...old,m.id]));setNotice('Friend request sent. It becomes a friendship only after acceptance.');})}>{sent.has(m.id)?'REQUEST SENT':'ADD FRIEND'}</button><button onClick={()=>void run(()=>request('block',{to:m.id}))}>BLOCK THIS SESSION</button><button onClick={()=>void run(async()=>{await request('report',{to:m.id,reason:'Inappropriate behaviour in Explore'});setNotice('Report submitted to the server operator.');})}>REPORT</button></>}</article>)}</div>
      <label>Human character<select value={me?.appearance||'rpm-current'} onChange={e=>void run(()=>request('appearance',{appearance:e.target.value}))}><option value="rpm-current">Chess avatar</option><option value="rpm-67d411-domino">Casino Check</option><option value="rpm-67f433-domino">Linen Street</option><option value="rpm-67e1b5-domino">Jacquard Night</option><option value="athlete-male">Adrian</option><option value="athlete-female">Maya</option></select></label>
      {notice&&<p role="status">{notice}</p>}<div className="te-chat" role="log" aria-live="polite">{snapshot?.messages.map(m=><p key={m.id}><b>{m.name}: </b>{m.text}</p>)}</div>
      <form onSubmit={e=>{e.preventDefault();void run(async()=>{await request('chat',{text});setText('');});}}><input value={text} onChange={e=>setText(e.target.value)} maxLength={280} placeholder="Message this room" aria-label="Chat message"/><button disabled={!text.trim()}>SEND</button></form><button onClick={togglePanel}>BACK TO CITY</button>
    </section>}
    {Object.entries(media.remote).map(([id,stream])=><RemoteAudio key={id} stream={stream}/>)}
  </main>;
}
