import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Vector2} from 'three';
import {Game,Stats} from './engine';
import {Icon} from './icons';
import {missions,pad,saved,save} from './data';
import {Sound} from './audio';
type Panel='game'|'pause'|'missions'|'end';
const initial:Stats={ammo:7,hp:100,hits:0,shots:0,total:3,score:0,phase:'hunt',scope:false,mode:'third',reloading:false};
function App(){
 const [index,si]=useState(0),[run,replay]=useState(0),[panel,sp]=useState<Panel>('game'),[st,ss]=useState(initial);
 const [progress,pr]=useState(0),[text,lt]=useState('Po ngarkohet ambienti 3D…'),[ready,rd]=useState(false),[error,err]=useState(''),[note,nf]=useState('');
 const [sound,sso]=useState(()=>saved('sound',true)),[bests,sb]=useState<Record<string,number>>(()=>saved('records',{})),[help,sh]=useState(true);
 const scene=useRef<HTMLDivElement>(null),markers=useRef<HTMLDivElement>(null),compass=useRef<HTMLDivElement>(null),range=useRef<HTMLSpanElement>(null),knob=useRef<HTMLSpanElement>(null),modal=useRef<HTMLDivElement>(null);
 const eng=useRef<Game|null>(null),audio=useRef<Sound|null>(null),panelRef=useRef<Panel>('game'),backPanel=useRef<Panel>('game'),msgId=useRef<ReturnType<typeof setTimeout>>();
 const drag=useRef<{id:number;x:number;y:number;travel:number}|null>(null),joyId=useRef<number|null>(null),events=useRef({key:(e:KeyboardEvent,down:boolean)=>{},visibility:()=>{}});
 const mission=missions[index];
 function resetStick(){joyId.current=null;eng.current?.stick(0,0);if(knob.current)knob.current.style.transform='translate(-50%,-50%)'}
 function setPanel(p:Panel){panelRef.current=p;sp(p);if(eng.current){eng.current.paused=p!=='game';eng.current.clear()}drag.current=null;resetStick()}
 function pause(){if(!ready||panelRef.current!=='game')return;setPanel('pause')}
 function back(){setPanel(panelRef.current==='missions'?backPanel.current:'game')}
 function missionsPanel(){backPanel.current=panelRef.current;setPanel('missions')}
 function start(i:number){setPanel('game');if(eng.current)eng.current.paused=true;si(i);replay(n=>n+1);rd(false);ss(initial);sh(true);nf('')}
 function notice(message:string){nf(message);clearTimeout(msgId.current);msgId.current=setTimeout(()=>nf(''),1600)}
 function toggleSound(){const next=!sound;sso(next);save('sound',next);if(audio.current){audio.current.enabled=next;if(next)audio.current.play('zoom')}}
 function playable(){return ready&&!error&&panelRef.current==='game'}
 function act(fn:(g:Game)=>void){if(!playable()||!eng.current)return;audio.current?.wake();sh(false);fn(eng.current)}
 useEffect(()=>{audio.current=new Sound();audio.current.enabled=sound;const down=(e:KeyboardEvent)=>events.current.key(e,true),up=(e:KeyboardEvent)=>events.current.key(e,false);
   const vis=()=>{if(document.hidden)events.current.visibility()},blur=()=>{eng.current?.clear();resetStick();drag.current=null};
   window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',vis);
   return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',vis);audio.current?.close();clearTimeout(msgId.current)}},[]);
 useEffect(()=>{rd(false);err('');pr(0);lt('Po ngarkohet ambienti 3D…');let current=true,g:Game|undefined;
   try{g=new Game(scene.current!,markers.current!,compass.current!,range.current!,mission,{
     stats(v){if(!current)return;ss(v);if(v.phase==='won'||v.phase==='lost'){if(v.phase==='won'){const b=saved<Record<string,number>>('records',{});b[mission.id]=Math.max(b[mission.id]||0,v.score);save('records',b);sb(b)}setPanel('end')}},
     loading(t,n){if(current){lt(t);pr(n)}},ready(){if(current)rd(true)},error(e){if(current)err(e)},notice,sound:(type)=>audio.current?.play(type)
   });eng.current=g;g.paused=panelRef.current!=='game'}catch{err('WebGL nuk u hap në këtë shfletues. Provo përsëri ose hape lojën në Chrome apo Safari.')}
   return()=>{current=false;g?.destroy();eng.current=null;clearTimeout(msgId.current)}},[index,run]);
 useEffect(()=>{if(panel!=='game')modal.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true})},[panel]);
 events.current.visibility=()=>{if(ready&&panelRef.current==='game')pause()};
 events.current.key=(e,down)=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.length===1?e.key.toLowerCase():e.key;
   if(k==='Escape'&&down&&!e.repeat){if(panelRef.current==='game')pause();else if(panelRef.current!=='end')back();return}if(!playable())return;
   if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Shift'].includes(k)){e.preventDefault();eng.current?.key(k,down);if(down)sh(false);return}
   if(!down||e.repeat)return;if(k===' '){if((e.target as HTMLElement).closest('button'))return;e.preventDefault();act(g=>g.shoot())}
   else if(k==='r')act(g=>g.reload());else if(k==='z')act(g=>g.scope());else if(k==='v')act(g=>g.toggleCamera());else if(k==='j')act(g=>g.jump())
 };
 const touchLook=(e:React.PointerEvent<HTMLDivElement>)=>{if(!playable()||drag.current||e.button!==0)return;audio.current?.wake();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,travel:0}};
 const aimMove=(e:React.PointerEvent<HTMLDivElement>)=>{const p=drag.current;if(!p||p.id!==e.pointerId)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.travel+=Math.hypot(dx,dy);if(p.travel>3){eng.current?.drag(dx,dy);sh(false)}p.x=e.clientX;p.y=e.clientY};
 const aimUp=(e:React.PointerEvent<HTMLDivElement>)=>{const p=drag.current;if(!p||p.id!==e.pointerId)return;drag.current=null;if(p.travel>6)return;const b=e.currentTarget.getBoundingClientRect();act(g=>g.shoot(new Vector2((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2)))};
 const joyMove=(e:React.PointerEvent<HTMLDivElement>)=>{if(joyId.current!==e.pointerId)return;const b=e.currentTarget.getBoundingClientRect(),r=b.width*.36;let x=(e.clientX-b.left-b.width/2)/r,y=(e.clientY-b.top-b.height/2)/r;const l=Math.max(1,Math.hypot(x,y));x/=l;y/=l;eng.current?.stick(x,y);if(knob.current)knob.current.style.transform='translate(calc(-50% + '+(x*r)+'px),calc(-50% + '+(y*r)+'px))'};
 const joyDown=(e:React.PointerEvent<HTMLDivElement>)=>{if(!playable()||joyId.current!==null)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);joyId.current=e.pointerId;audio.current?.wake();sh(false);joyMove(e)};
 const statsName=st.phase==='extract'?'Arrij te dalja':'Mposht patrullën';
 return <main className={'game '+(st.scope?'scoped ':'')+(st.mode==='first'?'first ':'')+(ready?'ready ':'')+(panel==='game'?'':'covered')} aria-label="Optika, lojë 3D">
   <div className="world" ref={scene}/><div className="edges"/><div className="scope-glass"/><div className="markers" ref={markers}/><div className="cross"><i/><b/></div>
   <div className="look" role="application" tabIndex={panel==='game'?0:-1} aria-label="Bota e lojës. Rrëshqit për të kthyer kamerën. W A S D për të ecur." onPointerDown={touchLook} onPointerMove={aimMove} onPointerUp={aimUp} onLostPointerCapture={e=>{if(drag.current?.id===e.pointerId)drag.current=null}}/>
   <div className="hud" ref={n=>{if(n)n.inert=panel!=='game'||!ready}}>
   <header className="bar"><div className="brand"><Icon name="brand" size={30}/><strong>OPTIKA</strong></div>
   <div className="top-right"><span className="score" aria-label={st.score+' pikë'}><Icon name="coin" size={17}/>{st.score}</span>
   <button className="headbtn" onClick={missionsPanel} aria-label="Zgjidh misionin" title="Misionet"><Icon name="stages" size={19}/><span>Misionet</span></button><button className="headbtn camera" onClick={()=>act(g=>g.toggleCamera())} aria-label={st.mode==='third'?'Shiko nga sytë e lojtarit':'Shiko pas lojtarit'} title="Ndërro kamerën (V)"><Icon name="views" size={17}/><span>{st.mode==='third'?'3P':'1P'}</span></button><button className="headbtn pause" onClick={pause} aria-label="Pauzë"><Icon name="pause" size={16}/></button></div></header>
   <div className="compass" aria-hidden="true"><div ref={compass} className="compass-strip">{Array.from({length:3},(_,i)=><React.Fragment key={i}>{['V','VL','L','JL','J','JP','P','VP'].map(x=><span key={x}>{x}</span>)}</React.Fragment>)}</div><b/></div>
   <section className="mission"><div className="kicker"><i/> MISIONI {pad(index+1)} <em>/ 04</em></div><h1>{mission.name}</h1><div className="objective"><i className={st.phase==='extract'?'safe':''}/><span>{statsName}</span><b>{st.phase==='extract'?'':st.hits+' / '+st.total}</b></div></section>
   <div className="distance"><Icon name="target" size={12}/><span ref={range}/></div>
   <div className="notice" role="status">{note&&<span key={note}>{note}</span>}</div>
   <div className="foot-hud">
     <div className="movement"><div className="joystick" role="group" aria-label="Levë lëvizjeje" onPointerDown={joyDown} onPointerMove={joyMove} onPointerUp={resetStick} onPointerCancel={resetStick} onLostPointerCapture={e=>{if(joyId.current===e.pointerId)resetStick()}}><i/><b/><span ref={knob}/></div><small>LËVIZ</small></div>
     <div className="actions"><button className="mini jump" onClick={()=>act(g=>g.jump())} aria-label="Kërce" title="Kërce (J)"><Icon name="jump" size={20}/></button><div className="pair"><button className={'action zoom '+(st.scope?'on':'')} onClick={()=>act(g=>g.scope())} aria-label={st.scope?'Hiq zmadhimin':'Zmadho'} aria-pressed={st.scope}><span><Icon name="target" size={24}/></span><small>{st.scope?'1× PAMJE':'ZMADHO'}</small></button><button className="action fire" onClick={()=>act(g=>g.shoot())} disabled={st.reloading||st.phase==='extract'} aria-label={st.ammo?'Qëllo':'Rimbush municionin'}><span><Icon name={st.ammo?'shoot':'reload'} size={32}/></span><small>{st.ammo?'QËLLO':'RIMBUSH'}</small></button></div></div>
   </div>
   <footer><div className="health" aria-label={'Energji '+st.hp}><Icon name="shield" size={16}/><b>{st.hp}</b><div><i style={{width:st.hp+'%'}}/></div></div><p className="hint">{help?<><span className="phone">Rrëshqit për të parë rreth e rrotull</span><span className="desk">W A S D për të ecur · Tërhiq për të parë</span></>:mission.info}</p><button className="ammo" disabled={st.reloading||st.ammo===7||st.phase==='extract'} aria-label="Rimbush" title="Rimbush (R)" onClick={()=>act(g=>g.reload())}><Icon name="reload" size={15}/><b>{st.reloading?'…':pad(st.ammo)}</b><small>/ ∞</small></button></footer>
   </div>
   {(!ready||error)&&<div className="loader"><div><div className="load-brand"><Icon name="brand" size={34}/><b>OPTIKA</b></div><div className="kicker">MISIONI {pad(index+1)} / 04</div><h2>{mission.name}</h2><p>{error||text}</p>{error?<button className="primary" onClick={()=>start(index)}>Provo sërish</button>:<div className="load-line"><i style={{width:Math.max(progress,3)+'%'}}/></div>}</div></div>}
   {panel!=='game'&&<div className="curtain"><section role="dialog" aria-modal="true" aria-labelledby="title" className={'dialog '+(panel==='missions'?'library':'')} ref={modal} onKeyDown={e=>{if(e.key!=='Tab')return;const b=Array.from(e.currentTarget.querySelectorAll('button'));if(!b.length)return;if(e.shiftKey&&document.activeElement===b[0]){e.preventDefault();b.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===b.at(-1)){e.preventDefault();b[0].focus()}}}>
     <div className="dialog-head"><div className="kicker"><i/> {panel==='missions'?'FUSHATA':'MISIONI '+pad(index+1)+' / 04'}</div>{panel!=='end'&&<button className="headbtn" aria-label="Mbyll" onClick={back}><Icon name="close" size={16}/></button>}</div>
     {panel==='missions'?<><h2 id="title">Zgjidh misionin</h2><div className="maps">{missions.map((m,i)=><button key={m.id} onClick={()=>i===index&&backPanel.current!=='end'?setPanel('game'):start(i)}><Icon name={m.symbol} size={31}/><span><small>MISIONI {pad(i+1)}</small><b>{m.name}</b></span><em>{bests[m.id]?bests[m.id]+' pikë':i===index?'Aktiv':''}</em></button>)}</div></>:panel==='pause'?<>
       <h2 id="title">Në pauzë</h2><p>{mission.name} · {st.hits} / {st.total} kundërshtarë</p><button className="primary" onClick={back}><Icon name="play" size={16}/> Vazhdo lojën</button><div className="sub-actions"><button onClick={()=>start(index)}><Icon name="reload" size={16}/> Nga fillimi</button><button onClick={missionsPanel}><Icon name="stages" size={16}/> Misionet</button></div>
       <div className="setting"><span>Zëri</span><button aria-label={sound?'Fik zërin':'Ndiz zërin'} onClick={toggleSound}><Icon name={sound?'sound':'mute'} size={17}/>{sound?'Aktiv':'Fikur'}</button></div><p className="help">Lëviz me levën majtas. Rrëshqit në anën e djathtë të ekranit për të kthyer kamerën. Prek një kundërshtar ose përdor butonin Qëllo.</p>
     </>:<><h2 id="title">{st.phase==='won'?'Misioni u përfundua':'Misioni përfundoi'}</h2><p>{mission.name}</p><div className="results"><span><small>Pikë</small><b>{st.score}</b></span><span><small>Saktësia</small><b>{st.shots?Math.round(st.hits/st.shots*100):0}%</b></span><span><small>Patrulla</small><b>{st.hits}/{st.total}</b></span></div><button className="primary" onClick={()=>st.phase==='won'?(index<3?start(index+1):missionsPanel()):start(index)}>{st.phase==='won'?(index<3?'Misioni tjetër':'Zgjidh misionin'):'Provo sërish'}</button><button className="replay" onClick={()=>st.phase==='won'?start(index):missionsPanel()}>{st.phase==='won'?'Luaj përsëri':'Misionet'}</button></>}
   </section></div>}
 </main>
}
createRoot(document.getElementById('root')!).render(<App/>);
