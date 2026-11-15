import {lazy,Suspense,useEffect,useRef,useState,type PointerEvent} from 'react';
import {ExploreConnection,type ExploreStatus} from './ExploreConnection';
import {ExploreRuntime} from './ExploreRuntime';
import {useExploreMedia} from './useExploreMedia';
import {ExploreSocialPanel,type SocialTab} from './ExploreSocialPanel';
import {ExploreCallDock} from './ExploreCallDock';
import {EXPLORE_LIMITS,loadExploreCharacter} from './socialCore.mjs';
import {VehicleRadio,type RadioSnapshot} from '../tiranastreets/radio/VehicleRadio';
import {RadioControls} from '../tiranastreets/radio/RadioControls';
import {PYRAMID_MALL,distanceToPyramid,isNearPyramid} from '../tirana-mall/mallLocation.mjs';
import type {ExploreSnapshot} from './types';
import './explore.css';
const Mall=lazy(()=>import('../tirana-mall/PyramidGamingMall').then(module=>({default:module.PyramidGamingMall})));
const optionalStorage=()=>{try{return window.localStorage;}catch{return undefined;}};
function RemoteAudio({stream}:{stream:MediaStream}){const ref=useRef<HTMLAudioElement>(null);const [blocked,setBlocked]=useState(false);useEffect(()=>{const audio=ref.current;if(!audio)return;audio.srcObject=stream;void audio.play().then(()=>setBlocked(false)).catch(()=>setBlocked(true));return()=>{audio.pause();audio.srcObject=null;};},[stream]);return <><audio ref={ref} autoPlay onPlaying={()=>setBlocked(false)}/>{blocked&&<button className="te-audio-unlock" onClick={()=>{document.querySelectorAll<HTMLAudioElement>('.te-game audio').forEach(audio=>{void audio.play().catch(()=>{});});}}>TAP TO HEAR CALL</button>}</>;}

export function ExploreGame({onExit,onCareerJobs}:{onExit:()=>void;onCareerJobs?:()=>void;sourceGame?:'racing'}){
  const root=useRef<HTMLDivElement>(null),connection=useRef<ExploreConnection|null>(null),runtime=useRef<ExploreRuntime|null>(null);
  const [sessionVersion,setSessionVersion]=useState(0),[status,setStatus]=useState<ExploreStatus>('idle');
  const [snapshot,setSnapshot]=useState<ExploreSnapshot|null>(null),[error,setError]=useState(''),[fps,setFps]=useState(0),[ready,setReady]=useState(false),[panel,setPanel]=useState(false),[paused,setPaused]=useState(false),[mall,setMall]=useState(false),[tab,setTab]=useState<SocialTab>('people');
  const request=(action:string,payload?:Record<string,unknown>)=>connection.current?.request(action,payload)||Promise.reject(Error('Connect first'));
  const media=useExploreMedia(snapshot,request);
  const radio=useRef<VehicleRadio|null>(null);
  const [radioOpen,setRadioOpen]=useState(false),[radioState,setRadioState]=useState<RadioSnapshot|null>(null);
  const hasCall=!!media.local||Object.keys(media.remote).length>0;
  useEffect(()=>{
    const current=new VehicleRadio(optionalStorage());radio.current=current;setRadioState(current.snapshot());
    const timer=setInterval(()=>setRadioState(current.snapshot()),250);
    const hidden=()=>{if(document.hidden)current.setContext(false);};
    document.addEventListener('visibilitychange',hidden);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',hidden);current.dispose();radio.current=null;};
  },[]);
  useEffect(()=>{radio.current?.setContext(ready&&status==='connected'&&!paused&&!mall&&!hasCall&&!document.hidden);},[ready,status,paused,mall,hasCall]);
  const radioAction=(action:string)=>{
    if(action==='toggle')radio.current?.toggle();else if(action==='next')radio.current?.next();else if(action==='previous')radio.current?.next(-1);else radio.current?.select(action);
    if(radio.current)setRadioState(radio.current.snapshot());
  };
  useEffect(()=>{
    let accountId='';try{accountId=localStorage.getItem('accountId')||'';}catch{}
    if(!accountId){setError('Sign in to your existing TonPlaygram account to meet other players.');return;}
    setSnapshot(null);setReady(false);setError('');setPaused(false);setPanel(false);setMall(false);
    let alive=true;const current=new ExploreConnection(accountId,value=>{if(alive){setSnapshot(value);runtime.current?.accept(value);}},message=>{if(alive)setError(message);},stage=>{if(alive){setStatus(stage);runtime.current?.setNetworkAvailable(stage==='connected');}});connection.current=current;
    let view:ExploreRuntime|undefined;try{if(root.current){view=new ExploreRuntime(root.current,current,message=>{if(alive)setError(message);},state=>{if(alive){setFps(state.fps);setReady(state.ready);setPaused(state.paused);}});runtime.current=view;}}catch(e){setError(e instanceof Error?e.message:'Unable to open 3D view');return()=>{alive=false;current.dispose();};}
    const room=new URLSearchParams(window.location.search).get('exploreRoom')||undefined;
    void current.join(loadExploreCharacter(optionalStorage()),room).catch(e=>{if(alive)setError(e.message);});
    return()=>{alive=false;void media.stop();current.dispose();view?.dispose();runtime.current=null;connection.current=null;};
  },[sessionVersion]);
  useEffect(()=>{if(!snapshot)return;const streams={...media.remote};if(media.local)streams[snapshot.playerId]=media.local;runtime.current?.media(streams);},[snapshot,media.local,media.remote]);
  const stopMove=()=>{if(runtime.current)Object.assign(runtime.current.input.touch,{x:0,y:0,gas:0});};
  const releaseAction=()=>{if(runtime.current)Object.assign(runtime.current.input.touch,{fast:false,brake:false});};
  const holdAction=(event:PointerEvent<HTMLButtonElement>,key:'fast'|'brake')=>{if(!runtime.current||!ready||paused||panel||mall||status!=='connected')return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);runtime.current.input.touch[key]=true;};
  const look=useRef<{id:number;x:number;y:number}|null>(null);
  function dragLook(event:PointerEvent<HTMLDivElement>){const previous=look.current;if(!previous||event.pointerId!==previous.id||!runtime.current||paused||panel||mall)return;runtime.current.yaw-=(event.clientX-previous.x)*.005;runtime.current.pitch=Math.max(.05,Math.min(.8,runtime.current.pitch+(event.clientY-previous.y)*.004));look.current={id:event.pointerId,x:event.clientX,y:event.clientY};}
  function move(event:PointerEvent<HTMLDivElement>){if(!runtime.current||!ready||status!=='connected'||panel||paused||mall)return;const box=event.currentTarget.getBoundingClientRect();let x=(event.clientX-box.left-box.width/2)/38,y=-(event.clientY-box.top-box.height/2)/38;const magnitude=Math.max(1,Math.hypot(x,y));x/=magnitude;y/=magnitude;runtime.current.input.touch.x=x;runtime.current.input.touch.y=y;runtime.current.input.touch.gas=y;}
  function openPanel(next:SocialTab){setTab(next);setPanel(true);runtime.current?.setOverlay(true);stopMove();}
  function closePanel(){setPanel(false);runtime.current?.setOverlay(mall);stopMove();}
  function toggleMall(open:boolean){if(open&&!isNearPyramid(snapshot?.state.players[snapshot.playerId]))return;setMall(open);runtime.current?.setOverlay(open||panel);runtime.current?.setRenderSuspended(open);stopMove();}
  function launch(path:string){void media.stop();window.location.assign(path);}
  const run=async(action:()=>Promise<unknown>)=>{setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Action failed');}};
  const player=snapshot?.state.players[snapshot.playerId],nearMall=isNearPyramid(player),mallDistance=distanceToPyramid(player);
  useEffect(()=>{runtime.current?.input.clear();},[player?.carId]);
  const pending=snapshot?.invitations?.filter(invitation=>invitation.to===snapshot.playerId&&invitation.status==='pending').length||0;
  return <main className="te-game te-city" aria-label="Tirana shared exploration">
    <div ref={root} className="te-canvas"/>
    <div className="te-look" aria-label="Drag to look" onPointerDown={event=>{if(panel||mall)return;void runtime.current?.audio.unlock().catch(()=>{});event.currentTarget.setPointerCapture(event.pointerId);look.current={id:event.pointerId,x:event.clientX,y:event.clientY};}} onPointerMove={dragLook} onPointerUp={()=>{look.current=null;}} onPointerCancel={()=>{look.current=null;}} onLostPointerCapture={()=>{look.current=null;}}/>
    <header className="te-header"><div><b>RACING ROYAL</b><small>TIRANA LIFE · {status==='connected'&&snapshot?`${snapshot.members.length}/${EXPLORE_LIMITS.players} people`:status.toUpperCase()} · {fps} FPS</small></div><button onClick={()=>panel?closePanel():openPanel('people')}>PEOPLE / CHAT{pending?` · ${pending}`:''}</button><button onClick={()=>{void media.stop();onExit();}}>GARAGE</button></header>
    {(error||media.error)&&<p className="te-error" role="alert">{error||media.error}{error&&<button onClick={()=>{void media.stop();setSessionVersion(value=>value+1);}}>RECONNECT</button>}</p>}
    {status==='reconnecting'&&<p className="te-loading" role="status">Connection interrupted. Rejoining the city…</p>}
    {!ready&&!error&&status!=='reconnecting'&&<p className="te-loading" role="status">Loading Tirana and your shared character…</p>}
    {!panel&&!mall&&<>
      <ExploreCallDock members={snapshot?.members||[]} playerId={snapshot?.playerId||''} local={media.local} remote={media.remote} onControls={()=>openPanel('live')}/>
      <div className="te-city-menu"><button onClick={()=>openPanel('live')}>{media.local?'CALL CONTROLS':'VOICE / VIDEO'}</button><button aria-pressed={radioOpen} onClick={()=>setRadioOpen(!radioOpen)}>{radioOpen?'HIDE RADIO':'LIVE RADIO'}</button>{onCareerJobs&&<button onClick={()=>{void media.stop();onCareerJobs();}}>SOLO MISSIONS</button>}{pending>0&&<button onClick={()=>openPanel('invites')}>{pending} GAME INVITATION{pending>1?'S':''}</button>}</div>
      <div className="te-mall-waypoint"><b>TONPLAYGRAM GAMING MALL</b><span>{Number.isFinite(mallDistance)?`${Math.round(mallDistance)} m · Pyramid`:'Pyramid · city centre'}</span>{nearMall?<button disabled={!ready||status!=='connected'} onClick={()=>toggleMall(true)}>ENTER GAMING MALL</button>:<button disabled={!player||!ready} onClick={()=>{if(runtime.current&&player)runtime.current.yaw=Math.atan2(player.x-PYRAMID_MALL.x,player.z-PYRAMID_MALL.z);}}>{player?.carId&&mallDistance<75?'PARK & EXIT TO ENTER':'LOOK TOWARD MALL'}</button>}</div>
      <div className="te-stick" role="group" aria-label="Movement joystick" onPointerDown={event=>{void runtime.current?.audio.unlock().catch(()=>{});event.currentTarget.setPointerCapture(event.pointerId);move(event);}} onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))move(event);}} onPointerUp={stopMove} onPointerCancel={stopMove} onLostPointerCapture={stopMove}><span>↑</span></div>
      {radioOpen&&radioState&&<><RadioControls radio={radioState} onAction={radioAction} onVolume={value=>{radio.current?.setVolume(value);if(radio.current)setRadioState(radio.current.snapshot());}}/>{hasCall&&<p className="te-radio-note">Radio pauses during your call.</p>}</>}
      <div className="te-actions"><button key={player?.carId?'brake':'run'} disabled={!ready||status!=='connected'||paused} onPointerDown={event=>holdAction(event,player?.carId?'brake':'fast')} onPointerUp={releaseAction} onPointerCancel={releaseAction} onLostPointerCapture={releaseAction}>{player?.carId?'BRAKE':'HOLD TO RUN'}</button><button disabled={!ready||status!=='connected'||paused} onClick={()=>void run(()=>request('interact',{interaction:'vehicle'}))}>{player?.carId?'EXIT CAR':'ENTER CAR'}</button><button onClick={()=>{const next=!paused;setPaused(next);runtime.current?.pause(next);stopMove();}}>{paused?'RESUME':'PAUSE'}</button></div>
      <p className="te-city-status">{player?.carId?`${Math.round(Math.abs(player.speed||0)*3.6)} km/h · Driving`:'Move to walk · hold RUN to sprint · PEOPLE / CHAT to meet others'}</p>
    </>}
    {panel&&<ExploreSocialPanel snapshot={snapshot} request={request} media={media} tab={tab} onTab={setTab} onClose={closePanel} onLaunch={path=>void launch(path)}/>}
    {mall&&<Suspense fallback={<section className="te-panel"><h1>Opening the Pyramid…</h1><button onClick={()=>toggleMall(false)}>BACK TO CITY</button></section>}><Mall onClose={()=>toggleMall(false)} onLaunch={path=>void launch(path)}/></Suspense>}
    {mall&&!panel&&<div className="te-mall-social-tools"><button onClick={()=>openPanel('chat')}>CITY CHAT{pending?` · ${pending} INVITES`:''}</button><button onClick={()=>openPanel('live')}>{media.local?'LIVE CALL · CONTROLS':'VOICE / VIDEO'}</button></div>}
    {Object.entries(media.remote).map(([id,stream])=><RemoteAudio key={id} stream={stream}/>)}
  </main>;
}
