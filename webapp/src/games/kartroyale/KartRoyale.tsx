import {lazy,Suspense,useState,type ComponentProps} from 'react';
import type BaseKartRoyale from './BaseKartRoyale';
import {RacingAtlas} from './RacingAtlas';
import {GameModeBoundary} from '../shared/GameModeBoundary';
import '../tirana-street-detail/lobby.css';
const Race=lazy(()=>import('./BaseKartRoyale'));
/** Only the normal racing runtime is reachable, including old career URLs. */
export default function KartRoyale(props:ComponentProps<typeof BaseKartRoyale>){
  const [retry,setRetry]=useState(0);
  return <GameModeBoundary key={retry} onBack={()=>setRetry(n=>n+1)}>
    <Suspense fallback={<main className="tsl-root"><section className="tsl-careers"><h1>Tirana Racing Streets</h1><p role="status">Loading your kart garage…</p><button onClick={props.onExit}>Back to Games</button></section></main>}>
      <Race {...props}/><RacingAtlas/>
    </Suspense>
  </GameModeBoundary>;
}
