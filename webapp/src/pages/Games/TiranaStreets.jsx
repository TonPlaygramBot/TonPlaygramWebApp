import React, {useEffect,useRef,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import '../../games/tirana-standalone/city-roam.css';
import {StandaloneCarRadio} from '../../games/tirana-standalone/radio/StandaloneCarRadio.jsx';
import {TiranaLoading} from '../../games/tirana-standalone/nov11/TiranaLoading';
import {FrameRateControl} from '../../games/tirana-standalone/nov11/FrameRateControl';
import {MovementStick} from '../../games/tirana-standalone/MovementStick';
import {DistrictMap} from '../../games/tirana-standalone/DistrictMap.jsx';
import '../../games/tirana-street-detail/lobby.css';
import '../../games/tirana-standalone/civilian-career.css';
import {localCareerMenu} from '../../games/tirana-standalone/civilianCareer.mjs';

const root='/games/tiranastreets';
const credits=<div className="tsc-credits">
  <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
  <a href="/assets/tirana-city-game/ATTRIBUTION.md" target="_blank" rel="noreferrer">Burimet dhe licencat</a>
</div>;

export default function TiranaStreets(){
  const {pathname,search}=useLocation();
  const careerMode=new URLSearchParams(search).get('mode')==='career';
  const career=localCareerMenu();
  return pathname.replace(/\/$/,'').endsWith('/lobby')?<main className="tsc-lobby">
    <div className="tsc-lobby-content"><Link to="/games">‹ Lojërat</Link>
      <p>TIRANA STREETS · 3D</p><h1>Tirana Streets</h1>
      <p>Një qytet. Historia jote. Kthehu në hartën origjinale të Tiranës si Turi, në këmbë ose me makinë.</p>
      <Link className="tsc-launch" to={root}>Eksploro Tiranën</Link>
      <small>Lojë lokale. Nuk kërkon llogari apo pagesë.</small>
      <section className="tsl-card tsl-featured tsc-career-card" aria-label="Karriera qytetare">
        <span className="tsl-tag">HISTORI · NË KËMBË · LOKALE</span>
        <h2>Karriera qytetare</h2>
        <p>Pesë kapituj të historisë origjinale, si Turi. Përparimi ruhet vetëm në këtë pajisje.</p>
        <Link className="tsl-launch" to={root+'?mode=career'}>{career.active?'Vazhdo karrierën':'Hap karrierën'}</Link>
        <details>
          <summary>Kapitujt origjinalë</summary>
          <ol>{career.entries.map(item=><li key={item.id}>{item.title}<small>
            {{completed:'Përfunduar',active:'Në vazhdim',next:'I luajtshëm',locked:'Hapet pas kapitullit paraardhës',unavailable:'Nuk është hapur në këtë version'}[item.status]}</small></li>)}</ol>
        </details>
      </section>
      {credits}
    </div>
  </main>:<Roam careerMode={careerMode}/>;
}

function CareerHud({career,onStart,onInteract}){
  return <section className="tsc-career-hud" aria-label="Detyra e karrierës">
    {career.unavailable?<p>Kapitulli i ruajtur nuk është ende i hapur. Përparimi yt nuk ndryshon.</p>
      :career.failed?<><strong>Koha për dorëzim mbaroi.</strong><p>Vazhdo nga pika e fundit e ruajtur.</p><button type="button" onClick={onStart}>Provo përsëri</button></>
      :career.task?<><strong>Detyra {career.position}/{career.steps}</strong><p>{career.task.text}</p>
        {career.task.distance!=null&&<small className="tsc-career-bearing"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="M12 3 20 20 12 15 4 20Z" fill="currentColor" transform={`rotate(${career.task.bearing*180/Math.PI} 12 12)`}/></svg>{career.task.name} · {career.task.distance} m</small>}
        {career.remaining!=null&&<small aria-label="Koha e mbetur">Mbeten {Math.floor(career.remaining/60)}:{String(career.remaining%60).padStart(2,'0')}</small>}
        <button type="button" disabled={!career.task.canInteract} onClick={onInteract}>Ndërvepro</button></>
      :<>{career.completed>0&&<strong>{career.next?'Kapitulli u përfundua.':'Pesë kapitujt e hapur u përfunduan.'}</strong>}
        {career.next&&<button type="button" onClick={onStart}>{career.completed?'Fillo kapitullin tjetër':'Fillo kapitullin'}</button>}</>}
    {!career.storageOK&&<small role="status">Përparimi nuk mund të ruhet në këtë pajisje.</small>}
  </section>;
}

function Roam({careerMode=false}){
  const navigate=useNavigate();
  const [frameRate,setFrameRate]=useState(60);
  const surface=useRef(null),client=useRef(null),pan=useRef(null),mapButton=useRef(null),restoreMapFocus=useRef(false);
  const [state,setState]=useState({ready:false,paused:false});
  const [attempt,retry]=useState(0),[quality,setQuality]=useState('auto'),[mapOpen,setMapOpen]=useState(false);
  useEffect(()=>{
    setState({ready:false,paused:false});setQuality('auto');setFrameRate(60);setMapOpen(false);
    let alive=true;
    const update=next=>{if(alive)setState(prev=>({...prev,...next}));};
    import('../../games/tirana-standalone/CityRoamView.js').then(({CityRoamView})=>{
      if(alive&&surface.current)client.current=new CityRoamView(surface.current,update,{careerMode});
    }).catch(()=>update({error:'Pamja 3D nuk u hap. Kontrollo mbështetjen për WebGL dhe provo përsëri.'}));
    return()=>{alive=false;client.current?.dispose();client.current=null;pan.current=null;};
  },[attempt,careerMode]);
  const drive=state.state==='drive', active=state.ready&&!state.paused&&!state.error;
  useEffect(()=>{
    if(active)return;
    pan.current=null;
    if(client.current)Object.assign(client.current.touch,{x:0,y:0,brake:false});
  },[active]);
  useEffect(()=>{
    if(active&&!mapOpen&&restoreMapFocus.current){restoreMapFocus.current=false;mapButton.current?.focus();}
  },[active,mapOpen]);
  const closeMap=()=>{restoreMapFocus.current=true;setMapOpen(false);client.current?.pause(false);};
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
      <div className="tsc-title"><span>QYTETI I TIRANËS</span><h1>Tirana Streets</h1></div>
      <div className="tsc-top-actions"><Link to={root+'/lobby'}>‹ Menuja</Link><button type="button" disabled={!state.ready||!!state.error} onClick={()=>client.current?.pause(!state.paused)}>{state.paused?'Vazhdo':'Pauzë'}</button></div>
    </header>
    {!state.ready&&!state.error&&<div className="tsc-nov11-loading"><TiranaLoading onBack={()=>navigate(root+'/lobby')}/></div>}
    {state.error&&<div className="tsc-status" role="alert"><p>{state.error}</p><button type="button" onClick={()=>retry(v=>v+1)}>Rifillo</button></div>}
    {state.paused&&state.ready&&!state.error&&!mapOpen&&<div className="tsc-status">
      <p>Loja është në pauzë.</p>
      <label>Cilësia <select value={quality} onChange={e=>{setQuality(e.target.value);client.current?.setQuality(e.target.value);}}>
        <option value="auto">Automatike</option><option value="battery">Kursim baterie</option>
        <option value="balanced">E balancuar</option><option value="high">E lartë</option>
      </select></label>
      <FrameRateControl value={frameRate} onChange={value=>{setFrameRate(value);client.current?.setFrameRate?.(value);}}/>
      <button type="button" onClick={()=>client.current?.pause(false)}>Vazhdo</button>
    </div>}
    {mapOpen&&state.map&&!state.error&&<DistrictMap key={state.map.viewBox} map={state.map} player={state.player} destination={state.destination} careerMarker={state.career?.task?.marker} onClose={closeMap} onSelect={id=>{client.current?.setDestination(id);closeMap();}}/>}
    <StandaloneCarRadio active={active && drive && !state.ridingBike && !mapOpen}/>
    {active&&<>
      <div className="tsc-location">
        {state.landmark?.name&&<p>{state.landmark.name} <span>{state.landmark.distance} m</span></p>}
        <small>{drive?(state.ridingBike?'Biçikletë · ':'')+state.speed+' km/h':'Në këmbë'}{state.fps>0?' · '+state.fps+' FPS':''}</small>
      </div>
      <div className="tsc-tools">
        <button type="button" ref={mapButton} disabled={!state.map} onClick={()=>{client.current?.pause(true);setMapOpen(true);}}>Harta</button>
        <button type="button" aria-label={"Ndrysho kamerën: "+(state.cameraLabel||'Sytë')} onClick={()=>client.current?.cycleCamera?.()}>Kamera · {state.cameraLabel||'Sytë'}</button>
      </div>
      {careerMode&&state.career&&<CareerHud career={state.career} onStart={()=>client.current?.startCareer()} onInteract={()=>client.current?.interactCareer()}/>}
      {!state.career?.task&&state.destination&&<div className="tsc-destination"><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path d="M12 3 20 20 12 15 4 20Z" fill="#ffd097" transform={`rotate(${state.destination.bearing*180/Math.PI} 12 12)`}/></svg>
        <span>{state.destination.name} · {state.destination.badge||state.destination.distance+' m'}</span>
      </div>}
      {state.avatarLoading&&<p className="tsc-note" role="status">Po ngarkohet Turi. Mund të vazhdosh të ecësh.</p>}
      {!state.avatarLoading&&state.detail&&<p className="tsc-note" role="status">{state.detail}</p>}
      <div className="tsc-controls">
        <MovementStick label="Leva e lëvizjes" className="tsc-pad" disabled={!active} deadzone={.12}
          claim={()=>!!client.current&&active} release={()=>{}}
          move={(x,y)=>{if(client.current)Object.assign(client.current.touch,{x,y});}}/>
        <p className="tsc-help">{drive?'WASD / shigjetat · Space për frenim':'WASD / shigjetat · Q/R ose tërhiq pamjen për t’u kthyer'}</p>
        <div className="tsc-drive">
          {!state.ridingBike&&<button type="button" disabled={!state.assetReady||(!drive&&!state.near)} onClick={()=>client.current?.vehicle()}>{drive?'Dil':state.assetReady?(state.near?'Hyr në makinë':'Makina · '+state.carDistance+' m'):'Makina po ngarkohet'}</button>}
          {(state.ridingBike||(!drive&&state.bikeNear))&&<button type="button" onClick={()=>client.current?.bike?.()}>{state.ridingBike?'Zbrit':'Biçikletë'}</button>}
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
