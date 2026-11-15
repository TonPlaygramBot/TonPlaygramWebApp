import {lazy,Suspense,useEffect,useRef,useState,type PointerEvent} from 'react';
import {ExploreConnection,type ExploreStatus} from './ExploreConnection';
import {ExploreRuntime} from './ExploreRuntime';
import {useExploreMedia} from './useExploreMedia';
import {ExploreSocialPanel,type SocialTab} from './ExploreSocialPanel';
import {ExploreCallDock} from './ExploreCallDock';
import {EXPLORE_LIMITS} from './socialCore.mjs';
import {PYRAMID_MALL,distanceToPyramid,isNearPyramid} from '../tirana-mall/mallLocation.mjs';
import type {ExploreSnapshot} from './types';
import './explore.css';
const Mall=lazy(()=>import('../tirana-mall/PyramidGamingMall').then(module=>({default:module.PyramidGamingMall})));
function RemoteAudio({stream}:{stream:MediaStream}){const ref=useRef<HTMLAudioElement>(null);const [blocked,setBlocked]=useState(false);useEffect(()=>{const audio=ref.current;if(!audio)return;audio.srcObject=stream;void audio.play().then(()=>setBlocked(false)).catch(()=>setBlocked(true));return()=>{audio.pause();audio.srcObject=null;};},[stream]);return <><audio ref={ref} autoPlay onPlaying={()=>setBlocked(false)}/>{blocked&&<button className="te-audio-unlock" onClick={()=>{document.querySelectorAll<HTMLAudioElement>('.te-game audio').forEach(audio=>{void audio.play().catch(()=>{});});}}>TAP TO HEAR CALL</button>}</>;}

export function ExploreGame({onExit,onCareerJobs}:{onExit:()=>void;onCareerJobs?:()=>void;sourceGame?:'racing'}){
  const root=useRef<HTMLDivElement>(null),connection=useRef<ExploreConnection|null>(null),runtime=useRef<ExploreRuntime|null>(null);
  const [sessionVersion,setSessionVersion]=useState(0),[status,setStatus]=useState<ExploreStatus>('idle');
  const [snapshot,setSnapshot]=useState<ExploreSnapshot|null>(null),[error,setError]=useState(''),[fps,setFps]=useState(0),[ready,setReady]=useState(false),[panel,setPanel]=useState(false),[paused,setPaused]=useState(false),[mall,setMall]=useState(false),[tab,setTab]=useState<SocialTab>('people');
  const request=(action:string,payload?:Record<string,unknown>)=>connection.current?.request(action,payload)||Promise.reject(Error('Connect first'));
  const media=useExploreMedia(snapshot,request);
  useEffect(()=>{
    let accountId='';try{accountId=localStorage.getItem('accountId')||'';}catch{}
    if(!accountId){setError('Sign in to your existing TonPlaygram account to meet other players.');return;}
    setSnapshot(null);setReady(false);setError('');setPaused(false);setPanel(false);setMall(false);
    let alive=true;const current=new ExploreConnection(accountId,value=>{if(alive){setSnapshot(value);runtime.current?.accept(value);}},message=>{if(alive)setError(message);},stage=>{if(alive){setStatus(stage);runtime.current?.setNetworkAvailable(stage==='connected');}});connection.current=current;
    let view:ExploreRuntime|undefined;try{if(root.current){view=new ExploreRuntime(root.current,current,message=>{if(alive)setError(message);},state=>{if(alive){setFps(state.fps);setReady(state.ready);setPaused(state.paused);}});runtime.current=view;}}catch(e){setError(e instanceof Error?e.message:'Unable to open 3D view');return()=>{alive=false;current.dispose();};}
    const room=new URLSearchParams(window.location.search).get('exploreRoom')||undefined;
    void current.join('rpm-current',room).catch(e=>{if(alive)setError(e.message);});
    return()=>{alive=false;void media.stop();current.dispose();view?.dispose();runtime.current=null;connection.current=null;};
  },[sessionVersion]);
  useEffect(()=>{if(!snapshot)return;const streams={...media.remote};if(media.local)streams[snapshot.playerId]=media.local;runtime.current?.media(streams);},[snapshot,media.local,media.remote]);
  const stopMove=()=>{if(runtime.current)runtime.current.input.touch={x:0,y:0,gas:0,fast:false,brake:false,fire:false};};
  const look=useRef<{id:number;x:number;y:number}|null>(null);
  function dragLook(event:PointerEvent<HTMLDivElement>){const previous=look.current;if(!previous||event.pointerId!==previous.id||!runtime.current||paused||panel||mall)return;runtime.current.yaw-=(event.clientX-previous.x)*.005;runtime.current.pitch=Math.max(.05,Math.min(.8,runtime.current.pitch+(event.clientY-previous.y)*.004));look.current={id:event.pointerId,x:event.clientX,y:event.clientY};}
  function move(event:PointerEvent<HTMLDivElement>){if(!runtime.current||!ready||status!=='connected'||panel||paused||mall)return;const box=event.currentTarget.getBoundingClientRect();let x=(event.clientX-box.left-box.width/2)/38,y=-(event.clientY-box.top-box.height/2)/38;const magnitude=Math.max(1,Math.hypot(x,y));x/=magnitude;y/=magnitude;runtime.current.input.touch.x=x;runtime.current.input.touch.y=y;runtime.current.input.touch.gas=y;}
  function openPanel(next:SocialTab){setTab(next);setPanel(true);runtime.current?.setOverlay(true);stopMove();}
  function closePanel(){setPanel(false);runtime.current?.setOverlay(mall);stopMove();}
  function toggleMall(open:boolean){if(open&&!isNearPyramid(snapshot?.state.players[snapshot.playerId]))return;setMall(open);runtime.current?.setOverlay(open||panel);runtime.current?.setRenderSuspended(open);stopMove();}
  function launch(path:string){void media.stop();window.location.assign(path);}
  const run=async(action:()=>Promise<unknown>)=>{setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Action failed');}};
  const player=snapshot?.state.players[snapshot.playerId],nearMall=isNearPyramid(player),mallDistance=distanceToPyramid(player);
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
      <div className="te-city-menu"><button onClick={()=>openPanel('live')}>{media.local?'CALL CONTROLS':'VOICE / VIDEO'}</button>{onCareerJobs&&<button onClick={()=>{void media.stop();onCareerJobs();}}>SOLO MISSIONS</button>}{pending>0&&<button onClick={()=>openPanel('invites')}>{pending} GAME INVITATION{pending>1?'S':''}</button>}</div>
      <div className="te-mall-waypoint"><b>TONPLAYGRAM GAMING MALL</b><span>{Number.isFinite(mallDistance)?`${Math.round(mallDistance)} m · Pyramid`:'Pyramid · city centre'}</span>{nearMall?<button disabled={!ready||status!=='connected'} onClick={()=>toggleMall(true)}>ENTER GAMING MALL</button>:<button disabled={!player||!ready} onClick={()=>{if(runtime.current&&player)runtime.current.yaw=Math.atan2(player.x-PYRAMID_MALL.x,player.z-PYRAMID_MALL.z);}}>{player?.carId&&mallDistance<75?'PARK & EXIT TO ENTER':'LOOK TOWARD MALL'}</button>}</div>
      <div className="te-stick" role="group" aria-label="Movement joystick" onPointerDown={event=>{void runtime.current?.audio.unlock().catch(()=>{});event.currentTarget.setPointerCapture(event.pointerId);move(event);}} onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))move(event);}} onPointerUp={stopMove} onPointerCancel={stopMove} onLostPointerCapture={stopMove}><span>↑</span></div>
      <div className="te-actions"><button disabled={!ready||status!=='connected'||paused} onClick={()=>void run(()=>request('interact',{interaction:'vehicle'}))}>{player?.carId?'EXIT CAR':'ENTER CAR'}</button><button onClick={()=>{const next=!paused;setPaused(next);runtime.current?.pause(next);stopMove();}}>{paused?'RESUME':'PAUSE'}</button></div>
      <p className="te-city-status">{player?.carId?`${Math.round(Math.abs(player.speed||0)*3.6)} km/h · Driving`:'Walk, meet players & discover the city'}</p>
    </>}
    {panel&&<ExploreSocialPanel snapshot={snapshot} request={request} media={media} tab={tab} onTab={setTab} onClose={closePanel} onLaunch={path=>void launch(path)}/>}
    {mall&&<Suspense fallback={<section className="te-panel"><h1>Opening the Pyramid…</h1><button onClick={()=>toggleMall(false)}>BACK TO CITY</button></section>}><Mall onClose={()=>toggleMall(false)} onLaunch={path=>void launch(path)}/></Suspense>}
    {mall&&!panel&&<div className="te-mall-social-tools"><button onClick={()=>openPanel('chat')}>CITY CHAT{pending?` · ${pending} INVITES`:''}</button><button onClick={()=>openPanel('live')}>{media.local?'LIVE CALL · CONTROLS':'VOICE / VIDEO'}</button></div>}
    {Object.entries(media.remote).map(([id,stream])=><RemoteAudio key={id} stream={stream}/>)}
  </main>;
}
