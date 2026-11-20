import {lazy,Suspense,useState,type ComponentProps} from 'react';
import type BaseKartRoyale from './BaseKartRoyale';
import {RacingAtlas} from './RacingAtlas';
import {GameModeBoundary} from '../shared/GameModeBoundary';
import '../tirana-street-detail/lobby.css';
const Race=lazy(()=>import('./BaseKartRoyale'));
const Career=lazy(()=>import('./StreetCareerGame').then(m=>({default:m.StreetCareerGame})));
/** Explicit career entry only; legacy free-roam links still enter the race garage. */
export default function KartRoyale(props:ComponentProps<typeof BaseKartRoyale>){
  const [retry,setRetry]=useState(0),[career,setCareer]=useState(false);
  return <GameModeBoundary key={retry} onBack={()=>{setCareer(false);setRetry(n=>n+1);}}>
    <Suspense fallback={<main className="tsl-root"><section className="tsl-careers"><h1>Tirana Racing Streets</h1><p role="status">Loading your kart garage…</p><button onClick={props.onExit}>Back to Games</button></section></main>}>
      {career?<Career onExit={()=>setCareer(false)}/>:<><Race {...props} onCareer={()=>setCareer(true)}/><RacingAtlas/></>}
    </Suspense>
  </GameModeBoundary>;
}
