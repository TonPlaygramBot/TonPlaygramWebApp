'use client';
import { lazy, Suspense, useState, type ComponentProps } from 'react';
import type { Game as OperationGameType } from './operationUi';
import '../tiranastreets/career/career.css';
import { GameModeBoundary } from '../shared/GameModeBoundary';
import {PlayerPicker} from '../tiranastreets/PlayerPicker';
import {selectedPlayerAsset} from '../tiranastreets/playerCatalog.mjs';
import { TiranaLoading } from './TiranaLoading';
import {unifiedEntry} from './unifiedEntry.mjs';
import {loadGameMode} from './loadGameMode';
const OperationGame = lazy(() => loadGameMode('operation',()=>import('./operationUi').then(m => ({default:m.Game}))));
const StreetCareer = lazy(() => loadGameMode('street-career',()=>
  import('../tiranastreets/street-career/StreetCareerGame').then((m) => ({
    default: m.StreetCareerGame
  }))
));
/** Solo Battlefield and career now share one persistent city runtime.
 * Online rooms retain their server-authoritative transport and payouts. */
export function Game(props: ComponentProps<typeof OperationGameType>) {
  const [entry]=useState(()=>unifiedEntry(typeof window!=='undefined'?window.location.search:''));
  const [playerReady,setPlayerReady]=useState(()=>!!selectedPlayerAsset());
  if(!playerReady)return <PlayerPicker onStart={()=>setPlayerReady(true)} onBack={props.onExit}/>;
  const loading = <TiranaLoading onBack={props.onExit} />;
  if (props.mode === 'online') return <GameModeBoundary onBack={props.onExit}><Suspense fallback={loading}><OperationGame {...props} /></Suspense></GameModeBoundary>;
  return <GameModeBoundary onBack={props.onExit}><Suspense fallback={loading}>
    <StreetCareer onExit={props.onExit} initialOperation={entry.operation} initialDifficulty={entry.difficulty}/>
  </Suspense></GameModeBoundary>;
}
