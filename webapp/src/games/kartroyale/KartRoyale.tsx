import {lazy,Suspense,useState,type ComponentProps} from 'react';
import type BaseKartRoyale from './BaseKartRoyale';
import {RacingAtlas} from './RacingAtlas';
import {GameModeBoundary} from '../shared/GameModeBoundary';
import {racingActivity} from './racingModeCore.mjs';
import '../tirana-street-detail/lobby.css';
const Race=lazy(()=>import('./BaseKartRoyale'));
const Career=lazy(()=>import('./RacingCareerGame').then(m=>({default:m.RacingCareerGame})));
/** Race and career runtimes are disposed when switching activities. */
export default function KartRoyale(props:ComponentProps<typeof BaseKartRoyale>){
  const [mode,setMode]=useState(()=>racingActivity(typeof window==='undefined'?'':window.location.search));
  const [retry,setRetry]=useState(0);
  const back=()=>{setMode('race');setRetry(n=>n+1);};
  return <GameModeBoundary key={`${mode}:${retry}`} onBack={back}>
    <Suspense fallback={<main className="tsl-root"><section className="tsl-careers"><h1>Racing Royal</h1><p role="status">Loading {mode==='career'?'kart career':'your kart garage'}…</p><button onClick={props.onExit}>Back to Games</button></section></main>}>
      {mode==='career'?<><Career onExit={back}/><RacingAtlas/></>:
       <><Race {...props} onCareer={()=>setMode('career')}/><RacingAtlas/></>}
    </Suspense>
  </GameModeBoundary>;
}
