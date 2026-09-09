import {lazy,Suspense,useState,type ComponentProps} from 'react';
import type BaseKartRoyale from './BaseKartRoyale';
import {RacingAtlas} from './RacingAtlas';
import {GameModeBoundary} from '../shared/GameModeBoundary';
import {racingActivity} from './racingModeCore.mjs';
import '../tirana-street-detail/lobby.css';
const Race=lazy(()=>import('./BaseKartRoyale'));
const Career=lazy(()=>import('./RacingCareerGame').then(m=>({default:m.RacingCareerGame})));
const Explore=lazy(()=>import('../tirana-social/ExploreGame').then(m=>({default:m.ExploreGame})));
/** Restore the original garage and its VS AI / MULTIPLAYER / CAREER tabs.
 * Explore is optional and owns no kart race, stake, renderer or media until opened. */
export default function KartRoyale(props:ComponentProps<typeof BaseKartRoyale>){
  const [mode,setMode]=useState(()=>racingActivity(typeof window==='undefined'?'':window.location.search));
  const [retry,setRetry]=useState(0);
  const back=()=>{setMode('race');setRetry(n=>n+1);};
  return <GameModeBoundary key={`${mode}:${retry}`} onBack={back}>
    <Suspense fallback={<main className="tsl-root"><section className="tsl-careers"><h1>Racing Royal</h1><p role="status">Loading {mode==='explore'?'shared exploration':mode==='career'?'kart career':'the original racing garage'}…</p><button onClick={props.onExit}>Back to Games</button></section></main>}>
      {mode==='explore'?<Explore sourceGame="racing" onExit={back}/>:
       mode==='career'?<><Career onExit={back}/><RacingAtlas/></>:
       <><Race {...props} renderOnlineLobby={props.renderOnlineLobby?lobby=><>
         <nav aria-label="Additional Racing Royal modes" style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
           <button className="kr-button" onClick={()=>setMode('career')}>KART MISSIONS</button>
           <button className="kr-button" onClick={()=>setMode('explore')}>EXPLORE TIRANA</button>
         </nav>{props.renderOnlineLobby!(lobby)}
       </>:undefined}/><RacingAtlas/></>}
    </Suspense>
  </GameModeBoundary>;
}
