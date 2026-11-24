import React, {useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import '../../games/tirana-standalone/city-roam.css';

const root='/games/tiranastreets';
const credits=<div className="tsc-credits">
  <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
  <a href="/assets/tirana-city-game/ATTRIBUTION.md" target="_blank" rel="noreferrer">Burimet dhe licencat</a>
</div>;

export default function TiranaStreets(){
  const {pathname}=useLocation();
  return pathname.replace(/\/$/,'').endsWith('/lobby')?<main className="tsc-lobby">
    <div className="tsc-lobby-content"><Link to="/games">‹ Lojërat</Link>
      <p>QENDRA E TIRANËS · 3D</p><h1>Tirana Streets</h1>
      <p>Shëtit nga Sheshi Skënderbej te Piramida, në këmbë ose me makinë.</p>
      <Link className="tsc-launch" to={root}>Eksploro Tiranën</Link>
      <small>Lojë lokale. Nuk kërkon llogari apo pagesë.</small>
      {credits}
    </div>
  </main>:<Roam/>;
}

function DistrictMap({map,player,destination,onSelect,onClose}){
  const keys=e=>{
    if(e.key==='Escape'){e.preventDefault();onClose();return;}
    if(e.key!=='Tab')return;
    const items=[...e.currentTarget.querySelectorAll('button:not([disabled])')];
    const edge=e.shiftKey?items[0]:items.at(-1);
    if(document.activeElement===edge){e.preventDefault();(e.shiftKey?items.at(-1):items[0])?.focus();}
  };
  return <section className="tsc-map" role="dialog" aria-modal="true" aria-label="Harta e qytetit" onKeyDown={keys}>
    <header><div><small>TIRANA STREETS</small><h2>Harta e qytetit</h2></div><button type="button" autoFocus onClick={onClose}>Mbylle</button></header>
    <svg viewBox={map.viewBox} aria-label="Rrugët, parqet dhe vendndodhja aktuale" role="img">
      <rect x={map.district.x} y={map.district.z} width={map.district.width} height={map.district.height} fill="#172d35"/>
      <path d={map.park} fill="#4c674f"/>
      <path d={map.water} fill="#3d7284"/>
      <path d={map.canal} stroke="#3d7284" strokeWidth="9" fill="none"/>
      <path d={map.road} stroke="#99a59f" strokeWidth="2" fill="none"/>
      <path d={map.foot} stroke="#778d7b" strokeWidth="1.35" fill="none"/>
      {map.points.map(point=><circle key={point.id} cx={point.x} cy={point.z} r="7" fill="#e4be7a"/>)}
      {player&&<g transform={`translate(${player.x} ${player.z}) rotate(${-player.yaw*180/Math.PI})`}>
        <circle r="11" fill="#156976" stroke="#fbeed8" strokeWidth="2"/>
        <path d="M-4 -2 L0 9 L4 -2 Z" fill="#fff"/>
      </g>}
    </svg>
    <p>Pikat e orientimit</p>
    {map.points.map(point=><button type="button" key={point.id} aria-pressed={destination?.name===point.label} onClick={()=>onSelect(point.id)}>{point.label}</button>)}
    <small>Harta tregon drejtimin, jo udhëzime rrugore.</small>
  </section>;
}

function Roam(){
  const surface=useRef(null),client=useRef(null),pan=useRef(null),pad=useRef(null),mapButton=useRef(null),restoreMapFocus=useRef(false);
  const [state,setState]=useState({ready:false,paused:false});
  const [attempt,retry]=useState(0),[quality,setQuality]=useState('auto'),[mapOpen,setMapOpen]=useState(false);
  useEffect(()=>{
    setState({ready:false,paused:false});setQuality('auto');setMapOpen(false);
    let alive=true;
    const update=next=>{if(alive)setState(prev=>({...prev,...next}));};
    import('../../games/tirana-standalone/CityRoamView.js').then(({CityRoamView})=>{
      if(alive&&surface.current)client.current=new CityRoamView(surface.current,update);
    }).catch(()=>update({error:'Pamja 3D nuk u hap. Kontrollo mbështetjen për WebGL dhe provo përsëri.'}));
    return()=>{alive=false;client.current?.dispose();client.current=null;pad.current=null;pan.current=null;};
  },[attempt]);
  const drive=state.state==='drive', active=state.ready&&!state.paused&&!state.error;
  useEffect(()=>{
    if(active)return;
    pad.current=null;pan.current=null;
    if(client.current)Object.assign(client.current.touch,{x:0,y:0,brake:false});
  },[active]);
  useEffect(()=>{
    if(active&&!mapOpen&&restoreMapFocus.current){restoreMapFocus.current=false;mapButton.current?.focus();}
  },[active,mapOpen]);
  const closeMap=()=>{restoreMapFocus.current=true;setMapOpen(false);client.current?.pause(false);};
  const stopPad=e=>{
    if(pad.current!==e.pointerId)return;
    pad.current=null;if(client.current)Object.assign(client.current.touch,{x:0,y:0});
  };
  const dragPad=e=>{
    if(pad.current!==e.pointerId||!client.current||!active)return;
    const r=e.currentTarget.getBoundingClientRect(),span=r.width*.34;
    let x=(e.clientX-r.x-r.width/2)/span,y=(r.y+r.height/2-e.clientY)/span;
    const length=Math.hypot(x,y);
    if(length<.12){x=0;y=0;}
    else if(length>1){x/=length;y/=length;}
    Object.assign(client.current.touch,{x,y});
  };
  const stopPan=e=>{if(pan.current?.id===e.pointerId)pan.current=null;};
  const stopBrake=()=>{if(client.current)client.current.touch.brake=false;};
  return <main className="tsc-play" aria-label="Tirana Streets, eksplorim në 3D">
    <div className="tsc-view" ref={surface} aria-hidden="true"/>
    <div className="tsc-pan" aria-hidden="true" onPointerDown={e=>{
      if(!active||drive||pan.current)return;
      pan.current={id:e.pointerId,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);
    }} onPointerMove={e=>{
      if(pan.current?.id!==e.pointerId)return;
      client.current?.look(e.clientX-pan.current.x,e.clientY-pan.current.y);
      pan.current={id:e.pointerId,x:e.clientX,y:e.clientY};
    }} onPointerUp={stopPan} onPointerCancel={stopPan} onLostPointerCapture={stopPan}/>
    <header className="tsc-header">
      <div className="tsc-title"><span>QENDRA E QYTETIT</span><h1>Tirana Streets</h1></div>
      <div className="tsc-top-actions"><Link to={root+'/lobby'}>‹ Menuja</Link><button type="button" disabled={!state.ready||!!state.error} onClick={()=>client.current?.pause(!state.paused)}>{state.paused?'Vazhdo':'Pauzë'}</button></div>
    </header>
    {!state.ready&&!state.error&&<p className="tsc-status" role="status">Po hapet harta 3D…</p>}
    {state.error&&<div className="tsc-status" role="alert"><p>{state.error}</p><button type="button" onClick={()=>retry(v=>v+1)}>Rifillo</button></div>}
    {state.paused&&state.ready&&!state.error&&!mapOpen&&<div className="tsc-status">
      <p>Loja është në pauzë.</p>
      <label>Cilësia <select value={quality} onChange={e=>{setQuality(e.target.value);client.current?.setQuality(e.target.value);}}>
        <option value="auto">Automatike</option><option value="battery">Kursim baterie</option>
        <option value="balanced">E balancuar</option><option value="high">E lartë</option>
      </select></label>
      <button type="button" onClick={()=>client.current?.pause(false)}>Vazhdo</button>
    </div>}
    {mapOpen&&state.map&&!state.error&&<DistrictMap map={state.map} player={state.player} destination={state.destination} onClose={closeMap} onSelect={id=>{client.current?.setDestination(id);closeMap();}}/>}
    {active&&<>
      <div className="tsc-location">
        {state.landmark?.name&&<p>{state.landmark.name} <span>{state.landmark.distance} m</span></p>}
        <small>{drive?state.speed+' km/h':'Në këmbë'}{state.fps>0?' · '+state.fps+' FPS':''}</small>
      </div>
      <div className="tsc-tools">
        <button type="button" ref={mapButton} disabled={!state.map} onClick={()=>{client.current?.pause(true);setMapOpen(true);}}>Harta</button>
        <button type="button" aria-label={"Ndrysho kamerën: "+(state.cameraLabel||'Sytë')} onClick={()=>client.current?.cycleCamera?.()}>Kamera · {state.cameraLabel||'Sytë'}</button>
      </div>
      {state.destination&&<div className="tsc-destination"><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path d="M12 3 20 20 12 15 4 20Z" fill="#ffd097" transform={`rotate(${state.destination.bearing*180/Math.PI} 12 12)`}/></svg>
        <span>{state.destination.name} · {state.destination.badge||state.destination.distance+' m'}</span>
      </div>}
      {state.avatarLoading&&<p className="tsc-note" role="status">Po ngarkohet Turi. Mund të vazhdosh të ecësh.</p>}
      {!state.avatarLoading&&state.detail&&<p className="tsc-note" role="status">{state.detail}</p>}
      <div className="tsc-controls">
        <div className="tsc-pad" role="group" aria-label="Leva e lëvizjes"
          onPointerDown={e=>{if(pad.current!==null)return;pad.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);dragPad(e);}}
          onPointerMove={dragPad} onPointerUp={stopPad} onPointerCancel={stopPad} onLostPointerCapture={stopPad}><i aria-hidden="true">✥</i></div>
        <p className="tsc-help">{drive?'WASD / shigjetat · Space për frenim':'WASD / shigjetat · Q/R ose tërhiq pamjen për t’u kthyer'}</p>
        <div className="tsc-drive">
          <button type="button" disabled={!state.assetReady||(!drive&&!state.near)} onClick={()=>client.current?.vehicle()}>{drive?'Dil':state.assetReady?'Hyr në makinë':'Makina po ngarkohet'}</button>
          {!drive&&<button type="button" onClick={()=>client.current?.jump?.()}>Kërce</button>}
          <button type="button" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);if(client.current)client.current.touch.brake=true;}}
            onPointerUp={stopBrake} onPointerCancel={stopBrake} onLostPointerCapture={stopBrake}
            onKeyDown={e=>{if((e.code==='Space'||e.code==='Enter')&&client.current)client.current.touch.brake=true;}} onKeyUp={stopBrake} onBlur={stopBrake}>{drive?'Freno':'Vrapo'}</button>
        </div>
      </div>
    </>}
    {credits}
  </main>;
}
