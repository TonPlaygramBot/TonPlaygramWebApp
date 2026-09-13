'use client';
import { lazy, Suspense, useState, type ComponentProps } from 'react';
import type { Game as OperationGameType } from './operationUi';
import '../tiranastreets/career/career.css';
import { GameModeBoundary } from '../shared/GameModeBoundary';
const OperationGame = lazy(() => import('./operationUi').then(m => ({default:m.Game})));
const CareerGame = lazy(() => import('../tiranastreets/career/CareerGame').then(m => ({default:m.CareerGame})));
const StreetCareer = lazy(() =>
  import('../tiranastreets/street-career/StreetCareerGame').then((m) => ({
    default: m.StreetCareerGame
  }))
);
/** Mutually exclusive runtimes. Online never mounts or imports the solo campaign.
 * Existing ?activity=career keeps opening the courier/Dajti City Stories. */
export function Game(props: ComponentProps<typeof OperationGameType>) {
  const [activity, setActivity] = useState(() => {
    const a =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('activity')
        : '';
    return a === 'street-career'
      ? 'street-career'
      : a === 'career'
        ? 'stories'
        : 'operation';
  });
  const loading = <div className="tc-game"><p className="tc-status" role="status">Loading Tirana Streets…</p></div>;
  if (props.mode === 'online') return <Suspense fallback={loading}><OperationGame {...props} /></Suspense>;
  if (activity === 'stories')
    return (
      <GameModeBoundary onBack={() => setActivity('operation')}>
        <Suspense fallback={loading}><CareerGame onExit={() => setActivity('operation')} /></Suspense>
      </GameModeBoundary>
    );
  if (activity === 'street-career')
    return (
      <GameModeBoundary onBack={() => setActivity('operation')}>
        <Suspense
          fallback={
            <div className="tc-game">
              <p className="tc-status">Loading street career…</p>
            </div>
          }
        >
          <StreetCareer onExit={() => setActivity('operation')} />
        </Suspense>
      </GameModeBoundary>
    );
  return <GameModeBoundary onBack={props.onExit}><Suspense fallback={loading}><OperationGame {...props} onCareer={()=>setActivity('street-career')} /></Suspense></GameModeBoundary>;
}
