import {lazy,Suspense,useState,type ComponentProps} from 'react';
import type BaseKartRoyaleType from './BaseKartRoyale';
import {RacingAtlas} from './RacingAtlas';
import {racingEntry} from './racingModes.mjs';
import '../tirana-street-detail/lobby.css';
const OriginalRace=lazy(()=>import('./BaseKartRoyale'));
const Career=lazy(()=>import('./RacingCareerGame').then(m=>({default:m.RacingCareerGame})));
const Explore=lazy(()=>import('../tirana-social/ExploreGame').then(m=>({default:m.ExploreGame})));
export default function KartRoyale(props:ComponentProps<typeof BaseKartRoyaleType>){
  const [mode,setMode]=useState(()=>racingEntry(typeof window==='undefined'?'':window.location.search));
  const back=()=>setMode('modes');
  if(mode==='online')return <Suspense fallback={<p role="status">Loading the original race lobby…</p>}><OriginalRace {...props} onExit={back}/><RacingAtlas/></Suspense>;
  if(mode==='career'||mode==='ai')return <Suspense fallback={<p role="status">Loading kart racing…</p>}><Career key={mode} practice={mode==='ai'} onExit={back}/><RacingAtlas/></Suspense>;
  if(mode==='explore')return <Suspense fallback={<p role="status">Loading shared Explore…</p>}><Explore sourceGame="racing" onExit={back}/></Suspense>;
  return <main className="tsl-root"><section className="tsl-careers"><button className="tsl-back" onClick={props.onExit}>← Games</button><p className="tsl-eyebrow">RACING ROYAL</p><h1>Karts. Tirana. Your race.</h1><div className="tsl-modes">{([
    ['ai','Race vs AI','Original kart handling, five AI opponents, your circuit and difficulty.'],
    ['online','Online multiplayer','The existing race lobby, private rooms, reconnect and TPG rules.'],
    ['career','Kart career','Six driving missions and the existing championship cups.'],
    ['explore','Explore together','A peaceful shared city with chat and opt-in live media. No race stake.']
  ] as const).map(([id,title,description])=><article key={id} className="tsl-card"><h2>{title}</h2><p>{description}</p><button className="tsl-launch" onClick={()=>setMode(id)}>OPEN {title.toUpperCase()}</button></article>)}</div></section></main>;
}
