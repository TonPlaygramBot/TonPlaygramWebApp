import {lazy,Suspense,useState,type ComponentProps} from 'react';
import BaseKartRoyale from './BaseKartRoyale';
import {RacingAtlas} from './RacingAtlas';
import '../tirana-street-detail/lobby.css';
const Career=lazy(()=>import('./RacingCareerGame').then(m=>({default:m.RacingCareerGame})));
const Explore=lazy(()=>import('../tirana-social/ExploreGame').then(m=>({default:m.ExploreGame})));
export default function KartRoyale(props:ComponentProps<typeof BaseKartRoyale>){
  const [mode,setMode]=useState(()=>{const p=new URLSearchParams(window.location.search);return p.get('mode')==='online'||p.has('tableId')?'multiplayer':p.get('activity')==='explore'?'explore':p.get('activity')==='racing-career'||p.get('mode')==='career'?'career':'modes';});
  if(mode==='multiplayer')return <><BaseKartRoyale {...props} onExit={()=>setMode('modes')}/><RacingAtlas/></>;
  if(mode==='career')return <Suspense fallback={<p>Loading racing career…</p>}><Career onExit={()=>setMode('modes')}/><RacingAtlas/></Suspense>;
  if(mode==='explore')return <Suspense fallback={<p>Loading the shared Tirana city…</p>}><Explore sourceGame="racing" onExit={()=>setMode('modes')}/></Suspense>;
  return <main className="tsl-root"><section className="tsl-careers"><button className="tsl-back" onClick={props.onExit}>← Games</button><p className="tsl-eyebrow">RACING ROYAL</p><h1>Race. Progress. Explore.</h1><div className="tsl-modes">{[
    ['multiplayer','Multiplayer racing','The existing online racing lobby, private rooms and TPG rules.'],
    ['career','Career mode','Win cups, preserve your progress and unlock longer Grand circuits.'],
    ['explore','Explore together','Free shared Tirana. Walk, drive, chat, add friends and opt in to live voice/video.']
  ].map(([id,title,description])=><article key={id} className="tsl-card"><h2>{title}</h2><p>{description}</p><button className="tsl-launch" onClick={()=>setMode(id)}>OPEN {title.toUpperCase()}</button></article>)}</div></section></main>;
}
